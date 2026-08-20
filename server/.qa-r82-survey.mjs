import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const PAT = `(name ILIKE '%qa2026%' OR name ILIKE '%QA79%' OR name ILIKE '%QA76%' OR name ILIKE '%QA Territory%')`;

async function q(label, sql, params=[]) {
  try { const r = await pool.query(sql, params); console.log('###', label); console.log(JSON.stringify(r.rows, null, 1)); }
  catch (e) { console.log('###', label, 'ERR', e.code, e.message); }
}

await q('leads-qa', `SELECT id, contact_name, address, email, created_at::date FROM leads
  WHERE tenant_id=$1 AND (contact_name ILIKE '%qa%' OR address ILIKE '%123 Test St%' OR email ILIKE '%qa2026%'
    OR contact_name ILIKE '%test%' OR address ILIKE '%QA79%' OR address ILIKE '%QA76%')
  ORDER BY created_at DESC`, [T]);

await q('estimates-count-total', `SELECT count(*)::int total, max(estimate_number) maxnum FROM estimates WHERE tenant_id=$1`, [T]);
await q('estimates-qa', `SELECT e.id, e.estimate_number, e.title, e.status, e.created_at::date, l.contact_name
  FROM estimates e LEFT JOIN leads l ON l.id=e.lead_id
  WHERE e.tenant_id=$1 AND (e.title ILIKE '%qa%' OR e.title ILIKE '%test%' OR l.contact_name ILIKE '%qa%' OR l.address ILIKE '%123 Test St%')
  ORDER BY e.created_at DESC`, [T]);
await q('table-counts', `SELECT 'leads' t, count(*)::int c FROM leads WHERE tenant_id=$1
  UNION ALL SELECT 'estimates', count(*)::int FROM estimates WHERE tenant_id=$1
  UNION ALL SELECT 'invoices', count(*)::int FROM invoices WHERE tenant_id=$1
  UNION ALL SELECT 'contracts', count(*)::int FROM contracts WHERE tenant_id=$1
  UNION ALL SELECT 'tasks', count(*)::int FROM tasks WHERE tenant_id=$1
  UNION ALL SELECT 'work_orders', count(*)::int FROM work_orders WHERE tenant_id=$1`, [T]);
await pool.end();
