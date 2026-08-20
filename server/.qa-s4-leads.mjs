import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const r=await pool.query(`SELECT id,contact_name,address,city,stage,created_at::date d FROM leads WHERE tenant_id=$1 ORDER BY created_at`,[T]);
r.rows.forEach((x,i)=>console.log(String(i+1).padStart(2),x.d,JSON.stringify(x.contact_name),'|',JSON.stringify(x.address),'|',JSON.stringify(x.city),"|",x.stage));
await pool.end();
