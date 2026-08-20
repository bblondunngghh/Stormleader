import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const r=await pool.query(`SELECT c.id, c.template_type, c.status, c.lead_id, l.contact_name, l.address,
  c.content->>'customer_name' AS content_customer
  FROM contracts c LEFT JOIN leads l ON l.id=c.lead_id WHERE c.tenant_id=$1 ORDER BY c.created_at`,[T]);
r.rows.forEach(x=>console.log(JSON.stringify(x)));
console.log('--- tasks ---');
const t=await pool.query(`SELECT id,title,status,priority,due_date FROM tasks WHERE tenant_id=$1`,[T]);
t.rows.forEach(x=>console.log(JSON.stringify(x)));
await pool.end();
