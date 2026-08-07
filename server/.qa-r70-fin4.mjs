import pool from './src/db/pool.js';
const { rows } = await pool.query(
  `SELECT name, term_months, apr, min_amount, max_amount FROM financing_plans ORDER BY term_months LIMIT 5`);
console.log('plan amount ranges (integer col):');
rows.forEach(r=>console.log('  ',r.name,'| min',r.min_amount,'| max',r.max_amount,
  '=> as CENTS: $'+(r.min_amount/100)+' - $'+(r.max_amount/100),
  '| as DOLLARS: $'+r.min_amount+' - $'+r.max_amount));
await pool.end();
