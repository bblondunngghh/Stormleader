import pool from './src/db/pool.js';
const { rows } = await pool.query(
  `SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND data_type IN ('jsonb','json')
    ORDER BY table_name, column_name`);
console.log(`JSON/JSONB columns: ${rows.length}`);
for (const r of rows) {
  let stat = '';
  try {
    const q = await pool.query(
      `SELECT count(*)::int total,
        count(*) FILTER (WHERE ${r.column_name} IS NOT NULL)::int nonnull,
        (SELECT jsonb_typeof(${r.column_name}::jsonb) FROM ${r.table_name} WHERE ${r.column_name} IS NOT NULL LIMIT 1) sampletype
       FROM ${r.table_name}`);
    const s = q.rows[0];
    stat = `rows=${s.total} nonnull=${s.nonnull} type=${s.sampletype||'-'}`;
  } catch (e) { stat = 'ERR ' + e.message.slice(0,60); }
  console.log(`${r.table_name}.${r.column_name} [${r.data_type}] ${stat}`);
}
await pool.end();
