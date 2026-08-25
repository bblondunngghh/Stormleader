import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
for(const t of ['contract_templates','financing_lenders','financing_plans','estimate_templates']){
  const {rows}=await pool.query(`SELECT id, tenant_id FROM "${t}" LIMIT 6`);
  console.log(t, JSON.stringify(rows.map(r=>({id:r.id.slice(0,8), tid: r.tenant_id===null?'NULL':(r.tenant_id===T?'OURS':r.tenant_id.slice(0,8))}))));
}
// matched work_order + milestone pair belonging to our tenant
const {rows:m}=await pool.query(`SELECT wom.id AS mid, wo.id AS woid FROM work_order_milestones wom JOIN work_orders wo ON wo.id=wom.work_order_id WHERE wo.tenant_id=$1 LIMIT 1`,[T]);
console.log('matched wo/milestone:', JSON.stringify(m));
await pool.end();
