import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const SEL=`SELECT id FROM leads WHERE tenant_id='${T}' AND (
  contact_name IN ('DELETE ME','empty-priority probe','true','12345','{"x","y"}','{"nested":{"deep":1}}')
  OR address IN ('456 Test Ave','123 QA St','777 QA Test Rd','888 QA Path','true','12345','{"x","y"}','{"nested":{"deep":1}}')
  OR address ILIKE 'qa2026%'
  OR (contact_name IS NULL AND address IS NULL AND city IS NULL))`;
const r=await pool.query(`SELECT id,contact_name,address,stage FROM leads WHERE id IN (${SEL})`);
console.log('MATCHED', r.rows.length);
for (const [t,col] of [['estimates','lead_id'],['contracts','lead_id'],['invoices','lead_id'],['work_orders','lead_id'],['tasks','lead_id'],['activities','lead_id'],['contacts','lead_id'],['expenses','lead_id'],['documents','lead_id'],['financing_applications','lead_id'],['drip_enrollments','lead_id']]) {
  try{const c=await pool.query(`SELECT count(*)::int n FROM ${t} WHERE ${col} IN (${SEL})`);console.log('  dependents',t,c.rows[0].n);}catch(e){console.log('  dependents',t,'ERR',e.code);}
}
await pool.end();
