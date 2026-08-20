import pool from './src/db/pool.js';
const c=await pool.connect();
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const lead=(await c.query(`SELECT id FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL LIMIT 1`,[T])).rows[0].id;
const tries=[
 ['EXACT statement from financing/index.js:291',
  `INSERT INTO activities (tenant_id, lead_id, type, direction, notes, created_by) VALUES ($1,$2,'financing','inbound',$3,NULL)`],
 ['drop direction+created_by, keep type=financing',
  `INSERT INTO activities (tenant_id, lead_id, type, notes) VALUES ($1,$2,'financing',$3)`],
 ['valid enum label (note)',
  `INSERT INTO activities (tenant_id, lead_id, type, notes) VALUES ($1,$2,'note',$3)`],
];
for(const [label,sql] of tries){
  await c.query('BEGIN');
  try{ await c.query(sql,[T,lead,'QA probe — rolled back']); console.log('OK     ',label); }
  catch(e){ console.log('FAIL   ',label,'->',e.code,e.message.slice(0,90)); }
  await c.query('ROLLBACK');
}
c.release(); await pool.end();
