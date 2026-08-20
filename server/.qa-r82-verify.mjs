import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const r=await pool.query(`SELECT 'leads(active)' t,count(*)::int c FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL
 UNION ALL SELECT 'estimates',count(*)::int FROM estimates WHERE tenant_id=$1
 UNION ALL SELECT 'invoices',count(*)::int FROM invoices WHERE tenant_id=$1
 UNION ALL SELECT 'work_orders pending',count(*)::int FROM work_orders WHERE tenant_id=$1 AND status='pending'
 UNION ALL SELECT 'work_orders completed',count(*)::int FROM work_orders WHERE tenant_id=$1 AND status='completed'
 UNION ALL SELECT 'subcontractors',count(*)::int FROM subcontractors WHERE tenant_id=$1
 UNION ALL SELECT 'EST-001 viewed',count(*)::int FROM estimates WHERE id='6134f939-317b-4596-bc69-1a2d622ec563' AND status='viewed'`,[T]);
console.log(r.rows.map(x=>`${x.t}=${x.c}`).join('  '));
const s=await pool.query(`SELECT id FROM subcontractors WHERE id='46d2541b-fa55-4019-b0fb-a6fcb80645a7'`);
console.log('subcontractor 46d2541b still present:', s.rowCount===1);
await pool.end();
