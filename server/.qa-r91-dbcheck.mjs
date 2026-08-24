import pool from './src/db/pool.js';
const q = async (s,p=[]) => (await pool.query(s,p)).rows;
const counts = {};
for (const t of ['estimates','invoices','work_orders','tasks','leads','contracts','expenses','work_order_milestones','contacts']) {
  counts[t] = (await q(`SELECT count(*)::int n FROM ${t}`))[0].n;
}
console.log('row counts:', JSON.stringify(counts));
const nulls = (await q(`SELECT count(*)::int n FROM work_order_milestones WHERE completed IS NULL`))[0].n;
const done  = (await q(`SELECT count(*)::int n FROM work_order_milestones WHERE completed = true`))[0].n;
console.log(`milestones completed IS NULL: ${nulls} (must be 0);  completed=true: ${done}`);
const recent = await q(`SELECT 'estimates' t, created_at FROM estimates WHERE created_at > NOW() - INTERVAL '2 hours'
  UNION ALL SELECT 'invoices', created_at FROM invoices WHERE created_at > NOW() - INTERVAL '2 hours'
  UNION ALL SELECT 'tasks', created_at FROM tasks WHERE created_at > NOW() - INTERVAL '2 hours'
  UNION ALL SELECT 'expenses', created_at FROM expenses WHERE created_at > NOW() - INTERVAL '2 hours'
  UNION ALL SELECT 'work_orders', created_at FROM work_orders WHERE created_at > NOW() - INTERVAL '2 hours'`);
console.log('rows created in last 2h:', recent.length, JSON.stringify(recent));
const qa = await q(`SELECT count(*)::int n FROM estimates WHERE customer_name ILIKE '%QA Test%' OR notes ILIKE '%QA Test Shingle%'`);
console.log('stray QA estimates:', qa[0].n);
await pool.end();
