import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const q=async(l,s,p=[T])=>{try{const r=await pool.query(s,p);console.log(l,JSON.stringify(r.rows));}catch(e){console.log(l,'ERR',e.code,e.message);}};
await q('counts',`SELECT 'leads' t,count(*)::int c FROM leads WHERE tenant_id=$1
 UNION ALL SELECT 'estimates',count(*)::int FROM estimates WHERE tenant_id=$1
 UNION ALL SELECT 'invoices',count(*)::int FROM invoices WHERE tenant_id=$1
 UNION ALL SELECT 'contracts',count(*)::int FROM contracts WHERE tenant_id=$1
 UNION ALL SELECT 'work_orders',count(*)::int FROM work_orders WHERE tenant_id=$1
 UNION ALL SELECT 'tasks',count(*)::int FROM tasks WHERE tenant_id=$1
 UNION ALL SELECT 'activities',count(*)::int FROM activities WHERE tenant_id=$1
 UNION ALL SELECT 'payments',count(*)::int FROM payments WHERE tenant_id=$1`);
await q('recent leads',`SELECT contact_name,address,created_at FROM leads WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 8`);
await q('recent ests',`SELECT estimate_number,customer_name,status,created_at FROM estimates WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 12`);
await q('recent contracts',`SELECT id,contract_number,template_type,status,created_at FROM contracts WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 8`);
await pool.end();
