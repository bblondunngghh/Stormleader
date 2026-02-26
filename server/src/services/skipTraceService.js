import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';

const TRACERFY_BASE = env.TRACERFY_API_BASE || 'https://api.tracerfy.com/v1';
const TRACERFY_KEY = env.TRACERFY_API_KEY || '';

/**
 * Submit a skip trace job to Tracerfy for a list of properties.
 * Creates a CSV payload from property records and sends to the trace endpoint.
 *
 * @param {string} tenantId
 * @param {string[]} propertyIds - Array of property UUIDs to trace
 * @param {string} [webhookUrl] - Optional webhook URL for completion notification
 * @returns {{ jobId: string, recordsRequested: number }}
 */
export async function submitSkipTrace(tenantId, propertyIds, webhookUrl) {
  if (!TRACERFY_KEY) {
    throw new Error('TRACERFY_API_KEY is not configured');
  }

  // Fetch property data for the trace
  const { rows: properties } = await pool.query(
    `SELECT id, address_line1, address_line2, city, state, zip,
            owner_first_name, owner_last_name
     FROM properties
     WHERE id = ANY($1)`,
    [propertyIds]
  );

  if (properties.length === 0) {
    throw new Error('No properties found for the given IDs');
  }

  // Build CSV payload for Tracerfy
  const csvHeader = 'first_name,last_name,address,city,state,zip,property_id';
  const csvRows = properties.map(p => [
    p.owner_first_name || '',
    p.owner_last_name || '',
    p.address_line1 || '',
    p.city || '',
    p.state || 'TX',
    p.zip || '',
    p.id,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csvPayload = [csvHeader, ...csvRows].join('\n');

  // Submit to Tracerfy API
  const formData = new FormData();
  formData.append('file', new Blob([csvPayload], { type: 'text/csv' }), 'skip_trace.csv');
  if (webhookUrl) {
    formData.append('webhook_url', webhookUrl);
  }

  const response = await fetch(`${TRACERFY_BASE}/trace/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TRACERFY_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, body: errorText }, 'Tracerfy API error');
    throw new Error(`Tracerfy API returned ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const jobId = result.queue_id || result.job_id || result.id;

  // Log usage
  await pool.query(
    `INSERT INTO skip_trace_usage (tenant_id, provider, records_requested, cost_cents)
     VALUES ($1, 'tracerfy', $2, $3)`,
    [tenantId, properties.length, properties.length * 2] // $0.02 per record = 2 cents
  );

  logger.info({ tenantId, jobId, count: properties.length }, 'Skip trace job submitted');

  return { jobId, recordsRequested: properties.length };
}

/**
 * Check the status of a skip trace job.
 */
export async function getJobStatus(jobId) {
  if (!TRACERFY_KEY) {
    throw new Error('TRACERFY_API_KEY is not configured');
  }

  const response = await fetch(`${TRACERFY_BASE}/queue/${jobId}`, {
    headers: { 'Authorization': `Bearer ${TRACERFY_KEY}` },
  });

  if (!response.ok) {
    throw new Error(`Tracerfy API returned ${response.status}`);
  }

  return response.json();
}

/**
 * Process completed skip trace results — update leads with contact info.
 * Called either from webhook handler or manual poll.
 *
 * @param {string} tenantId
 * @param {object[]} results - Array of trace results from Tracerfy
 */
export async function processSkipTraceResults(tenantId, results) {
  let updated = 0;

  for (const record of results) {
    // Tracerfy returns phone numbers and emails per record
    const phones = [
      record.phone_1, record.phone_2, record.phone_3,
      record.phone_4, record.phone_5, record.phone_6,
      record.phone_7, record.phone_8,
    ].filter(Boolean);

    const emails = [
      record.email_1, record.email_2, record.email_3,
      record.email_4, record.email_5,
    ].filter(Boolean);

    const primaryPhone = phones[0] || null;
    const primaryEmail = emails[0] || null;
    const propertyId = record.property_id;

    if (!propertyId) continue;

    // Update the property record with contact info
    if (primaryPhone || primaryEmail) {
      await pool.query(
        `UPDATE properties
         SET owner_phone = COALESCE($1, owner_phone),
             owner_email = COALESCE($2, owner_email)
         WHERE id = $3`,
        [primaryPhone, primaryEmail, propertyId]
      );
    }

    // Update any leads for this property + tenant with contact info
    const { rowCount } = await pool.query(
      `UPDATE leads
       SET contact_phone = COALESCE($1, contact_phone),
           contact_email = COALESCE($2, contact_email),
           contact_name = COALESCE($3, contact_name),
           updated_at = NOW()
       WHERE tenant_id = $4 AND property_id = $5`,
      [
        primaryPhone,
        primaryEmail,
        record.first_name && record.last_name
          ? `${record.first_name} ${record.last_name}`
          : null,
        tenantId,
        propertyId,
      ]
    );

    updated += rowCount;
  }

  // Update usage record with actual results
  await pool.query(
    `UPDATE skip_trace_usage
     SET records_returned = $1
     WHERE tenant_id = $2 AND provider = 'tracerfy'
     ORDER BY created_at DESC
     LIMIT 1`,
    [results.length, tenantId]
  );

  logger.info({ tenantId, processed: results.length, leadsUpdated: updated }, 'Skip trace results processed');
  return { processed: results.length, leadsUpdated: updated };
}

/**
 * Get skip trace usage stats for a tenant.
 */
export async function getUsage(tenantId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) as total_jobs,
       COALESCE(SUM(records_requested), 0) as total_requested,
       COALESCE(SUM(records_returned), 0) as total_returned,
       COALESCE(SUM(cost_cents), 0) as total_cost_cents
     FROM skip_trace_usage
     WHERE tenant_id = $1`,
    [tenantId]
  );
  return rows[0];
}

/**
 * Get recent skip trace jobs for a tenant.
 */
export async function getRecentJobs(tenantId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT * FROM skip_trace_usage
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [tenantId, limit]
  );
  return rows;
}
