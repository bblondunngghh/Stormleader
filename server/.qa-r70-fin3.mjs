import pool from './src/db/pool.js';
const { rows } = await pool.query(`SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name='financing_applications' ORDER BY ordinal_position`);
console.log('financing_applications:'); rows.forEach(r=>console.log('  ',r.column_name,'|',r.data_type));
const { rows: p } = await pool.query(`SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name='financing_plans' AND column_name IN ('min_amount','max_amount')`);
console.log('financing_plans amounts:'); p.forEach(r=>console.log('  ',r.column_name,'|',r.data_type));
const { rows: e } = await pool.query(`SELECT total, pg_typeof(total)::text FROM estimates WHERE financing_enabled=true`);
console.log('estimate.total:', JSON.stringify(e));
await pool.end();
