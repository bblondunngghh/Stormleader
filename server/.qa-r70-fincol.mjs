import pool from './src/db/pool.js';
const r = await pool.query(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE (table_name='financing_applications' AND column_name='amount')
     OR (table_name='estimates' AND column_name='total')
     OR (table_name='financing_plans' AND column_name IN ('min_amount','max_amount'))
  ORDER BY table_name, column_name`);
console.table(r.rows);
await pool.end();
