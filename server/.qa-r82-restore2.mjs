import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const q=async(l,sql,p=[])=>{try{const r=await pool.query(sql,p);console.log('##',l,`rows=${r.rowCount}`);console.log(JSON.stringify(r.rows).slice(0,700));}catch(e){console.log('##',l,'ERR',e.code,e.message.slice(0,80));}};
await q('estimates left', `SELECT estimate_number,id FROM estimates WHERE tenant_id=$1 ORDER BY estimate_number`,[T]);
await q('work orders', `SELECT id,status,completed_at,created_at::date d FROM work_orders WHERE tenant_id=$1 ORDER BY created_at`,[T]);
const c=await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tenants'`);
console.log('## tenants cols:', c.rows.map(r=>r.column_name).join(','));
await q('tenant row', `SELECT * FROM tenants WHERE id=$1`,[T]);
await pool.end();
