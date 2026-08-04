import pool from './src/db/pool.js';
const { rows } = await pool.query(
  `SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND data_type IN ('jsonb','json')
    ORDER BY table_name, column_name`);
console.log(`JSON/JSONB columns in schema: ${rows.length}`);
// which ones actually hold ARRAYS anywhere, and do any hold non-object elements?
for (const r of rows) {
  try {
    const q = await pool.query(
      `SELECT count(*)::int total,
              count(*) FILTER (WHERE jsonb_typeof(${r.column_name}::jsonb)='array')::int arrays,
              count(*) FILTER (WHERE jsonb_typeof(${r.column_name}::jsonb)='array'
                AND EXISTS (SELECT 1 FROM jsonb_array_elements(${r.column_name}::jsonb) e
                            WHERE jsonb_typeof(e) NOT IN ('object')))::int nonobj
         FROM ${r.table_name} WHERE ${r.column_name} IS NOT NULL`);
    const s = q.rows[0];
    if (s.arrays > 0) {
      const flag = s.nonobj > 0 ? `  <<< ${s.nonobj} ROW(S) WITH NON-OBJECT ELEMENTS` : '';
      console.log(`  ${r.table_name}.${r.column_name}  rows=${s.total} arrays=${s.arrays} nonObjElems=${s.nonobj}${flag}`);
    }
  } catch (e) { /* not castable / table empty */ }
}
await pool.end();
