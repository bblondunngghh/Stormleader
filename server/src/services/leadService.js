import pool from '../db/pool.js';
import logger from '../utils/logger.js';

/**
 * Generate lead records from a storm event for a set of properties.
 * Links tenant -> storm -> property and populates contact info from the property.
 */
export async function generateLeadsFromStorm(tenantId, stormEventId, propertyIds, assignedRepId = null) {
  const client = await pool.connect();
  const created = [];

  try {
    await client.query('BEGIN');

    // Fetch the storm event for hail size info
    const { rows: stormRows } = await client.query(
      `SELECT hail_size_max_in FROM storm_events WHERE id = $1`,
      [stormEventId]
    );
    if (stormRows.length === 0) {
      throw new Error('Storm event not found');
    }
    const hailSize = stormRows[0].hail_size_max_in;

    for (const propertyId of propertyIds) {
      // Skip if a lead already exists for this tenant + property + storm combo
      const { rows: existing } = await client.query(
        `SELECT id FROM leads
         WHERE tenant_id = $1 AND property_id = $2 AND storm_event_id = $3`,
        [tenantId, propertyId, stormEventId]
      );
      if (existing.length > 0) continue;

      // Fetch property contact info
      const { rows: propRows } = await client.query(
        `SELECT address_line1, city, owner_first_name, owner_last_name,
                owner_phone, owner_email
         FROM properties WHERE id = $1`,
        [propertyId]
      );
      if (propRows.length === 0) continue;
      const prop = propRows[0];

      const contactName = [prop.owner_first_name, prop.owner_last_name].filter(Boolean).join(' ') || null;

      // Determine priority based on hail size
      let priority = 'warm';
      if (hailSize && parseFloat(hailSize) >= 1.75) {
        priority = 'hot';
      } else if (!hailSize || parseFloat(hailSize) < 1.0) {
        priority = 'cold';
      }

      const { rows: leadRows } = await client.query(
        `INSERT INTO leads (
          tenant_id, property_id, storm_event_id, assigned_rep_id,
          stage, priority, hail_size_in,
          contact_name, contact_phone, contact_email,
          address, city
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, stage, priority, created_at`,
        [
          tenantId, propertyId, stormEventId, assignedRepId || null,
          'new', priority, hailSize,
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
        p.roof_type, p.roof_sqft, p.year_built, p.assessed_value,
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
        ST_AsGeoJSON(p.location)::json AS property_geometry,
        se.source AS storm_source, se.hail_size_max_in AS storm_hail_max,
        se.wind_speed_max_mph AS storm_wind_max, se.event_start AS storm_start
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
