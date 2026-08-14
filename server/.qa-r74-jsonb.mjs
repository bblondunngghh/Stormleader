import pool from './src/db/pool.js';
const { rows } = await pool.query(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='public' AND data_type IN ('jsonb','json')
  ORDER BY table_name, column_name`);
console.log('TOTAL JSONB/JSON columns:', rows.length);
for (const r of rows) {
  const { rows: [c] } = await pool.query(
    `SELECT COUNT(*)::int AS n, COUNT(${r.column_name})::int AS nonnull FROM ${r.table_name}`);
  console.log(`${r.table_name}.${r.column_name} [${r.data_type}] rows=${c.n} nonnull=${c.nonnull}`);
}
await pool.end();
