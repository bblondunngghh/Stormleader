import jwt from 'jsonwebtoken';
import pool from './src/db/pool.js';
const BASE='http://localhost:3098', SECRET='qa-r67-known-secret';
const A='791bb51d-3293-4839-92e9-bd4d4f873af2', B='e3961fce-802b-4c68-99c0-1f52bcaabe20';
const RANDOM='00000000-0000-4000-8000-000000000000';
const us=await pool.query(`SELECT id,email,tenant_id,role FROM users WHERE tenant_id=ANY($1)`,[[A,B]]);
const ub=us.rows.find(u=>u.tenant_id===B);
const tokB=jwt.sign({id:ub.id,tenantId:ub.tenant_id,email:ub.email,role:ub.role},SECRET,{expiresIn:'1h'});
const wo=(await pool.query(`SELECT id FROM work_orders WHERE tenant_id=$1 LIMIT 1`,[A])).rows[0];
const hit=async(p)=>{const r=await fetch(BASE+p,{headers:{Authorization:`Bearer ${tokB}`}});return r.status+' '+(await r.text()).slice(0,80);};
console.log('subcontractors/work-order  A-owned id  ->', await hit(`/api/crm/subcontractors/work-order/${wo.id}`));
console.log('subcontractors/work-order  random uuid ->', await hit(`/api/crm/subcontractors/work-order/${RANDOM}`));
// why were 10 routes skipped? do those tables even have tenant_id, and does ANY tenant hold rows?
console.log('\nSKIPPED-TABLE DIAGNOSIS (why no tenant-A row):');
for (const t of ['territories','drip_sequences','financing_applications','documents','properties','skip_trace_usage','automations','custom_field_definitions']) {
  try {
    const col=await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name='tenant_id'`,[t]);
    const tot=await pool.query(`SELECT count(*)::int n FROM ${t}`);
    const mine=col.rowCount?(await pool.query(`SELECT count(*)::int n FROM ${t} WHERE tenant_id=$1`,[A])).rows[0].n:'n/a';
    console.log(`  ${t.padEnd(24)} tenant_id col: ${col.rowCount?'YES':'NO '}   total rows: ${String(tot.rows[0].n).padEnd(7)} tenantA rows: ${mine}`);
  } catch(e){ console.log(`  ${t.padEnd(24)} TABLE MISSING (${e.code})`); }
}
await pool.end();
