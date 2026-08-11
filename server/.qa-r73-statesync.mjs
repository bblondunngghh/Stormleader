import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
// Tables that store a state BOTH as a status column and as an event timestamp.
const { rows: cols } = await pool.query(`
  SELECT table_name, string_agg(column_name, ',' ORDER BY column_name) AS cols
  FROM information_schema.columns
  WHERE table_schema='public'
    AND column_name IN ('status','completed_at','paid_at','sent_at','accepted_at','signed_at','cancelled_at','approved_at','closed_at','voided_at')
  GROUP BY table_name HAVING string_agg(column_name,',') LIKE '%status%'
  ORDER BY table_name`);
console.log('tables storing state twice:');
for (const c of cols) console.log('  ', c.table_name.padEnd(24), c.cols);

const checks = [
  ['invoices',      'status',  'paid_at',      `status <> 'paid'  AND paid_at IS NOT NULL`],
  ['invoices',      'status',  'paid_at',      `status =  'paid'  AND paid_at IS NULL`],
  ['estimates',     'status',  'sent_at',      `status =  'sent'  AND sent_at IS NULL`],
  ['estimates',     'status',  'accepted_at',  `status <> 'accepted' AND accepted_at IS NOT NULL`],
  ['work_orders',   'status',  'completed_at', `status <> 'completed' AND completed_at IS NOT NULL`],
  ['work_orders',   'status',  'completed_at', `status =  'completed' AND completed_at IS NULL`],
  ['contracts',     'status',  'signed_at',    `status <> 'signed' AND signed_at IS NOT NULL`],
  ['contracts',     'status',  'signed_at',    `status =  'signed' AND signed_at IS NULL`],
];
console.log('\ncontradictory rows (tenant-scoped where possible):');
for (const [tbl, s, ts, pred] of checks) {
  try {
    const { rows } = await pool.query(`SELECT count(*)::int n FROM ${tbl} WHERE tenant_id=$1 AND ${pred}`,[T]);
    const flag = rows[0].n > 0 ? '  <-- CONTRADICTION' : '';
    console.log(`  ${tbl.padEnd(13)} ${pred.padEnd(46)} n=${rows[0].n}${flag}`);
  } catch (e) { console.log(`  ${tbl.padEnd(13)} ${pred.padEnd(46)} SKIP (${e.message.split('\n')[0].slice(0,45)})`); }
}
await pool.end();
