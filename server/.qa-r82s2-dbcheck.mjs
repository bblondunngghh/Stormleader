import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const q = async (l,s,p=[T]) => { try { const r = await pool.query(s,p); console.log(l, JSON.stringify(r.rows)); } catch(e){ console.log(l,'ERR',e.code,e.message.slice(0,80)); } };
await q('counts', `SELECT 'leads' t,count(*)::int c FROM leads WHERE tenant_id=$1
 UNION ALL SELECT 'estimates',count(*)::int FROM estimates WHERE tenant_id=$1
 UNION ALL SELECT 'invoices',count(*)::int FROM invoices WHERE tenant_id=$1
 UNION ALL SELECT 'contracts',count(*)::int FROM contracts WHERE tenant_id=$1
 UNION ALL SELECT 'work_orders',count(*)::int FROM work_orders WHERE tenant_id=$1
 UNION ALL SELECT 'tasks',count(*)::int FROM tasks WHERE tenant_id=$1`);
await q('qa-residue-leads', `SELECT id,contact_name,address,created_at FROM leads WHERE tenant_id=$1 AND (contact_name ILIKE '%qa%' OR contact_name ILIKE '%test%' OR address ILIKE '%test%' OR address ILIKE '%QA%') ORDER BY created_at DESC LIMIT 20`);
await q('qa-residue-est', `SELECT id,estimate_number,customer_name,created_at FROM estimates WHERE tenant_id=$1 AND (customer_name ILIKE '%qa%' OR customer_name ILIKE '%test%') ORDER BY created_at DESC LIMIT 20`);
await q('max-est', `SELECT max(estimate_number) FROM estimates WHERE tenant_id=$1`);
await pool.end();
