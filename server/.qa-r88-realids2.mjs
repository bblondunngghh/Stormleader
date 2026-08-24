// Run 88 — real-id GET sweep, v2.
//
// v1 mapped param names to DB tables. That misses anything not backed by a table
// the mapper knows: /materials/products/:id is served from an in-memory
// MOCK_PRODUCTS array, /counties/:id/status from a static county list, and the
// public /:token routes key off share-token columns, not ids.
//
// v2 resolves an id three ways, in order:
//   1. explicit token/id lookups straight from the DB
//   2. the param-name -> table map
//   3. GENERIC FALLBACK: strip the "/:param..." tail, GET the parent collection
//      and take the first id out of the response, whatever shape it is
// (3) is what reaches mock- and computed-backed routes.
import pool from './src/db/pool.js';
import fs from 'fs';

const BASE = process.argv[2] || 'http://localhost:3098';
const inventory = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const TENANT_SLUG = 'waterloo';

const { rows: [tenant] } = await pool.query('SELECT id FROM tenants WHERE slug = $1', [TENANT_SLUG]);
const TID = tenant.id;

const one = async (sql, params = []) => {
  try { const { rows } = await pool.query(sql, params); return rows[0] || null; } catch { return null; }
};
const pick = async (table) => (await one(`SELECT id FROM ${table} WHERE tenant_id = $1 LIMIT 1`, [TID]))?.id || null;

const ids = {};
for (const t of ['leads', 'contacts', 'estimates', 'invoices', 'contracts', 'work_orders', 'tasks',
  'expenses', 'subcontractors', 'documents', 'activities', 'material_orders', 'automations',
  'drip_sequences', 'drip_enrollments', 'prospect_lists', 'users', 'notifications', 'payments',
  'financing_applications', 'canvass_territories', 'canvass_pins', 'storm_alerts',
  'estimate_templates', 'contract_templates', 'financing_plans', 'financing_lenders']) {
  ids[t] = await pick(t);
}
ids.tenants = TID;
ids.storm_events = (await one('SELECT id FROM storm_events LIMIT 1'))?.id || null;
ids.properties = (await one('SELECT id FROM properties LIMIT 1'))?.id || null;
ids.work_order_milestones = (await one('SELECT id FROM work_order_milestones LIMIT 1'))?.id || null;
ids.prospect_list_items = (await one('SELECT id FROM prospect_list_items LIMIT 1'))?.id || null;

// Public share tokens
const TOKENS = {
  estimate: (await one('SELECT public_token AS t FROM estimates WHERE public_token IS NOT NULL LIMIT 1'))?.t || null,
  contract: (await one('SELECT token AS t FROM contracts WHERE token IS NOT NULL LIMIT 1'))?.t || null,
  clientStatus: (await one('SELECT token AS t FROM client_status_tokens LIMIT 1'))?.t || null,
};
console.log('tokens:', JSON.stringify(TOKENS));

const DIRECT = {
  leadid: 'leads', contactid: 'contacts', estimateid: 'estimates', invoiceid: 'invoices',
  contractid: 'contracts', workorderid: 'work_orders', woid: 'work_orders', taskid: 'tasks',
  expenseid: 'expenses', subcontractorid: 'subcontractors', documentid: 'documents',
  docid: 'documents', activityid: 'activities', orderid: 'material_orders',
  automationid: 'automations', sequenceid: 'drip_sequences', enrollmentid: 'drip_enrollments',
  listid: 'prospect_lists', propertyid: 'properties', userid: 'users', tenantid: 'tenants',
  eventid: 'storm_events', stormid: 'storm_events', stormeventid: 'storm_events',
  milestoneid: 'work_order_milestones', paymentid: 'payments',
  applicationid: 'financing_applications', territoryid: 'canvass_territories',
  notificationid: 'notifications', pinid: 'canvass_pins',
};
const BY_SEG = {
  leads: 'leads', contacts: 'contacts', estimates: 'estimates', invoices: 'invoices',
  contracts: 'contracts', 'work-orders': 'work_orders', tasks: 'tasks', expenses: 'expenses',
  subcontractors: 'subcontractors', documents: 'documents', activities: 'activities',
  orders: 'material_orders', automations: 'automations', 'drip-sequences': 'drip_sequences',
  sequences: 'drip_sequences', enrollments: 'drip_enrollments', 'prospect-lists': 'prospect_lists',
  properties: 'properties', users: 'users', tenants: 'tenants', events: 'storm_events',
  storms: 'storm_events', notifications: 'notifications', payments: 'payments',
  applications: 'financing_applications', territories: 'canvass_territories',
  pins: 'canvass_pins', alerts: 'storm_alerts',
};

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: TENANT_SLUG }),
});
const auth = await login.json();
if (!auth.accessToken) { console.log('LOGIN FAILED', login.status); process.exit(1); }
const H = { Authorization: `Bearer ${auth.accessToken}` };

// Dig the first plausible id out of any response shape.
function firstId(v, depth = 0) {
  if (v == null || depth > 4) return null;
  if (Array.isArray(v)) { for (const x of v) { const r = firstId(x, depth + 1); if (r) return r; } return null; }
  if (typeof v === 'object') {
    if (typeof v.id === 'string' || typeof v.id === 'number') return String(v.id);
    for (const k of Object.keys(v)) { const r = firstId(v[k], depth + 1); if (r) return r; }
  }
  return null;
}

const collectionCache = new Map();
async function fromCollection(path, param) {
  const parent = path.split(`/:${param}`)[0];
  if (!parent || parent.split('/').length < 3) return null;
  if (collectionCache.has(parent)) return collectionCache.get(parent);
  let id = null;
  try {
    const res = await fetch(`${BASE}${parent}`, { headers: H });
    if (res.ok) id = firstId(await res.json());
  } catch { /* ignore */ }
  collectionCache.set(parent, id);
  return id;
}

async function resolve(param, path) {
  const n = param.toLowerCase();
  if (n === 'token') {
    if (path.includes('/contracts/')) return TOKENS.contract;
    if (path.includes('/financing/')) return TOKENS.estimate;
    if (path.includes('/leads/status/')) return TOKENS.clientStatus;
    return TOKENS.estimate;
  }
  const table = DIRECT[n] || BY_SEG[path.split(`/:${param}`)[0].split('/').filter(Boolean).pop() || ''];
  if (table && ids[table]) return ids[table];
  return await fromCollection(path, param);
}

const DANGEROUS = /import|geocod|skip-trace|sync|refresh|send|export|bulk|trigger/i;
const gets = inventory.filter((r) => r.method === 'GET');
const buckets = {};
const fivexx = [];
const unresolved = [];
let realIdRoutes = 0, skipped = 0, noParam = 0;

for (const r of gets) {
  if (DANGEROUS.test(r.path)) { skipped++; continue; }
  const params = [...r.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((x) => x[1]);
  let url = r.path, ok = true;
  for (const p of params) {
    const id = await resolve(p, r.path);
    if (!id) { ok = false; unresolved.push(`${r.path}  (:${p})`); break; }
    url = url.replace(`:${p}`, encodeURIComponent(id));
  }
  if (!ok) continue;
  if (params.length) realIdRoutes++; else noParam++;

  try {
    const res = await fetch(`${BASE}${url}`, { headers: H });
    buckets[res.status] = (buckets[res.status] || 0) + 1;
    if (res.status >= 500) {
      fivexx.push({ route: `GET ${r.path}`, url, status: res.status, body: (await res.text()).slice(0, 400) });
    }
  } catch (e) {
    fivexx.push({ route: `GET ${r.path}`, url, status: 'THREW', body: String(e).slice(0, 200) });
  }
}

console.log(`\nGET routes ${gets.length} | skipped(dangerous) ${skipped} | no-param ${noParam} | REAL-ID ${realIdRoutes} | unresolved ${new Set(unresolved).size}`);
console.log('statuses:', JSON.stringify(buckets));
console.log(`\n5xx / threw: ${fivexx.length}`);
for (const f of fivexx) {
  console.log(`\n  ${f.status}  ${f.route}\n     ${f.url}\n     ${f.body.replace(/\s+/g, ' ')}`);
}
console.log('\nstill unresolved:');
for (const u of [...new Set(unresolved)]) console.log('  ', u);
await pool.end();
