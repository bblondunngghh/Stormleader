// Run 75 s4 — scoped cleanup of user-visible QA residue. Carried open since s2.
// Run with DRY=1 to print the plan without writing.
//
// Design decisions:
//  - LEADS are SOFT-deleted (deleted_at = NOW()), which is exactly what the app's own
//    DELETE route does (crmService.js:163) and what every read path filters on. A hard
//    delete would CASCADE into activities/contacts/client_status_tokens and is
//    irreversible; the soft delete removes them from leads, pipeline, dashboard and
//    reports, which is the actual goal.
//  - Today's s1 harness rows (12 estimates, 3 invoices, 3 work orders) are HARD deleted.
//    They were verified to have ZERO child rows and s1 intended to delete them already.
//  - INV-0016 and work order 'test' belong exclusively to QA probe lead d9573041; without
//    removing them the soft-deleted lead would leave orphans visible on /invoices.
import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const DRY = process.env.DRY === '1';
const tag = DRY ? '[DRY]' : '[WRITE]';

const FUZZ_LEADS = [
  ['faa045f7-90c3-412b-828a-01be9e68980c', 'QA Test Lead'],
  ['d9573041-95c8-4369-97d7-6f1c0ab7399d', 'QA Probe Run 10 1777197905'],
  ['d98bbf56-9150-4b54-a379-9296a3cc11b3', 'QA Run 13 Probe'],
  ['e25ad9f6-f3dc-4ca7-a5da-63b6c3ee6d14', 'empty-priority probe'],
  ['2170531d-4309-41c4-ba0b-9cef4a9cad2e', 'address {"x","y"}'],
  ['088823f1-d1e0-4cad-8e21-2208cf47c52b', 'address {"nested":{"deep":1}}'],
  ['e8dfa02c-2722-4965-b53a-5d58e6007bbd', 'address 12345'],
  ['a49da0d8-2ab1-4003-b740-83a31a2e90cf', 'address true'],
];

const before = {
  leads_live: (await pool.query(`SELECT count(*)::int c FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL`, [T])).rows[0].c,
  estimates: (await pool.query(`SELECT count(*)::int c FROM estimates WHERE tenant_id=$1`, [T])).rows[0].c,
  invoices: (await pool.query(`SELECT count(*)::int c FROM invoices WHERE tenant_id=$1`, [T])).rows[0].c,
  work_orders: (await pool.query(`SELECT count(*)::int c FROM work_orders WHERE tenant_id=$1`, [T])).rows[0].c,
  tasks: (await pool.query(`SELECT count(*)::int c FROM tasks WHERE tenant_id=$1`, [T])).rows[0].c,
};
console.log('BEFORE', JSON.stringify(before));

// `countSql` is written out explicitly rather than derived from `sql` — deriving it by
// regex silently mis-parsed `SET deleted_at = NOW() WHERE` and counted the wrong rows.
const run = async (label, sql, countSql, params) => {
  const { rows } = await pool.query(countSql, params);
  if (DRY) {
    console.log(`${tag} ${label}: would affect ${rows[0].c}`);
    return 0;
  }
  const r = await pool.query(sql, params);
  console.log(`${tag} ${label}: ${r.rowCount} (predicted ${rows[0].c})`);
  return r.rowCount;
};

// A. soft-delete the 8 fuzz leads
const ids = FUZZ_LEADS.map(l => l[0]);
FUZZ_LEADS.forEach(([id, why]) => console.log(`   lead ${id}  <- ${why}`));
await run('A. soft-delete fuzz leads',
  `UPDATE leads SET deleted_at = NOW() WHERE tenant_id=$1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`,
  `SELECT count(*)::int c FROM leads WHERE tenant_id=$1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`, [T, ids]);

// B. hard-delete today's s1 harness residue (verified zero children)
await run('B1. delete estimates created today',
  `DELETE FROM estimates WHERE tenant_id=$1 AND created_at > '2026-08-14'`,
  `SELECT count(*)::int c FROM estimates WHERE tenant_id=$1 AND created_at > '2026-08-14'`, [T]);
await run('B2. delete invoices created today',
  `DELETE FROM invoices WHERE tenant_id=$1 AND created_at > '2026-08-14'`,
  `SELECT count(*)::int c FROM invoices WHERE tenant_id=$1 AND created_at > '2026-08-14'`, [T]);
await run('B3. delete work_orders created today',
  `DELETE FROM work_orders WHERE tenant_id=$1 AND created_at > '2026-08-14'`,
  `SELECT count(*)::int c FROM work_orders WHERE tenant_id=$1 AND created_at > '2026-08-14'`, [T]);

// C. orphans that would survive the soft-delete of lead d9573041
await run('C1. delete INV-0016 (total 0.00, on QA probe lead)',
  `DELETE FROM invoices WHERE tenant_id=$1 AND invoice_number='INV-0016' AND lead_id='d9573041-95c8-4369-97d7-6f1c0ab7399d'`,
  `SELECT count(*)::int c FROM invoices WHERE tenant_id=$1 AND invoice_number='INV-0016' AND lead_id='d9573041-95c8-4369-97d7-6f1c0ab7399d'`, [T]);
await run("C2. delete work order 'test' (on QA probe lead)",
  `DELETE FROM work_orders WHERE tenant_id=$1 AND title='test' AND lead_id='d9573041-95c8-4369-97d7-6f1c0ab7399d'`,
  `SELECT count(*)::int c FROM work_orders WHERE tenant_id=$1 AND title='test' AND lead_id='d9573041-95c8-4369-97d7-6f1c0ab7399d'`, [T]);

// D. the one QA task
await run("D. delete task 'QA72 verify task write'",
  `DELETE FROM tasks WHERE tenant_id=$1 AND title='QA72 verify task write'`,
  `SELECT count(*)::int c FROM tasks WHERE tenant_id=$1 AND title='QA72 verify task write'`, [T]);

const after = {
  leads_live: (await pool.query(`SELECT count(*)::int c FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL`, [T])).rows[0].c,
  estimates: (await pool.query(`SELECT count(*)::int c FROM estimates WHERE tenant_id=$1`, [T])).rows[0].c,
  invoices: (await pool.query(`SELECT count(*)::int c FROM invoices WHERE tenant_id=$1`, [T])).rows[0].c,
  work_orders: (await pool.query(`SELECT count(*)::int c FROM work_orders WHERE tenant_id=$1`, [T])).rows[0].c,
  tasks: (await pool.query(`SELECT count(*)::int c FROM tasks WHERE tenant_id=$1`, [T])).rows[0].c,
};
console.log('AFTER ', JSON.stringify(after));

// residual junk check
const left = await pool.query(
  `SELECT address, count(*)::int n FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL
     AND (address IS NULL OR address !~ '[0-9]+ +[A-Za-z]') GROUP BY 1 ORDER BY 2 DESC`, [T]);
console.log('REMAINING non-street addresses (live leads):', JSON.stringify(left.rows));
await pool.end();
