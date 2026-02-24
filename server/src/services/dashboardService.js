import pool from '../db/pool.js';

export async function getStats(tenantId) {
  const { rows: [stats] } = await pool.query(
    `SELECT
       COALESCE(SUM(estimated_value), 0)::numeric AS pipeline_value,
       COUNT(*)::int AS lead_count,
       ROUND(
         COUNT(*) FILTER (WHERE stage = 'sold')::numeric /
         NULLIF(COUNT(*) FILTER (WHERE stage IN ('sold', 'lost')), 0) * 100,
         1
       ) AS close_rate,
       ROUND(
         AVG(
           CASE WHEN stage = 'sold'
             THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400
           END
         )::numeric,
         1
       ) AS avg_days_to_close
     FROM leads
     WHERE tenant_id = $1`,
    [tenantId]
  );

  return {
    pipelineValue: parseFloat(stats.pipeline_value) || 0,
    leadCount: stats.lead_count,
    closeRate: parseFloat(stats.close_rate) || 0,
    avgDaysToClose: parseFloat(stats.avg_days_to_close) || 0,
  };
}

export async function getFunnel(tenantId) {
  const { rows } = await pool.query(
    `SELECT stage,
            COUNT(*)::int AS count,
            COALESCE(SUM(estimated_value), 0)::numeric AS value
     FROM leads
     WHERE tenant_id = $1
     GROUP BY stage
     ORDER BY
       CASE stage
         WHEN 'new' THEN 1
         WHEN 'contacted' THEN 2
         WHEN 'appt_set' THEN 3
         WHEN 'inspected' THEN 4
         WHEN 'estimate_sent' THEN 5
         WHEN 'sold' THEN 6
         WHEN 'lost' THEN 7
       END`,
    [tenantId]
  );

  return rows.map((r) => ({
    stage: r.stage,
    count: r.count,
    value: parseFloat(r.value),
  }));
}

export async function getActivity(tenantId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT o.id, o.type, o.direction, o.outcome, o.notes, o.created_at,
            l.contact_name, l.address, l.id AS lead_id
     FROM outreach_log o
     JOIN leads l ON l.id = o.lead_id
     WHERE o.tenant_id = $1
     ORDER BY o.created_at DESC
     LIMIT $2`,
    [tenantId, limit]
  );

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    direction: r.direction,
    outcome: r.outcome,
    notes: r.notes,
    createdAt: r.created_at,
    leadId: r.lead_id,
    contactName: r.contact_name,
    address: r.address,
  }));
}
