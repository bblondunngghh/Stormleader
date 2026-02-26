import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { sendStormEmail } from './emailService.js';

/**
 * Check newly ingested storm events against all tenants' service areas
 * and send email alerts for any that intersect.
 *
 * Call this after each ingestion run.
 */
export async function checkAndAlert() {
  const { rows: tenants } = await pool.query(`
    SELECT t.id as tenant_id, t.name as tenant_name, t.service_area,
           ac.enabled, ac.email_enabled,
           ac.email_recipients,
           ac.min_hail_size_in, ac.min_wind_speed_mph, ac.alert_mode
    FROM tenants t
    JOIN alert_configs ac ON ac.tenant_id = t.id
    WHERE ac.enabled = true
      AND ac.email_enabled = true
      AND t.service_area IS NOT NULL
  `);

  if (tenants.length === 0) return;

  for (const tenant of tenants) {
    try {
      await checkTenantAlerts(tenant);
    } catch (err) {
      logger.error({ err, tenantId: tenant.tenant_id }, 'Alert check failed for tenant');
    }
  }
}

async function checkTenantAlerts(tenant) {
  if (!tenant.email_recipients || tenant.email_recipients.length === 0) return;

  // Find recent storms that:
  // 1. Intersect the tenant's service area
  // 2. Meet the tenant's threshold criteria
  // 3. Haven't already been alerted for this tenant
  const { rows: storms } = await pool.query(`
    SELECT se.id, se.source, se.source_id,
           se.hail_size_max_in, se.wind_speed_max_mph,
           se.event_start, se.raw_data,
           ST_AsText(ST_Centroid(se.geom)) as centroid
    FROM storm_events se
    WHERE se.created_at >= NOW() - INTERVAL '2 hours'
      AND ST_Intersects(se.geom, (SELECT service_area FROM tenants WHERE id = $1))
      AND (
        (se.hail_size_max_in IS NOT NULL AND se.hail_size_max_in >= $2)
        OR (se.wind_speed_max_mph IS NOT NULL AND se.wind_speed_max_mph >= $3)
      )
      AND NOT EXISTS (
        SELECT 1 FROM storm_alerts sa
        WHERE sa.tenant_id = $1 AND sa.storm_event_id = se.id
      )
    ORDER BY se.event_start DESC
  `, [tenant.tenant_id, tenant.min_hail_size_in, tenant.min_wind_speed_mph]);

  if (storms.length === 0) return;

  logger.info({ tenantId: tenant.tenant_id, stormCount: storms.length },
    'New storms detected in service area');

  for (const storm of storms) {
    const { rows: [{ cnt }] } = await pool.query(`
      SELECT COUNT(*) as cnt FROM properties
      WHERE ST_Intersects(location, (SELECT geom FROM storm_events WHERE id = $1))
    `, [storm.id]);

    const affectedCount = Number(cnt);
    const alertData = buildAlertContent(storm, tenant.tenant_name, affectedCount);

    for (const email of tenant.email_recipients) {
      try {
        await sendStormEmail(email, alertData);
        await recordAlert(tenant.tenant_id, storm.id, 'email', email, alertData.subject, affectedCount, 'sent');
      } catch (err) {
        logger.error({ err, email, stormId: storm.id }, 'Failed to send email alert');
        await recordAlert(tenant.tenant_id, storm.id, 'email', email, alertData.subject, affectedCount, 'failed', err.message);
      }
    }
  }
}

function buildAlertContent(storm, tenantName, affectedCount) {
  const rawData = typeof storm.raw_data === 'string'
    ? JSON.parse(storm.raw_data)
    : storm.raw_data || {};

  const type = rawData.type || storm.source || 'storm';
  const location = rawData.location || rawData.county || 'your service area';
  const state = rawData.state || '';
  const dateStr = storm.event_start
    ? new Date(storm.event_start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Recently';

  let severity = '';
  if (storm.hail_size_max_in) {
    severity = `${storm.hail_size_max_in}" hail`;
  }
  if (storm.wind_speed_max_mph) {
    severity += severity ? ` + ${storm.wind_speed_max_mph} mph wind` : `${storm.wind_speed_max_mph} mph wind`;
  }

  const subject = `Storm Alert: ${severity || type} near ${location}${state ? ', ' + state : ''}`;

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Storm Alert</h1>
        <p style="margin: 8px 0 0; opacity: 0.8; font-size: 14px;">${tenantName} — StormLeads</p>
      </div>
      <div style="background: #f8f9fa; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="margin: 0 0 16px; color: #1a1a2e; font-size: 18px;">${severity || type}</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 140px;">Location</td>
            <td style="padding: 8px 0; font-weight: 600;">${location}${state ? ', ' + state : ''}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Date/Time</td>
            <td style="padding: 8px 0; font-weight: 600;">${dateStr}</td>
          </tr>
          ${storm.hail_size_max_in ? `<tr>
            <td style="padding: 8px 0; color: #666;">Max Hail Size</td>
            <td style="padding: 8px 0; font-weight: 600;">${storm.hail_size_max_in}"</td>
          </tr>` : ''}
          ${storm.wind_speed_max_mph ? `<tr>
            <td style="padding: 8px 0; color: #666;">Max Wind Speed</td>
            <td style="padding: 8px 0; font-weight: 600;">${storm.wind_speed_max_mph} mph</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 8px 0; color: #666;">Properties Affected</td>
            <td style="padding: 8px 0; font-weight: 600; color: #e74c3c;">${affectedCount.toLocaleString()}</td>
          </tr>
        </table>
        <div style="margin-top: 24px; text-align: center;">
          <a href="#" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Storm Details</a>
        </div>
        <p style="margin: 16px 0 0; font-size: 12px; color: #999; text-align: center;">
          You're receiving this because you have storm alerts enabled in StormLeads.
        </p>
      </div>
    </div>
  `;

  return { subject, emailHtml, type, location, severity, dateStr, affectedCount };
}

async function recordAlert(tenantId, stormEventId, alertType, recipient, subject, affectedProperties, status, errorMessage = null) {
  await pool.query(`
    INSERT INTO storm_alerts (tenant_id, storm_event_id, alert_type, recipient, subject, affected_properties, status, error_message)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (tenant_id, storm_event_id, alert_type, recipient) DO UPDATE SET
      status = EXCLUDED.status,
      error_message = EXCLUDED.error_message,
      sent_at = NOW()
  `, [tenantId, stormEventId, alertType, recipient, subject, affectedProperties, status, errorMessage]);
}

/**
 * Get alert history for a tenant
 */
export async function getAlertHistory(tenantId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await pool.query(`
    SELECT sa.*, se.source, se.hail_size_max_in, se.wind_speed_max_mph, se.event_start
    FROM storm_alerts sa
    JOIN storm_events se ON se.id = sa.storm_event_id
    WHERE sa.tenant_id = $1
    ORDER BY sa.sent_at DESC
    LIMIT $2 OFFSET $3
  `, [tenantId, limit, offset]);
  return rows;
}

/**
 * Get or create alert config for a tenant
 */
export async function getAlertConfig(tenantId) {
  const { rows } = await pool.query(
    'SELECT * FROM alert_configs WHERE tenant_id = $1', [tenantId]
  );
  if (rows.length > 0) return rows[0];

  const { rows: [config] } = await pool.query(
    `INSERT INTO alert_configs (tenant_id) VALUES ($1) RETURNING *`,
    [tenantId]
  );
  return config;
}

/**
 * Update alert config for a tenant
 */
export async function updateAlertConfig(tenantId, updates) {
  const allowedFields = [
    'enabled', 'email_enabled',
    'email_recipients',
    'min_hail_size_in', 'min_wind_speed_mph',
    'alert_mode', 'digest_hour',
  ];

  const setClauses = [];
  const params = [tenantId];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      params.push(value);
      setClauses.push(`${key} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) return getAlertConfig(tenantId);

  setClauses.push('updated_at = NOW()');

  const { rows: [config] } = await pool.query(`
    INSERT INTO alert_configs (tenant_id) VALUES ($1)
    ON CONFLICT (tenant_id) DO UPDATE SET ${setClauses.join(', ')}
    RETURNING *
  `, params);

  return config;
}
