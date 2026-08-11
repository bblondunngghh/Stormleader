import pool from './src/db/pool.js';
const { rows: x } = await pool.query(`SELECT
   count(*)::int AS total,
   count(*) FILTER (WHERE completed AND completed_at IS NULL)::int      AS done_but_no_timestamp,
   count(*) FILTER (WHERE NOT completed AND completed_at IS NOT NULL)::int AS timestamp_but_not_done
   FROM work_order_milestones`);
console.log('work_order_milestones:', JSON.stringify(x[0]));
console.log('\nwhich column does the UI ratio count? checking a known WO (QA72 WO title = 1/5):');
const { rows: w } = await pool.query(
  `SELECT m.name, m.completed, m.completed_at IS NOT NULL AS ts
   FROM work_order_milestones m JOIN work_orders w ON w.id=m.work_order_id
   WHERE w.title='QA72 WO title' ORDER BY m.sort_order`);
console.table(w);
await pool.end();
