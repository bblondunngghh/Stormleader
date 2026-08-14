import pool from './src/db/pool.js';
const tbl = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%activit%' OR table_name ILIKE '%stage%' OR table_name ILIKE '%histor%' OR table_name ILIKE '%event%')`);
console.log('candidate tables:', tbl.rows.map(r=>r.table_name).join(', '));
for (const n of ['lead_activities','lead_stage_history','activities']) {
  try {
    const c = await pool.query(`SELECT column_name,data_type FROM information_schema.columns WHERE table_name=$1`,[n]);
    if (c.rows.length) console.log(`\n${n}:`, c.rows.map(r=>r.column_name).join(', '));
    const t = await pool.query(`SELECT type, COUNT(*) FROM ${n} GROUP BY type ORDER BY 2 DESC LIMIT 12`).catch(()=>null);
    if (t) console.table(t.rows);
  } catch(e) {}
}
await pool.end();
