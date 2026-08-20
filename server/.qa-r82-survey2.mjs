import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
async function q(label, sql, params=[]) {
  try { const r = await pool.query(sql, params); console.log('###', label, `(${r.rowCount})`); console.log(JSON.stringify(r.rows)); }
  catch (e) { console.log('###', label, 'ERR', e.code, e.message); }
}
await q('leads-qa', `SELECT id, contact_name, address, contact_email, created_at::date d FROM leads
  WHERE tenant_id=$1 AND (contact_name ILIKE '%qa%' OR address ILIKE '%123 Test St%' OR contact_email ILIKE '%qa2026%'
    OR contact_name ILIKE '%test%' OR address ILIKE '%QA7%' OR address ILIKE '%QA8%' OR source ILIKE '%qa%')
  ORDER BY created_at DESC`, [T]);
await q('estimates-qa', `SELECT e.id, e.estimate_number, e.customer_name, e.status, e.created_at::date d, l.contact_name
  FROM estimates e LEFT JOIN leads l ON l.id=e.lead_id
  WHERE e.tenant_id=$1 AND (e.customer_name ILIKE '%qa%' OR e.customer_name ILIKE '%test%'
    OR l.contact_name ILIKE '%qa%' OR l.contact_name ILIKE '%test%' OR l.address ILIKE '%123 Test St%')
  ORDER BY e.created_at DESC`, [T]);
await q('estimates-by-date', `SELECT created_at::date d, count(*)::int c FROM estimates WHERE tenant_id=$1 GROUP BY 1 ORDER BY 1 DESC LIMIT 15`, [T]);
await q('leads-by-date', `SELECT created_at::date d, count(*)::int c FROM leads WHERE tenant_id=$1 GROUP BY 1 ORDER BY 1 DESC LIMIT 15`, [T]);
await pool.end();
