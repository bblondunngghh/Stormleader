import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import * as propertyService from '../services/propertyService.js';
import * as leadService from '../services/leadService.js';
import { getImportProgress } from '../services/countyService.js';
import env from '../config/env.js';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { autoImportForStorms } from '../services/countyService.js';

const router = Router();

// GET /api/properties/import-progress — no auth needed, lightweight poll
router.get('/import-progress', (req, res) => {
  res.json(getImportProgress());
});

// POST /api/properties/trigger-import — kick off storm area auto-import
router.post('/trigger-import', (req, res) => {
  const progress = getImportProgress();
  if (progress.active) {
    return res.json({ status: 'already_running', progress });
  }
  // Run in background, return immediately
  autoImportForStorms().catch(err => logger.error({ err }, 'Manual auto-import failed'));
  res.json({ status: 'started' });
});

router.use(authenticate);

// GET /api/properties — List properties with optional bbox filter
router.get('/', async (req, res, next) => {
  try {
    const { bbox, limit = '500' } = req.query;

    if (!bbox) {
      return res.status(400).json({ error: 'bbox query parameter is required (west,south,east,north)' });
    }

    const bboxArr = bbox.split(',').map(Number);
    if (bboxArr.length !== 4 || bboxArr.some(isNaN)) {
      return res.status(400).json({ error: 'bbox must be 4 comma-separated numbers: west,south,east,north' });
    }

    const result = await propertyService.getPropertiesInViewport(bboxArr, parseInt(limit, 10));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/properties/in-swath/:stormEventId/count — Fast count of properties in swath
router.get('/in-swath/:stormEventId/count', async (req, res, next) => {
  try {
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM properties p
       JOIN storm_events se ON se.id = $1
       WHERE p.location && se.geom AND ST_Intersects(p.location, se.geom)
         AND (p.year_built IS NOT NULL OR p.fema_year_built IS NOT NULL OR p.roof_sqft > 0 OR p.fema_sqft > 0 OR COALESCE(p.assessed_value, p.fema_replacement_value) > 15000 OR p.homestead_exempt = true)
         AND p.address_line1 IS NOT NULL AND TRIM(p.address_line1) != '' AND p.address_line1 != '0'`,
      [req.params.stormEventId]
    );
    res.json({ count: parseInt(count, 10) });
  } catch (err) {
    next(err);
  }
});

// GET /api/properties/in-swath/:stormEventId — Properties within a storm swath
router.get('/in-swath/:stormEventId', async (req, res, next) => {
  try {
    const { limit = '500', offset = '0', bbox } = req.query;
    const opts = { limit: parseInt(limit, 10), offset: parseInt(offset, 10) };
    if (bbox) {
      const parts = bbox.split(',').map(Number);
      if (parts.length === 4 && parts.every(n => !isNaN(n))) {
        opts.bbox = parts; // [west, south, east, north]
      }
    }
    const result = await propertyService.findPropertiesInSwath(
      req.params.stormEventId,
      opts
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/properties/:id — Single property detail
router.get('/:id', async (req, res, next) => {
  try {
    const property = await propertyService.getProperty(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(property);
  } catch (err) {
    next(err);
  }
});

// POST /api/properties/generate-leads — Generate leads from storm + property IDs
router.post('/generate-leads', async (req, res, next) => {
  try {
    const { stormEventId, propertyIds, assignedRepId } = req.body;

    if (!stormEventId) {
      return res.status(400).json({ error: 'stormEventId is required' });
    }
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ error: 'propertyIds must be a non-empty array' });
    }

    const tenantId = req.user.tenantId;
    const result = await leadService.generateLeadsFromStorm(
      tenantId, stormEventId, propertyIds, assignedRepId
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/properties — Create a single property from address + geocoded coordinates
router.post('/', async (req, res, next) => {
  try {
    const { address_line1, city, state, zip, lat, lng } = req.body;
    if (!address_line1 || lat == null || lng == null) {
      return res.status(400).json({ error: 'address_line1, lat, and lng are required' });
    }

    // Check for existing property at this address (dedup)
    const { rows: existing } = await pool.query(
      `SELECT id, address_line1, city, state, zip,
              assessed_value, year_built, roof_sqft, roof_pitch_degrees, roof_segments,
              roof_measurement_source, owner_first_name, owner_last_name,
              ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
       FROM properties
       WHERE LOWER(TRIM(address_line1)) = LOWER(TRIM($1))
         AND LOWER(TRIM(COALESCE(city,''))) = LOWER(TRIM(COALESCE($2,'')))
       LIMIT 1`,
      [address_line1, city || '']
    );

    if (existing.length > 0) {
      return res.json({ property: existing[0], created: false });
    }

    // Look up county data: first try spatial match within 20m, then fallback to address match
    const { rows: nearest } = await pool.query(`
      SELECT assessed_value, year_built, owner_first_name, owner_last_name, owner_phone, owner_email,
             county_parcel_id, roof_type, property_sqft, homestead_exempt
      FROM properties
      WHERE location IS NOT NULL
        AND assessed_value IS NOT NULL
        AND data_source IS DISTINCT FROM 'address_search'
        AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 20)
      ORDER BY location <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
      LIMIT 1
    `, [lng, lat]);

    let parcel = nearest[0] || {};

    // Fallback: match by street number + name if spatial didn't find county data
    if (!parcel.assessed_value) {
      const { rows: addrMatch } = await pool.query(`
        SELECT assessed_value, year_built, owner_first_name, owner_last_name, owner_phone, owner_email,
               county_parcel_id, roof_type, property_sqft, homestead_exempt
        FROM properties
        WHERE assessed_value IS NOT NULL
          AND data_source IS DISTINCT FROM 'address_search'
          AND LOWER(TRIM(address_line1)) = LOWER(TRIM($1))
          AND LOWER(TRIM(COALESCE(city,''))) = LOWER(TRIM(COALESCE($2,'')))
        LIMIT 1
      `, [address_line1, city || '']);
      if (addrMatch.length > 0) parcel = addrMatch[0];
    }

    const { rows } = await pool.query(
      `INSERT INTO properties (
        location, address_line1, city, state, zip,
        assessed_value, year_built, owner_first_name, owner_last_name,
        owner_phone, owner_email, roof_type,
        property_sqft, homestead_exempt, data_source
      ) VALUES (
        ST_SetSRID(ST_MakePoint($1, $2), 4326),
        $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, 'address_search'
      ) RETURNING id, address_line1, city, state, zip, assessed_value, year_built,
                  owner_first_name, owner_last_name, owner_phone, owner_email,
                  roof_type, property_sqft`,
      [
        lng, lat,
        address_line1, city || null, state || null, zip || null,
        parcel.assessed_value || null, parcel.year_built || null,
        parcel.owner_first_name || null, parcel.owner_last_name || null,
        parcel.owner_phone || null, parcel.owner_email || null,
        parcel.roof_type || null,
        parcel.property_sqft || null, parcel.homestead_exempt || false,
      ]
    );

    const property = { ...rows[0], lat, lng };
    logger.info({ propertyId: property.id, address_line1, lat, lng }, 'Property created from address search');
    res.status(201).json({ property, created: true });
  } catch (err) {
    next(err);
  }
});

// PUT /api/properties/:id/location — Update property coordinates (e.g. drag pin to correct spot)
// Also re-lookups nearest parcel to correct assessed_value and other county data
router.put('/:id/location', async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: 'lat and lng are required' });

    const propertyId = req.params.id;

    // Update the location
    const { rowCount } = await pool.query(
      `UPDATE properties SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326), updated_at = NOW() WHERE id = $3`,
      [lng, lat, propertyId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Property not found' });

    // Find nearest OTHER property at the new coordinates to get correct parcel data
    // This handles cases where the original geocoding landed on the wrong parcel
    const { rows: nearest } = await pool.query(`
      SELECT county_parcel_id, assessed_value, year_built, owner_last_name
      FROM properties
      WHERE id != $1
        AND location IS NOT NULL
        AND data_source IS DISTINCT FROM 'address_search'
        AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 20)
      ORDER BY location <-> ST_SetSRID(ST_MakePoint($2, $3), 4326)
      LIMIT 1
    `, [propertyId, lng, lat]);

    let parcelUpdated = false;
    if (nearest.length > 0 && nearest[0].assessed_value) {
      await pool.query(`
        UPDATE properties SET
          assessed_value = COALESCE($2, assessed_value),
          year_built = COALESCE($3, year_built),
          updated_at = NOW()
        WHERE id = $1
      `, [propertyId, nearest[0].assessed_value, nearest[0].year_built]);
      parcelUpdated = true;
      logger.info({ propertyId, nearestParcel: nearest[0].county_parcel_id, assessed_value: nearest[0].assessed_value }, 'Updated parcel data from nearest property');
    }

    logger.info({ propertyId, lat, lng, parcelUpdated }, 'Property location updated manually');
    res.json({ lat, lng, parcelUpdated });
  } catch (err) {
    next(err);
  }
});

// POST /api/properties/:id/fema-lookup — Fetch FEMA NSI data for a single property on-demand
router.post('/:id/fema-lookup', async (req, res, next) => {
  try {
    const propertyId = req.params.id;

    // Get property location
    const { rows: [prop] } = await pool.query(
      `SELECT id, fema_fd_id, ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat
       FROM properties WHERE id = $1`,
      [propertyId]
    );
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    if (prop.fema_fd_id) return res.json({ alreadyLoaded: true, message: 'FEMA data already present' });

    // Query NSI API with a small bbox around the property (~100m)
    const buffer = 0.001; // ~111m at equator
    const bboxParam = [
      prop.lng - buffer, prop.lat - buffer,
      prop.lng - buffer, prop.lat + buffer,
      prop.lng + buffer, prop.lat + buffer,
      prop.lng + buffer, prop.lat - buffer,
      prop.lng - buffer, prop.lat - buffer,
    ].join(',');

    const nsiRes = await fetch(`https://nsi.sec.usace.army.mil/nsiapi/structures?bbox=${bboxParam}&fmt=fc`);
    if (!nsiRes.ok) {
      return res.status(502).json({ error: `FEMA NSI API error: ${nsiRes.status}` });
    }
    const nsiData = await nsiRes.json();
    const features = nsiData.features || [];

    // Find the closest residential structure
    const residential = features.filter(f => {
      const p = f.properties;
      return p.st_damcat === 'Residential' || (p.occtype && p.occtype.startsWith('RES'));
    });

    if (residential.length === 0) {
      return res.json({ found: false, message: 'No FEMA residential structures found near this property' });
    }

    // Pick the closest one whose fd_id isn't already used by another property
    residential.sort((a, b) => {
      const [aLng, aLat] = a.geometry?.coordinates || [0, 0];
      const [bLng, bLat] = b.geometry?.coordinates || [0, 0];
      const aDist = (aLng - prop.lng) ** 2 + (aLat - prop.lat) ** 2;
      const bDist = (bLng - prop.lng) ** 2 + (bLat - prop.lat) ** 2;
      return aDist - bDist;
    });

    // Check which fd_ids are already taken
    const fdIds = residential.map(f => String(f.properties.fd_id)).filter(Boolean);
    const { rows: taken } = await pool.query(
      `SELECT fema_fd_id FROM properties WHERE fema_fd_id = ANY($1) AND id != $2`,
      [fdIds, propertyId]
    );
    const takenSet = new Set(taken.map(r => r.fema_fd_id));
    const closest = residential.find(f => !takenSet.has(String(f.properties.fd_id))) || residential[0];

    const p = closest.properties;
    const fdIdToUse = takenSet.has(String(p.fd_id)) ? null : (p.fd_id ? String(p.fd_id) : null);
    const updateResult = await pool.query(`
      UPDATE properties SET
        fema_fd_id = COALESCE($2, fema_fd_id),
        fema_sqft = COALESCE($3, fema_sqft),
        fema_year_built = COALESCE($4, fema_year_built),
        fema_replacement_value = COALESCE($5, fema_replacement_value),
        fema_occupancy_type = COALESCE($6, fema_occupancy_type),
        fema_damage_category = COALESCE($7, fema_damage_category),
        fema_bldg_type = COALESCE($8, fema_bldg_type),
        fema_num_stories = COALESCE($9, fema_num_stories),
        fema_foundation_type = COALESCE($10, fema_foundation_type),
        fema_foundation_height = COALESCE($11, fema_foundation_height),
        fema_ground_elevation = COALESCE($12, fema_ground_elevation),
        fema_fetched_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [
      propertyId,
      fdIdToUse,
      p.sqft ? Math.round(Number(p.sqft)) : null,
      p.med_yr_blt ? Math.round(Number(p.med_yr_blt)) : null,
      p.val_struct ? Number(p.val_struct) : null,
      p.occtype || null,
      p.st_damcat || null,
      p.bldgtype || null,
      p.num_story != null ? Number(p.num_story) : null,
      p.found_type || null,
      p.found_ht != null ? Number(p.found_ht) : null,
      p.ground_elv != null ? Number(p.ground_elv) : null,
    ]);

    const femaData = {
      fema_sqft: p.sqft ? Math.round(Number(p.sqft)) : null,
      fema_year_built: p.med_yr_blt ? Math.round(Number(p.med_yr_blt)) : null,
      fema_replacement_value: p.val_struct ? Number(p.val_struct) : null,
      fema_occupancy_type: p.occtype || null,
      fema_bldg_type: p.bldgtype || null,
      fema_num_stories: p.num_story != null ? Number(p.num_story) : null,
      fema_foundation_type: p.found_type || null,
      fema_foundation_height: p.found_ht != null ? Number(p.found_ht) : null,
      fema_ground_elevation: p.ground_elv != null ? Number(p.ground_elv) : null,
    };

    logger.info({ propertyId, fdId: p.fd_id }, 'FEMA NSI data loaded on-demand');
    res.json({ found: true, ...femaData });
  } catch (err) {
    next(err);
  }
});

export default router;
