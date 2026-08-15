import pool from '../db/pool.js';
import logger from '../utils/logger.js';

/**
 * Check if any existing leads' properties fall within a storm event's geometry.
 * If so, create storm_alert notifications for all users in the affected tenants.
 *
 * @param {string} stormEventId - UUID of the storm_events row
 * @returns {number} count of impacted leads
 */
export async function checkImpactedAssets(stormEventId) {
  // Find all existing leads whose property location intersects this storm event
  const { rows: impacted } = await pool.query(
    `SELECT l.id AS lead_id, l.tenant_id, l.contact_name, l.address,
            p.address_line1, p.city,
            se.hail_size_max_in, se.wind_speed_max_mph, se.event_start
     FROM leads l
     JOIN properties p ON l.property_id = p.id
     JOIN storm_events se ON se.id = $1
     WHERE l.deleted_at IS NULL
       AND p.location IS NOT NULL
       AND ST_Intersects(se.geom, p.location)`,
    [stormEventId]
  );

  if (impacted.length === 0) {
    logger.info({ stormEventId, impactedCount: 0 }, 'Impacted asset check complete');
    return 0;
  }

  // Create notifications for each impacted lead, notifying ALL users in the tenant
  // (users has no is_active column — same fan-out as notificationService.js:35)
  for (const row of impacted) {
    const address = row.address || row.address_line1 || 'Unknown address';
    const date = row.event_start
      ? new Date(row.event_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'unknown date';

    // Build description based on available storm data
    const parts = [];
    if (row.hail_size_max_in) parts.push(`${row.hail_size_max_in}" hail`);
    if (row.wind_speed_max_mph) parts.push(`${row.wind_speed_max_mph} mph wind`);
    const stormDesc = parts.length > 0 ? parts.join(' and ') : 'a storm';

    const body = `${address} was hit by ${stormDesc} on ${date}`;

    await pool.query(
      `INSERT INTO notifications (tenant_id, user_id, type, title, body, reference_type, reference_id)
       SELECT u.tenant_id, u.id, 'storm_alert',
              'Property re-impacted by storm',
              $2,
              'lead', $3
       FROM users u
       WHERE u.tenant_id = $1`,
      [row.tenant_id, body, row.lead_id]
    );
  }

  logger.info({ stormEventId, impactedCount: impacted.length }, 'Impacted asset check complete');
  return impacted.length;
}

/**
 * Check impacted assets for all storm events inserted recently.
 * Called after ingestion runs to catch any new storms that overlap existing leads.
 *
 * @param {string[]} stormEventIds - Array of storm event UUIDs to check
 * @returns {number} total count of impacted leads across all events
 */
export async function checkImpactedAssetsForEvents(stormEventIds) {
  if (!stormEventIds || stormEventIds.length === 0) return 0;

  let totalImpacted = 0;
  for (const id of stormEventIds) {
    try {
      const count = await checkImpactedAssets(id);
      totalImpacted += count;
    } catch (err) {
      logger.error({ err, stormEventId: id }, 'Impacted asset check failed for event');
    }
  }
  return totalImpacted;
}
