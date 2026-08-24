// Run 88 — resolve REAL ids for every param GET route, then sweep them.
//
// WHY: a dead-uuid sweep 404s in validateId/the ownership check BEFORE handler
// logic runs, so it proves "nothing crashes on validation", not "the handler
// works". Run 87 got a real id into only 29 of 119 param GET routes. This
// closes that gap — every 5xx below is a handler that has never been executed.
import pool from './src/db/pool.js';
import fs from 'fs';

const BASE = process.argv[2] || 'http://localhost:3098';
const inventory = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

const TENANT_SLUG = 'waterloo';
const { rows: [tenant] } = await pool.query('SELECT id FROM tenants WHERE slug = $1', [TENANT_SLUG]);
const TID = tenant.id;

// Pull one real id per table. Tables the tenant does not scope are queried raw.
// A missing table must NOT abort the sweep (the `territories` table does not exist).
const pick = async (table, where = 'tenant_id = $1', params = [TID]) => {
  try {
    const { rows } = await pool.query(`SELECT id FROM ${table} WHERE ${where} LIMIT 1`, params);
    return rows[0]?.id || null;
  } catch {
    return null;
  }
};

const ids = {};
const TABLES = [
  'leads', 'contacts', 'estimates', 'invoices', 'contracts', 'work_orders', 'tasks',
  'expenses', 'subcontractors', 'documents', 'activities', 'materials', 'material_orders',
  'automations', 'drip_sequences', 'drip_enrollments', 'prospect_lists', 'prospect_list_items',
  'users', 'tenants', 'storm_events', 'properties', 'notifications', 'territories',
  'email_templates', 'payments', 'financing_applications', 'lead_sources', 'appointments',
  'work_order_milestones', 'photos', 'inspections', 'canvassing_routes', 'reports',
];
for (const t of TABLES) ids[t] = await pick(t);
ids.tenants = TID;

// Some tables are not tenant-scoped
for (const t of ['storm_events', 'properties']) {
  if (!ids[t]) ids[t] = await pick(t, 'TRUE', []);
}

console.log('resolved ids:');
for (const [k, v] of Object.entries(ids)) if (v) console.log(`  ${k.padEnd(24)} ${v}`);
const missing = Object.entries(ids).filter(([, v]) => !v).map(([k]) => k);
console.log('NO ROW / NO TABLE:', missing.join(', '), '\n');

// Map a param name (plus its path context) to a table.
function resolveParam(name, path) {
  const n = name.toLowerCase();
  const direct = {
    leadid: 'leads', contactid: 'contacts', estimateid: 'estimates', invoiceid: 'invoices',
    contractid: 'contracts', workorderid: 'work_orders', woid: 'work_orders', taskid: 'tasks',
    expenseid: 'expenses', subcontractorid: 'subcontractors', documentid: 'documents',
    docid: 'documents', activityid: 'activities', materialid: 'materials', orderid: 'material_orders',
    automationid: 'automations', sequenceid: 'drip_sequences', enrollmentid: 'drip_enrollments',
    listid: 'prospect_lists', propertyid: 'properties', userid: 'users', tenantid: 'tenants',
    eventid: 'storm_events', stormid: 'storm_events', milestoneid: 'work_order_milestones',
    templateid: 'email_templates', paymentid: 'payments', applicationid: 'financing_applications',
    territoryid: 'territories', notificationid: 'notifications', routeid: 'canvassing_routes',
  };
  if (direct[n]) return direct[n];

  // A bare :id takes its meaning from the path segment before it.
  const seg = path.split(`/:${name}`)[0].split('/').filter(Boolean).pop() || '';
  const bySeg = {
    leads: 'leads', contacts: 'contacts', estimates: 'estimates', invoices: 'invoices',
    contracts: 'contracts', 'work-orders': 'work_orders', tasks: 'tasks', expenses: 'expenses',
    subcontractors: 'subcontractors', documents: 'documents', activities: 'activities',
    materials: 'materials', orders: 'material_orders', automations: 'automations',
    sequences: 'drip_sequences', 'drip-sequences': 'drip_sequences', enrollments: 'drip_enrollments',
    'prospect-lists': 'prospect_lists', properties: 'properties', users: 'users',
    tenants: 'tenants', events: 'storm_events', storms: 'storm_events', notifications: 'notifications',
    templates: 'email_templates', payments: 'payments', applications: 'financing_applications',
    territories: 'territories', photos: 'photos', reports: 'reports', appointments: 'appointments',
  };
  return bySeg[seg] || null;
}

// --- auth ---
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: TENANT_SLUG }),
});
const auth = await login.json();
if (!auth.accessToken) { console.log('LOGIN FAILED', login.status); process.exit(1); }
const H = { Authorization: `Bearer ${auth.accessToken}` };

// Never fire an import/export/sync/skip-trace/PDF-heavy route from a sweep.
const DANGEROUS = /import|geocod|skip-trace|sync|refresh|send|export|bulk|trigger/i;

const gets = inventory.filter((r) => r.method === 'GET');
const results = { 200: 0, 400: 0, 403: 0, 404: 0, 422: 0, 500: 0, other: 0 };
const fivexx = [];
const unresolved = [];
let realIdRoutes = 0;
let skipped = 0;

for (const r of gets) {
  if (DANGEROUS.test(r.path)) { skipped++; continue; }
  const params = [...r.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((x) => x[1]);

  let url = r.path;
  let allReal = true;
  for (const p of params) {
    const table = resolveParam(p, r.path);
    const id = table ? ids[table] : null;
    if (!id) { allReal = false; unresolved.push(`${r.path}  (:${p} -> ${table || 'UNMAPPED'})`); break; }
    url = url.replace(`:${p}`, id);
  }
  if (!allReal) continue;
  if (params.length) realIdRoutes++;

  try {
    const res = await fetch(`${BASE}${url}`, { headers: H });
    const bucket = [200, 400, 403, 404, 422, 500].includes(res.status) ? res.status : 'other';
    results[bucket] = (results[bucket] || 0) + 1;
    if (res.status >= 500) {
      const body = await res.text();
      fivexx.push({ route: `${r.method} ${r.path}`, url, status: res.status, body: body.slice(0, 300) });
    }
  } catch (e) {
    fivexx.push({ route: `${r.method} ${r.path}`, url, status: 'THREW', body: String(e).slice(0, 200) });
  }
}

console.log(`GET routes: ${gets.length}   skipped (dangerous): ${skipped}   exercised with a REAL id: ${realIdRoutes}`);
console.log('status buckets:', JSON.stringify(results));
console.log(`\n5xx / threw: ${fivexx.length}`);
for (const f of fivexx) {
  console.log(`\n  ${f.status}  ${f.route}`);
  console.log(`     ${f.url}`);
  console.log(`     ${f.body.replace(/\s+/g, ' ')}`);
}

const uniqUnresolved = [...new Set(unresolved)];
console.log(`\nunresolved param routes: ${uniqUnresolved.length}`);
for (const u of uniqUnresolved.slice(0, 40)) console.log('  ', u);

await pool.end();
