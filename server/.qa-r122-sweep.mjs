// Run 122-s1 — MAIN SWEEP. Three phases in one process:
//   P0  resolve REAL ids from the DB (dead-uuid sweeps 404 before handler logic;
//       standing rule: always add a real-id pass)
//   P1  every GET route with real ids substituted  -> expect 2xx / documented non-2xx
//   P2  every param-less POST that STATICALLY has an early 4xx guard, probed with
//       an EMPTY BODY -> expect 4xx, never 5xx, never 2xx-with-a-row
//   P3  DB mutation snapshot: count(*) AND max(updated_at) per table, before/after
//       (a row-count snapshot alone CANNOT see an UPDATE - Run 100 rule)
// Action routes (score-all / correct-all / mark-all-read / complete / alerts-test /
// import / onboarding / payments / auth) are excluded BY SEMANTICS, not by shape.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const T = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const guards = JSON.parse(fs.readFileSync('C:/tmp/qa-r122-postguards.json', 'utf8'));

const req = async (m, p, b) => {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(BASE + p, {
      method: m,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T },
      body: b === undefined ? undefined : JSON.stringify(b),
      signal: ctl.signal,
    });
    const txt = await r.text();
    return { st: r.status, body: txt.slice(0, 220), len: txt.length };
  } catch (e) {
    return { st: 0, body: 'FETCH_ERR ' + e.name + ' ' + e.message.slice(0, 80), len: 0 };
  } finally { clearTimeout(to); }
};

const TENANT = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const q = async (sql, params = []) => { try { return (await pool.query(sql, params)).rows; } catch (e) { return [{ __err: e.code + ' ' + e.message.slice(0, 60) }]; } };
const one = async (table, col = 'id', where = 'tenant_id = $1') => {
  const r = await q(`SELECT ${col} AS v FROM ${table} WHERE ${where} LIMIT 1`, where.includes('$1') ? [TENANT] : []);
  return r[0] && !r[0].__err ? r[0].v : null;
};

// ---------- P0: real ids ----------
const ids = {
  lead: await one('leads'),
  estimate: await one('estimates'),
  invoice: await one('invoices'),
  contract: await one('contracts'),
  workOrder: await one('work_orders'),
  expense: await one('expenses'),
  subcontractor: await one('subcontractors'),
  task: await one('tasks'),
  activity: await one('activities'),
  notification: await one('notifications'),
  user: await one('users'),
  document: await one('documents'),
  customField: await one('custom_field_definitions'),
  automation: await one('automation_rules'),
  drip: await one('drip_sequences'),
  canvassPin: await one('canvass_pins'),
  property: await one('properties', 'id', 'true'),
  storm: await one('storm_events', 'id', 'true'),
  county: await one('counties', 'id', 'true'),
  tenant: TENANT,
};
console.log('IDS', JSON.stringify(Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, v ? String(v).slice(0, 8) : null]))));

// param-name -> value heuristic
function fill(path) {
  const missing = [];
  const filled = path.replace(/:([A-Za-z_]+)/g, (_, name) => {
    const n = name.toLowerCase();
    const pick =
      n === 'leadid' ? ids.lead :
      n === 'estimateid' ? ids.estimate :
      n === 'invoiceid' ? ids.invoice :
      n === 'contractid' ? ids.contract :
      n === 'workorderid' || n === 'woid' ? ids.workOrder :
      n === 'userid' ? ids.user :
      n === 'tenantid' ? ids.tenant :
      n === 'propertyid' ? ids.property :
      n === 'stormid' ? ids.storm :
      n === 'countyid' || n === 'fips' ? ids.county :
      n === 'token' ? 'QA-NO-FIXTURE-TOKEN' :
      n === 'id' ? null : null;
    if (pick) return String(pick);
    missing.push(name);
    return ':' + name;
  });
  return { filled, missing };
}

// for ':id' the right entity depends on the mount prefix
const ID_BY_PREFIX = [
  ['/api/crm/leads/', 'lead'], ['/api/leads/', 'lead'],
  ['/api/estimates/', 'estimate'], ['/api/crm/invoices/', 'invoice'],
  ['/api/crm/contracts/', 'contract'], ['/api/crm/work-orders/', 'workOrder'],
  ['/api/crm/expenses/', 'expense'], ['/api/crm/subcontractors/', 'subcontractor'],
  ['/api/crm/tasks/', 'task'], ['/api/crm/activities/', 'activity'],
  ['/api/notifications/', 'notification'], ['/api/documents/', 'document'],
  ['/api/crm/custom-fields/', 'customField'], ['/api/crm/automations/', 'automation'],
  ['/api/crm/drip-sequences/', 'drip'], ['/api/crm/canvass-pins/', 'canvassPin'],
  ['/api/properties/', 'property'], ['/api/storms/', 'storm'], ['/api/counties/', 'county'],
  ['/api/crm/team/', 'user'],
];
function resolveId(path) {
  for (const [pre, key] of ID_BY_PREFIX) if (path.startsWith(pre)) return ids[key];
  return null;
}

// ---------- P3a: BEFORE snapshot ----------
const TABLES = (await q(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`
)).map(r => r.table_name).filter(Boolean);
async function snapshot() {
  const s = {};
  for (const t of TABLES) {
    const hasUpd = (await q(
      `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='updated_at'`, [t]
    )).length > 0;
    const r = await q(`SELECT count(*)::int AS c${hasUpd ? ', max(updated_at) AS m' : ''} FROM "${t}"`);
    s[t] = r[0] && !r[0].__err ? { c: r[0].c, m: r[0].m ? String(r[0].m) : null } : { err: 1 };
  }
  return s;
}
const before = await snapshot();

// ---------- P1: GET sweep ----------
const SKIP_GET = /trigger-import|\/import|score-all|correct-all/i;
const gets = inv.filter(r => r.method === 'GET');
const getResults = [];
for (const r of gets) {
  if (SKIP_GET.test(r.path)) { getResults.push({ ...r, st: 'SKIP', body: 'semantics' }); continue; }
  let p = r.path;
  const idv = resolveId(p);
  if (idv) p = p.replace(/:id\b/, String(idv));
  const { filled, missing } = fill(p);
  const res = await req('GET', filled);
  getResults.push({ path: r.path, url: filled, file: r.file, st: res.st, len: res.len, missing, body: res.st >= 400 || res.st === 0 ? res.body : '' });
}

// ---------- P2: POST empty-body sweep ----------
const SKIP_POST = /score-all|correct-all|mark-all-read|alerts\/test|\/import|trigger-import|onboarding|payments|auth\/(login|refresh|register)|webhooks|skip-trace|generate-leads|geocode|plans\/sync|drift\//i;
const postTargets = guards.filter(g => g.hasEarly4xx && !SKIP_POST.test(g.path));
const postResults = [];
for (const g of postTargets) {
  const res = await req('POST', g.path, {});
  postResults.push({ path: g.path, file: g.file, st: res.st, body: res.body });
}
// also: no-body-at-all (Content-Type json, zero bytes) on the same set
const postNoBody = [];
for (const g of postTargets) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
  let st = 0, body = '';
  try {
    const r = await fetch(BASE + g.path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T }, signal: ctl.signal });
    st = r.status; body = (await r.text()).slice(0, 200);
  } catch (e) { body = 'ERR ' + e.name; } finally { clearTimeout(to); }
  postNoBody.push({ path: g.path, st, body });
}

// ---------- P3b: AFTER snapshot ----------
const after = await snapshot();
const drift = [];
for (const t of TABLES) {
  const b = before[t], a = after[t];
  if (!b || !a) continue;
  if (b.c !== a.c) drift.push({ table: t, kind: 'COUNT', before: b.c, after: a.c });
  if (b.m !== a.m) drift.push({ table: t, kind: 'UPDATED_AT', before: b.m, after: a.m });
}

const out = { ids, getResults, postResults, postNoBody, drift, skippedPost: guards.filter(g => !g.hasEarly4xx || SKIP_POST.test(g.path)).map(g => g.path) };
fs.writeFileSync('C:/tmp/qa-r122-sweep.json', JSON.stringify(out, null, 1));

// ---------- report ----------
const by = {};
getResults.forEach(r => { by[r.st] = (by[r.st] || 0) + 1; });
console.log('\n=== GET sweep:', getResults.length, 'routes ===');
console.log('status histogram:', JSON.stringify(by));
console.log('--- 5xx / 0 (CRASH CANDIDATES) ---');
getResults.filter(r => r.st === 0 || (typeof r.st === 'number' && r.st >= 500)).forEach(r => console.log(' ', r.st, r.url, '|', r.body.slice(0, 150)));
console.log('--- unresolved params (no fixture) ---');
console.log(' ', getResults.filter(r => r.missing && r.missing.length).length, 'routes:', [...new Set(getResults.filter(r => r.missing && r.missing.length).flatMap(r => r.missing))].join(','));
console.log('--- 4xx ---');
getResults.filter(r => typeof r.st === 'number' && r.st >= 400 && r.st < 500).forEach(r => console.log(' ', r.st, r.url, '|', r.body.slice(0, 110)));

const pby = {};
postResults.forEach(r => { pby[r.st] = (pby[r.st] || 0) + 1; });
console.log('\n=== POST {} sweep:', postResults.length, 'routes ===');
console.log('status histogram:', JSON.stringify(pby));
console.log('--- NOT 4xx (5xx = crash, 2xx = guard did not fire) ---');
postResults.filter(r => !(r.st >= 400 && r.st < 500)).forEach(r => console.log(' ', r.st, r.path, '|', r.body.slice(0, 160)));
const nbby = {};
postNoBody.forEach(r => { nbby[r.st] = (nbby[r.st] || 0) + 1; });
console.log('\n=== POST no-body-at-all:', postNoBody.length, '===', JSON.stringify(nbby));
postNoBody.filter(r => !(r.st >= 400 && r.st < 500)).forEach(r => console.log(' ', r.st, r.path, '|', r.body.slice(0, 160)));

console.log('\n=== DB DRIFT ===');
console.log(drift.length ? JSON.stringify(drift, null, 1) : 'NONE — 0 count drift, 0 updated_at drift');
await pool.end();
