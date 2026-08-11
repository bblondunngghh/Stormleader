import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const { rows } = await pool.query(
  `SELECT invoice_number, status, total, amount_paid, to_char(paid_at,'YYYY-MM-DD') AS paid_at
   FROM invoices WHERE tenant_id=$1 AND status <> 'paid' AND paid_at IS NOT NULL`, [T]);
console.table(rows);
const { rows: all } = await pool.query(
  `SELECT status, count(*)::int n FROM invoices WHERE tenant_id=$1 GROUP BY status ORDER BY 2 DESC`, [T]);
console.table(all);
await pool.end();
