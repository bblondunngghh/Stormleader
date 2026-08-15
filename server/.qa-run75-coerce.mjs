// Run 75 s1 — P1: "create coerces / update does not" sweep across ALL entities.
// Family #1, 3rd appearance (ea15a50 estimates, 8a45209 work orders). Run 74 deferred
// this sweep explicitly ("not yet swept across all entities — do this next run").
//
// METHOD: real ids only. A dead uuid 404s BEFORE handler logic, so it cannot see this bug.
// The probe sends '' for each nullable non-text column named in the service's allowedFields.
// A '' into a uuid/date/numeric column is Postgres 22P02. The question this answers is
// whether that surfaces as a graceful 400 or a hard 500.
//
// STRUCTURALLY UNABLE TO FIND: fields not in allowedFields; columns whose '' is legal (text).
import fs from 'fs';
import pool from './src/db/pool.js';
import { req, mint } from './.qa-r73-lib.mjs';

const TENANT = '791bb51d-3293-4839-92e9-bd4d4f873af2';
await mint();

const one = async (sql) => {
  try { return (await pool.query(sql, [TENANT])).rows[0]?.id ?? null; }
  catch (e) { console.log('  resolver skip:', e.message.slice(0, 80)); return null; }
};

const ids = {
  invoice:       await one(`SELECT id FROM invoices WHERE tenant_id=$1 LIMIT 1`),
  expense:       await one(`SELECT id FROM expenses WHERE tenant_id=$1 LIMIT 1`),
  subcontractor: await one(`SELECT id FROM subcontractors WHERE tenant_id=$1 LIMIT 1`),
  workOrder:     await one(`SELECT id FROM work_orders WHERE tenant_id=$1 LIMIT 1`),
  estimate:      await one(`SELECT id FROM estimates WHERE tenant_id=$1 LIMIT 1`),
  contract:      await one(`SELECT id FROM contracts WHERE tenant_id=$1 LIMIT 1`),
  task:          await one(`SELECT id FROM tasks WHERE tenant_id=$1 LIMIT 1`),
  dripseq:       await one(`SELECT id FROM drip_sequences WHERE tenant_id=$1 LIMIT 1`),
  lead:          await one(`SELECT id FROM leads WHERE tenant_id=$1 LIMIT 1`),
};
console.log('ids:', Object.entries(ids).map(([k, v]) => `${k}=${v ? 'Y' : 'NULL'}`).join(' '));

// [label, method, path template, field, entity key]
// Fields are the NULLABLE NON-TEXT columns each service lists in allowedFields.
const CASES = [
  ['invoices',       'PATCH', '/api/crm/invoices/ID',           'lead_id',              'invoice'],
  ['invoices',       'PATCH', '/api/crm/invoices/ID',           'due_date',             'invoice'],
  ['invoices',       'PATCH', '/api/crm/invoices/ID',           'subtotal',             'invoice'],
  ['invoices',       'PATCH', '/api/crm/invoices/ID',           'tax_rate',             'invoice'],
  ['invoices',       'PATCH', '/api/crm/invoices/ID',           'tax_amount',           'invoice'],
  ['invoices',       'PATCH', '/api/crm/invoices/ID',           'total',                'invoice'],
  ['expenses',       'PATCH', '/api/crm/expenses/ID',           'lead_id',              'expense'],
  ['expenses',       'PATCH', '/api/crm/expenses/ID',           'amount',               'expense'],
  ['expenses',       'PATCH', '/api/crm/expenses/ID',           'date',                 'expense'],
  ['subcontractors', 'PATCH', '/api/crm/subcontractors/ID',     'hourly_rate',          'subcontractor'],
  ['work_orders',    'PATCH', '/api/crm/work-orders/ID',        'lead_id',              'workOrder'],
  ['work_orders',    'PATCH', '/api/crm/work-orders/ID',        'scheduled_date',       'workOrder'],
  ['estimates',      'PATCH', '/api/estimates/ID',              'lead_id',              'estimate'],
  ['estimates',      'PATCH', '/api/estimates/ID',              'valid_until',          'estimate'],
  ['contracts',      'PATCH', '/api/crm/contracts/ID',          'lead_id',              'contract'],
  ['contracts',      'PATCH', '/api/crm/contracts/ID',          'estimate_id',          'contract'],
  ['tasks',          'PATCH', '/api/crm/tasks/ID',              'due_date',             'task'],
  ['tasks',          'PATCH', '/api/crm/tasks/ID',              'lead_id',              'task'],
  ['tasks',          'PATCH', '/api/crm/tasks/ID',              'assigned_to',          'task'],
  ['drip_sequences', 'PATCH', '/api/crm/drip-sequences/ID',     'trigger_stage',        'dripseq'],
  ['leads',          'PATCH', '/api/crm/leads/ID',              'assigned_to',          'lead'],
  ['leads',          'PATCH', '/api/crm/leads/ID',              'appointment_date',     'lead'],
  ['leads',          'PATCH', '/api/crm/leads/ID',              'estimated_value',      'lead'],
];

const results = [];
for (const [entity, method, tpl, field, key] of CASES) {
  const id = ids[key];
  if (!id) { console.log(`SKIP ${entity}.${field} (no row)`); continue; }
  const path = tpl.replace('ID', id);
  const r = await req(method, path, { [field]: '' });
  const bodyStr = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
  results.push({ entity, field, status: r.status, body: bodyStr.slice(0, 200) });
  const flag = r.status >= 500 ? '*** 5xx ***' : r.status === 400 ? '400' : r.status === 200 ? '200 ACCEPTED' : String(r.status);
  console.log(`${flag.padEnd(12)} ${entity}.${field}  -> ${bodyStr.slice(0, 120)}`);
}

console.log('\n--- tally ---');
const tally = results.reduce((a, x) => { a[x.status] = (a[x.status] || 0) + 1; return a; }, {});
console.log(JSON.stringify(tally));
console.log('5xx cases:', results.filter(r => r.status >= 500).map(r => `${r.entity}.${r.field}`).join(', ') || 'none');
console.log('200 (silently accepted) cases:', results.filter(r => r.status === 200).map(r => `${r.entity}.${r.field}`).join(', ') || 'none');

fs.writeFileSync('C:/tmp/run75-coerce.json', JSON.stringify({ ids, results }, null, 1));
await pool.end();
