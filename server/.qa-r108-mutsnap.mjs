// Snapshot max(updated_at) + row count per table. Run 100 §3: a count(*) snapshot
// CANNOT see an UPDATE, so "0 row drift" is not "0 writes".
import fs from 'fs';
import pool from './src/db/pool.js';
const out = process.argv[2];
const tables = (await pool.query(
  `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows;
const snap = {};
for (const { tablename } of tables) {
  const hasUpd = (await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name=$1 AND column_name='updated_at'`, [tablename])).rowCount;
  try {
    const q = hasUpd
      ? `SELECT count(*)::int n, max(updated_at)::text u FROM "${tablename}"`
      : `SELECT count(*)::int n, NULL::text u FROM "${tablename}"`;
    snap[tablename] = (await pool.query(q)).rows[0];
  } catch (e) { snap[tablename] = { err: e.code }; }
}
fs.writeFileSync(out, JSON.stringify(snap, null, 1));
console.log(`snapshot -> ${out}  (${Object.keys(snap).length} tables)`);
await pool.end();
