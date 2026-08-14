import pool from './src/db/pool.js';
const { rows } = await pool.query(`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema='public' AND (column_name LIKE '%token%')
  ORDER BY table_name`);
for (const r of rows) {
  const { rows:[c] } = await pool.query(
    `SELECT COUNT(*)::int n, COUNT(${r.column_name})::int nn FROM ${r.table_name}`);
  console.log(`${r.table_name}.${r.column_name} rows=${c.n} nonnull=${c.nn}`);
}
await pool.end();
