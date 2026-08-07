import pool from './src/db/pool.js';
const { rows } = await pool.query(
  `SELECT fa.id, fa.plan_id, fa.status, fa.amount, fa.customer_name, fp.name plan
   FROM financing_applications fa JOIN financing_plans fp ON fp.id=fa.plan_id ORDER BY fa.created_at`);
rows.forEach(r=>console.log('  ',r.plan,'| amount(cents)',r.amount,'= $'+(r.amount/100),'|',r.status,'|',r.customer_name));
console.log('total rows:',rows.length);
await pool.end();
