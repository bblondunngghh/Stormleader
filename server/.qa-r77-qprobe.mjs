// Run 77 s1 — SET DIFFERENCE #2 (runtime half): is each declared query filter ACTUALLY applied?
//
// Method, per param:
//   baseline = GET <route>                      -> N rows
//   impossible = GET <route>?<param>=<value that cannot match>
// If `impossible` returns the SAME N as baseline, the server READ the param and then DROPPED it.
// That is a dead filter: the request 200s, the UI redraws, nothing changes. A screenshot,
// a console check and a status-code sweep ALL pass it.
//
// STRUCTURALLY UNABLE TO FIND: filters that are applied but with the wrong operator
// (e.g. >= instead of >), and filters on empty tables (declared as UNTESTABLE below).
// ZERO writes — every request is a GET.
import fs from 'fs';
import { req } from './.qa-r77-lib.mjs';

const ids = JSON.parse(fs.readFileSync('C:/tmp/qa-r77-ids.json', 'utf8'));

// impossible values by param semantics
const DEAD_UUID = '00000000-0000-4000-8000-000000000000';
const NOPE = '__qa_r77_no_such_value__';

const TARGETS = [
  ['/api/crm/leads', { stage: 'lost', priority: 'cold', source: NOPE, assigned_rep_id: DEAD_UUID, search: NOPE, min_score: '999' }],
  ['/api/crm/tasks', { lead_id: DEAD_UUID, assigned_to: DEAD_UUID, completed: 'true' }],
  ['/api/crm/contracts', { status: NOPE, lead_id: DEAD_UUID }],
  ['/api/estimates', { status: NOPE, lead_id: DEAD_UUID }],
  ['/api/crm/expenses', { lead_id: DEAD_UUID, category: NOPE, start_date: '2099-01-01', end_date: '1990-01-01' }],
  ['/api/crm/invoices', { status: NOPE }],
  ['/api/leads', { stage: 'lost', priority: 'cold', source: NOPE, assigned_rep_id: DEAD_UUID, storm_event_id: DEAD_UUID, needs_followup: 'true', unassigned: 'true', score_min: '999', limit: '1' }],
  ['/api/crm/work-orders', { status: NOPE, assigned_to: DEAD_UUID }],
  ['/api/crm/subcontractors', { specialty: NOPE, status: NOPE, search: NOPE, limit: '1' }],
  ['/api/materials/products', { search: NOPE, category: NOPE }],
  ['/api/materials/orders', { status: NOPE, limit: '1' }],
  ['/api/documents', { lead_id: DEAD_UUID, type: NOPE }],
  ['/api/notifications', { is_read: 'true' }],
  ['/api/crm/custom-fields', { entity_type: NOPE }],
  ['/api/crm/canvass-pins', { date: '2099-01-01', user_id: DEAD_UUID }],
  ['/api/payments/history', { status: NOPE }],
  ['/api/crm/financing/plans', { lenderId: DEAD_UUID }],
  ['/api/crm/dashboard/properties-affected/list', { limit: '1', contacted: 'true', housesOnly: 'true' }],
  ['/api/storms', { source: NOPE, timeRange: '1' }],
];

function count(body) {
  if (Array.isArray(body)) return body.length;
  if (!body || typeof body !== 'object') return -1;
  for (const k of ['data', 'rows', 'items', 'results', 'leads', 'estimates', 'invoices', 'contracts',
    'workOrders', 'work_orders', 'properties', 'expenses', 'tasks', 'subcontractors', 'templates',
    'sequences', 'applications', 'lenders', 'plans', 'orders', 'products', 'notifications', 'pins',
    'documents', 'features', 'payments', 'customFields', 'custom_fields', 'members']) {
    if (Array.isArray(body[k])) return body[k].length;
  }
  return -1;
}

const dead = []; const ok = []; const untestable = []; const errs = [];

for (const [route, params] of TARGETS) {
  const base = await req('GET', route);
  if (base.status !== 200) { errs.push(`${route} baseline -> ${base.status}`); continue; }
  const n = count(base.body);
  if (n <= 0) { untestable.push(`${route} baseline rows=${n} (empty table or unrecognised container) — every filter here is UNTESTABLE`); continue; }
  for (const [p, v] of Object.entries(params)) {
    const r = await req('GET', `${route}?${p}=${encodeURIComponent(v)}`);
    if (r.status !== 200) { ok.push(`${route}?${p} -> ${r.status} (rejected, not silently ignored)`); continue; }
    const m = count(r.body);
    if (m === n) dead.push({ route, param: p, value: v, baseline: n, filtered: m });
    else ok.push(`${route}?${p}=${String(v).slice(0, 18)} -> ${n} => ${m}`);
  }
}

console.log('=== DEAD FILTER CANDIDATES (unchanged row count under an impossible value) ===');
if (!dead.length) console.log('  none');
dead.forEach((d) => console.log(`  ${d.route}  param='${d.param}'  ${d.baseline} rows -> ${d.filtered} rows with ${d.param}=${d.value}`));

console.log('\n=== FILTERS THAT DEMONSTRABLY WORK: ' + ok.length + ' ===');
ok.forEach((s) => console.log('  ' + s));

console.log('\n=== UNTESTABLE (empty baseline): ' + untestable.length + ' ===');
untestable.forEach((s) => console.log('  ' + s));

console.log('\n=== BASELINE ERRORS: ' + errs.length + ' ===');
errs.forEach((s) => console.log('  ' + s));

fs.writeFileSync('C:/tmp/qa-r77-qprobe.json', JSON.stringify({ dead, ok, untestable, errs }, null, 1));
