import pool from './src/db/pool.js';
const { rows: t } = await pool.query(`SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name LIKE '%milestone%' OR table_name LIKE '%checklist%'`);
console.log('tables:', t.map(x=>x.table_name).join(', ') || '(none)');
for (const { table_name } of t) {
  const { rows: c } = await pool.query(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name=$1 ORDER BY ordinal_position`, [table_name]);
  console.log(`\n${table_name}:`, c.map(x=>x.column_name).join(', '));
  const { rows: n } = await pool.query(`SELECT count(*)::int n FROM ${table_name}`);
  console.log('  rows:', n[0].n);
}
// dual-state contradiction check on milestones if both columns exist
const { rows: has } = await pool.query(`SELECT count(*)::int n FROM information_schema.columns
  WHERE table_name='work_order_milestones' AND column_name IN ('status','completed_at')`);
if (has[0].n === 2) {
  const { rows: x } = await pool.query(`SELECT
     count(*) FILTER (WHERE status='completed' AND completed_at IS NULL)::int AS done_no_ts,
     count(*) FILTER (WHERE status<>'completed' AND completed_at IS NOT NULL)::int AS ts_not_done
     FROM work_order_milestones`);
  console.log('\nmilestone contradictions:', JSON.stringify(x[0]));
}
await pool.end();
