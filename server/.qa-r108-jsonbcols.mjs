import pool from './src/db/pool.js';
const { rows } = await pool.query(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='public' AND data_type IN ('jsonb','json')
  ORDER BY table_name, column_name`);
console.log(`${rows.length} json/jsonb columns`);
for (const r of rows) console.log(`  ${r.table_name}.${r.column_name} (${r.data_type})`);
await pool.end();
