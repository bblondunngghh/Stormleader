import pool from './src/db/pool.js';
const { rows } = await pool.query(
  `SELECT invoice_number, amount_paid, payment_method, payment_reference
   FROM invoices WHERE invoice_number IN ('INV-0007','INV-0014') ORDER BY invoice_number`);
console.log(JSON.stringify(rows, null, 1));
await pool.end();
