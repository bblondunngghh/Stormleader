import pool from './src/db/pool.js';
const c=await pool.connect();
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const u=(await c.query(`SELECT id FROM users WHERE tenant_id=$1 LIMIT 1`,[T])).rows[0].id;
const lead=(await c.query(`SELECT id FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL LIMIT 1`,[T])).rows[0].id;
const tries=[
 ["automationEngine.js:116  type='automation'",    `INSERT INTO notifications (tenant_id,user_id,type,title,body,reference_type,reference_id) VALUES ($1,$2,'automation','t',null,'lead',$3)`],
 ["dripService.js:357       type='drip_sequence'", `INSERT INTO notifications (tenant_id,user_id,type,title,body,reference_type,reference_id) VALUES ($1,$2,'drip_sequence','t',null,'lead',$3)`],
 ["impactedAssetService:49  type='storm_alert'",   `INSERT INTO notifications (tenant_id,user_id,type,title,body,reference_type,reference_id) VALUES ($1,$2,'storm_alert','t',null,'lead',$3)`],
];
for(const [label,sql] of tries){
  await c.query('BEGIN');
  try{ await c.query(sql,[T,u,lead]); console.log('OK     ',label); }
  catch(e){ console.log('FAIL   ',label,'->',e.code,e.message.slice(0,80)); }
  await c.query('ROLLBACK');
}
c.release(); await pool.end();
