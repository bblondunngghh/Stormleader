// Which of the 20 paginated queries actually TIE in real data — and therefore
// actually lose rows when paged? Measure, don't assume.
import pool from './src/db/pool.js';

const TENANT = (await pool.query(`SELECT id FROM tenants WHERE slug='waterloo'`)).rows[0].id;

// table, sort expression as the service orders it, service:line
const CASES = [
  ['storm_alerts_sent',   'sent_at',                       'alertService.js:167', 'tenant_id'],
  ['contracts',           'created_at',                    'contractService.js:27', 'tenant_id'],
  ['activities',          'created_at',                    'crmService.js:335', 'tenant_id'],
  ['tasks',               'completed_at, due_date',        'crmService.js:378', 'tenant_id'],
  ['documents',           'created_at',                    'documentService.js:23', 'tenant_id'],
  ['estimates',           'created_at',                    'estimateService.js:103', 'tenant_id'],
  ['expenses',            'date, created_at',              'expenseService.js:29', 'tenant_id'],
  ['invoices',            'created_at',                    'invoiceService.js:19', 'tenant_id'],
  ['leads',               'created_at',                    'leadService.js:214', 'tenant_id'],
  ['notifications',       'created_at',                    'notificationService.js:65', 'tenant_id'],
  ['subcontractors',      'name',                          'subcontractorService.js:24', 'tenant_id'],
  ['work_orders',         'created_at',                    'workOrderService.js:257', 'tenant_id'],
  ['material_orders',     'created_at',                    'materials.js:620', 'tenant_id'],
  ['payments',            'created_at',                    'payments.js:275', 'tenant_id'],
];

console.log('table                | rows | tiedGroups | rowsInTies | worstGroup | site');
console.log('---------------------+------+------------+------------+------------+------');
const findings = [];
for (const [table, sortExpr, site, tcol] of CASES) {
  try {
    const tot = (await pool.query(
      `SELECT COUNT(*) c FROM ${table} WHERE ${tcol}=$1`, [TENANT])).rows[0].c;
    const q = await pool.query(
      `SELECT COUNT(*) AS groups, COALESCE(SUM(n),0) AS rows_in_ties, COALESCE(MAX(n),0) AS worst
         FROM (SELECT COUNT(*) n FROM ${table} WHERE ${tcol}=$1
                GROUP BY ${sortExpr} HAVING COUNT(*) > 1) s`, [TENANT]);
    const r = q.rows[0];
    console.log(
      `${table.padEnd(20)} | ${String(tot).padStart(4)} | ${String(r.groups).padStart(10)} | ` +
      `${String(r.rows_in_ties).padStart(10)} | ${String(r.worst).padStart(10)} | ${site}`);
    if (Number(r.groups) > 0) findings.push({ table, sortExpr, site, total: Number(tot),
      groups: Number(r.groups), rowsInTies: Number(r.rows_in_ties), worst: Number(r.worst) });
  } catch (e) {
    console.log(`${table.padEnd(20)} | ERROR ${e.message.slice(0, 60)}  (${site})`);
  }
}

console.log('\n=== TABLES WHOSE PAGINATION SORT KEY IS NOT UNIQUE IN REAL DATA ===');
for (const f of findings)
  console.log(`  ${f.table}: ${f.groups} tie group(s), ${f.rowsInTies} of ${f.total} rows tied, ` +
              `worst group ${f.worst}  ->  ${f.site} ORDER BY ${f.sortExpr}`);

// Cross-tenant view: is this only the QA tenant, or every tenant?
console.log('\n=== tasks ties per tenant (is this QA-only or global?) ===');
const per = await pool.query(
  `SELECT t.slug, COUNT(*) AS tied FROM tasks k JOIN tenants t ON t.id=k.tenant_id
    WHERE (k.completed_at, k.due_date) IN (
      SELECT completed_at, due_date FROM tasks WHERE tenant_id=k.tenant_id
       GROUP BY completed_at, due_date HAVING COUNT(*)>1)
    GROUP BY t.slug ORDER BY tied DESC`);
for (const r of per.rows) console.log(`  ${r.slug}: ${r.tied} rows sitting in a tie group`);

await pool.end();
