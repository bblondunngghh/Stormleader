import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import * as propertyService from '../services/propertyService.js';
import * as leadService from '../services/leadService.js';
import env from '../config/env.js';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';

const router = Router();
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

// GET /api/properties/in-swath/:stormEventId — Properties within a storm swath
router.get('/in-swath/:stormEventId', async (req, res, next) => {
  try {
    const { limit = '500', offset = '0' } = req.query;
    const result = await propertyService.findPropertiesInSwath(
      req.params.stormEventId,
      { limit: parseInt(limit, 10), offset: parseInt(offset, 10) }
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
        AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 50)
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

export default router;
