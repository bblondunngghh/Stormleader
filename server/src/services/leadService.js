import pool from '../db/pool.js';
import logger from '../utils/logger.js';

/**
 * Estimate roof repair value based on property data and storm severity.
 * Uses roof sqft + type for known roofs, or assessed value as fallback.
 */
function estimateRepairValue(prop, hailSizeIn, windSpeedMph) {
  // Per-sqft rates by roof type (full replacement cost)
  const ratePerSqft = {
    composition: 5.50,
    asphalt: 5.50,
    metal: 8.00,
    slate: 12.00,
    tile: 9.50,
    wood: 7.00,
    'built-up': 6.00,
  };

  // Damage factor based on hail size (percentage of full replacement)
  let damageFactor = 0.3; // baseline for wind-only
  if (hailSizeIn >= 2.5) damageFactor = 1.0;       // likely full replacement
  else if (hailSizeIn >= 1.75) damageFactor = 0.8;
  else if (hailSizeIn >= 1.25) damageFactor = 0.6;
  else if (hailSizeIn >= 1.0) damageFactor = 0.45;
  else if (hailSizeIn >= 0.75) damageFactor = 0.35;

  // Wind boost
  const wind = windSpeedMph ? parseFloat(windSpeedMph) : 0;
  if (wind >= 80) damageFactor = Math.min(damageFactor + 0.2, 1.0);
  else if (wind >= 60) damageFactor = Math.min(damageFactor + 0.1, 1.0);

  let estimate;
  const roofSqft = prop.roof_sqft ? parseInt(prop.roof_sqft) : 0;
  const roofType = (prop.roof_type || '').toLowerCase();
  const rate = ratePerSqft[roofType] || 6.00;

  if (roofSqft > 0) {
    estimate = roofSqft * rate * damageFactor;
  } else if (prop.assessed_value) {
    // Fallback: roof repair is roughly 1-3% of home value depending on damage
    estimate = parseFloat(prop.assessed_value) * 0.02 * damageFactor / 0.6;
  } else {
    // No data at all — use a conservative default
    estimate = 8500 * damageFactor;
  }

  // Round to nearest $100
  return Math.round(estimate / 100) * 100;
}

/**
 * Generate lead records from a storm event for a set of properties.
 * Links tenant -> storm -> property and populates contact info from the property.
 */
export async function generateLeadsFromStorm(tenantId, stormEventId, propertyIds, assignedRepId = null) {
  const client = await pool.connect();
  const created = [];

  try {
    await client.query('BEGIN');

    // Check lead limit for tenant's subscription plan
    const { rows: limitRows } = await client.query(
      `SELECT sp.max_leads, COUNT(l.id)::int AS current_leads
       FROM tenants t
       LEFT JOIN subscription_plans sp ON sp.key = t.subscription_tier
       LEFT JOIN leads l ON l.tenant_id = t.id AND l.deleted_at IS NULL
       WHERE t.id = $1
       GROUP BY sp.max_leads`,
      [tenantId]
    );
    if (limitRows.length > 0 && limitRows[0].max_leads != null) {
      const remaining = limitRows[0].max_leads - limitRows[0].current_leads;
      if (remaining <= 0) {
        const err = new Error(`Lead limit reached (${limitRows[0].max_leads}). Upgrade your plan to add more leads.`);
        err.status = 403;
        throw err;
      }
      // Cap the number of properties we'll process to the remaining allowance
      if (propertyIds.length > remaining) {
        propertyIds = propertyIds.slice(0, remaining);
      }
    }

    // Fetch the storm event for hail size + wind speed info
    const { rows: stormRows } = await client.query(
      `SELECT hail_size_max_in, wind_speed_max_mph FROM storm_events WHERE id = $1`,
      [stormEventId]
    );
    if (stormRows.length === 0) {
      throw new Error('Storm event not found');
    }
    const hailSize = stormRows[0].hail_size_max_in;
    const windSpeed = stormRows[0].wind_speed_max_mph;

    for (const propertyId of propertyIds) {
      // Skip if a lead already exists for this tenant + property + storm combo
      const { rows: existing } = await client.query(
        `SELECT id FROM leads
         WHERE tenant_id = $1 AND property_id = $2 AND storm_event_id = $3`,
        [tenantId, propertyId, stormEventId]
      );
      if (existing.length > 0) continue;

      // Fetch property details for contact info + repair estimate
      const { rows: propRows } = await client.query(
        `SELECT address_line1, city, owner_first_name, owner_last_name,
                owner_phone, owner_email, roof_type, roof_sqft, assessed_value
         FROM properties WHERE id = $1`,
        [propertyId]
      );
      if (propRows.length === 0) continue;
      const prop = propRows[0];

      const contactName = [prop.owner_first_name, prop.owner_last_name].filter(Boolean).join(' ') || null;

      // Determine priority based on hail size
      let priority = 'warm';
      const hailNum = hailSize ? parseFloat(hailSize) : 0;
      if (hailNum >= 1.75) {
        priority = 'hot';
      } else if (hailNum < 1.0) {
        priority = 'cold';
      }

      // Auto-estimate repair value based on roof size, type, and storm severity
      const estimatedValue = estimateRepairValue(prop, hailNum, windSpeed);

      const { rows: leadRows } = await client.query(
        `INSERT INTO leads (
          tenant_id, property_id, storm_event_id, assigned_rep_id,
          stage, priority, hail_size_in, estimated_value,
          contact_name, contact_phone, contact_email,
          address, city
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, stage, priority, estimated_value, created_at`,
        [
          tenantId, propertyId, stormEventId, assignedRepId || null,
          'new', priority, hailSize, estimatedValue,
          contactName, prop.owner_phone || null, prop.owner_email || null,
          prop.address_line1 || null, prop.city || null,
        ]
      );

      created.push(leadRows[0]);
    }

    await client.query('COMMIT');
    logger.info(`Generated ${created.length} leads for tenant ${tenantId} from storm ${stormEventId}`);
    return { created: created.length, leads: created };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Lead generation failed');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List leads for a tenant with optional filters.
 */
export async function getLeads(tenantId, filters = {}) {
  const { stage, priority, stormEventId, assignedRepId, limit = 50, offset = 0 } = filters;
  const params = [tenantId];
  const conditions = ['l.tenant_id = $1'];

  if (stage) {
    params.push(stage);
    conditions.push(`l.stage = $${params.length}`);
  }
  if (priority) {
    params.push(priority);
    conditions.push(`l.priority = $${params.length}`);
  }
  if (stormEventId) {
    params.push(stormEventId);
    conditions.push(`l.storm_event_id = $${params.length}`);
  }
  if (assignedRepId) {
    params.push(assignedRepId);
    conditions.push(`l.assigned_rep_id = $${params.length}`);
  }

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const { rows } = await pool.query(
    `SELECT
        l.id, l.tenant_id, l.property_id, l.storm_event_id, l.assigned_rep_id,
        l.stage, l.priority, l.estimated_value, l.insurance_company,
        l.insurance_claim_number, l.hail_size_in,
        l.contact_name, l.contact_phone, l.contact_email,
        l.damage_notes, l.address, l.city,
        l.created_at, l.updated_at,
        p.state, p.zip,
        p.roof_type, p.roof_sqft, p.year_built, p.assessed_value,
        p.roof_pitch_degrees, p.roof_segments,
        ST_AsGeoJSON(p.location)::json AS property_geometry
     FROM leads l
     LEFT JOIN properties p ON p.id = l.property_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY l.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  // Get total count for pagination
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM leads l WHERE ${conditions.join(' AND ')}`,
    params.slice(0, params.length - 2) // exclude limit/offset
  );

  return {
    leads: rows,
    total: parseInt(countRows[0].total, 10),
    limit,
    offset,
  };
}

/**
 * Get a single lead by ID (tenant-scoped).
 */
export async function getLead(tenantId, leadId) {
  const { rows } = await pool.query(
    `SELECT
        l.id, l.tenant_id, l.property_id, l.storm_event_id, l.assigned_rep_id,
        l.stage, l.priority, l.estimated_value, l.insurance_company,
        l.insurance_claim_number, l.hail_size_in,
        l.contact_name, l.contact_phone, l.contact_email,
        l.damage_notes, l.address, l.city,
        l.created_at, l.updated_at,
        p.address_line1, p.address_line2, p.state, p.zip,
        p.owner_first_name, p.owner_last_name, p.owner_phone, p.owner_email,
        p.roof_type, p.roof_sqft, p.year_built, p.assessed_value,
        p.homestead_exempt, p.county_parcel_id, p.property_sqft,
        p.roof_pitch_degrees, p.roof_segments,
        ST_AsGeoJSON(p.location)::json AS property_geometry,
        se.source AS storm_source, se.hail_size_max_in AS storm_hail_max,
        se.wind_speed_max_mph AS storm_wind_max, se.event_start AS storm_start,
        se.raw_data->>'type' AS storm_type
     FROM leads l
     LEFT JOIN properties p ON p.id = l.property_id
     LEFT JOIN storm_events se ON se.id = l.storm_event_id
     WHERE l.id = $1 AND l.tenant_id = $2`,
    [leadId, tenantId]
  );

  if (rows.length === 0) return null;
  return rows[0];
}

/**
 * Update a lead (tenant-scoped). Supports partial updates.
 */
export async function updateLead(tenantId, leadId, updates) {
  const allowedFields = [
    'stage', 'priority', 'estimated_value', 'insurance_company',
    'insurance_claim_number', 'contact_name', 'contact_phone',
    'contact_email', 'damage_notes', 'assigned_rep_id',
  ];

  const setClauses = [];
  const params = [tenantId, leadId];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      params.push(updates[field]);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) {
    return getLead(tenantId, leadId);
  }

  const { rows } = await pool.query(
    `UPDATE leads
     SET ${setClauses.join(', ')}
     WHERE id = $2 AND tenant_id = $1
     RETURNING *`,
    params
  );

  if (rows.length === 0) return null;
  return rows[0];
}
