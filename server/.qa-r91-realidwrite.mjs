// Run 91 (s1-api-test) — execute every PATCH/PUT handler against a REAL row.
//
// WHY (the standing lesson): "a dead-uuid write sweep is structurally incapable of
// finding stored-shape crashes — it 404s BEFORE handler logic runs." Every previous
// write sweep hit the ownership lookup and stopped. The 34 PATCH/PUT handlers have
// therefore never had their UPDATE path executed by QA.
//
// THE BUG CLASS THIS TARGETS: a handler that builds `SET` from a whitelist of present
// body fields. With an empty body the field list is empty and a naive implementation
// emits `UPDATE t SET WHERE id=$1` -> 42601 syntax error -> 500. A dead uuid can never
// reach that line; a real id does.
//
// SAFETY (three independent layers, because "it should be a no-op" is not evidence):
//   1. full `SELECT *` snapshot of the target row before, re-read + deep-compare after,
//      and a generated UPDATE that restores every column if anything moved
//   2. a global row-count snapshot across every public table, before and after
//   3. side-effecting transitions (/complete, /toggle, /read) are held back for a
//      separate, explicitly-reverted phase — they mutate regardless of body
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = process.argv[2] || 'http://localhost:3001';
const TENANT_SLUG = 'waterloo';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const inventory = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

const { rows: [tenant] } = await pool.query('SELECT id FROM tenants WHERE slug = $1', [TENANT_SLUG]);
const TID = tenant.id;

const one = async (sql, params = []) => {
  try { const { rows } = await pool.query(sql, params); return rows[0] || null; } catch { return null; }
};
const pick = async (t) => (await one(`SELECT id FROM ${t} WHERE tenant_id = $1 LIMIT 1`, [TID]))?.id || null;
const pickRaw = async (t) => (await one(`SELECT id FROM ${t} LIMIT 1`))?.id || null;

// ---------- resolve one real id per backing table ----------
const ids = {};
for (const t of ['leads', 'estimates', 'invoices', 'contracts', 'work_orders', 'tasks', 'expenses',
  'subcontractors', 'automations', 'drip_sequences', 'notifications', 'canvass_pins',
  'canvass_territories', 'financing_lenders', 'financing_plans', 'custom_fields',
  'estimate_templates', 'contract_templates', 'users']) {
  ids[t] = await pick(t);
}
ids.tenants = TID;
ids.properties = await pickRaw('properties');
ids.work_order_milestones = await pickRaw('work_order_milestones');

// route -> {table, params}. null table = a global/config route with no row to snapshot.
const MAP = {
  '/api/admin/tenants/:id': { table: 'tenants', p: { id: 'tenants' } },
  '/api/crm/automations/:id': { table: 'automations', p: { id: 'automations' } },
  '/api/crm/canvass-pins/:id': { table: 'canvass_pins', p: { id: 'canvass_pins' } },
  '/api/crm/contracts/:id': { table: 'contracts', p: { id: 'contracts' } },
  '/api/crm/contracts/templates/:id': { table: 'contract_templates', p: { id: 'contract_templates' } },
  '/api/crm/custom-fields/:id': { table: 'custom_fields', p: { id: 'custom_fields' } },
  '/api/crm/drip-sequences/:id': { table: 'drip_sequences', p: { id: 'drip_sequences' } },
  '/api/crm/expenses/:id': { table: 'expenses', p: { id: 'expenses' } },
  '/api/crm/financing/lenders/:id': { table: 'financing_lenders', p: { id: 'financing_lenders' } },
  '/api/crm/financing/plans/:id': { table: 'financing_plans', p: { id: 'financing_plans' } },
  '/api/crm/invoices/:id': { table: 'invoices', p: { id: 'invoices' } },
  '/api/crm/leads/:id': { table: 'leads', p: { id: 'leads' } },
  '/api/crm/leads/:id/roof-type': { table: 'leads', p: { id: 'leads' } },
  '/api/crm/subcontractors/:id': { table: 'subcontractors', p: { id: 'subcontractors' } },
  '/api/crm/tasks/:id': { table: 'tasks', p: { id: 'tasks' } },
  '/api/crm/team/:userId/role': { table: 'users', p: { userId: 'users' } },
  '/api/crm/territories/:id': { table: 'canvass_territories', p: { id: 'canvass_territories' } },
  '/api/crm/work-orders/:id': { table: 'work_orders', p: { id: 'work_orders' } },
  '/api/crm/work-orders/:id/milestones/:milestoneId': {
    table: 'work_order_milestones', p: { id: 'work_orders', milestoneId: 'work_order_milestones' },
  },
  '/api/estimates/:id': { table: 'estimates', p: { id: 'estimates' } },
  '/api/estimates/templates/:id': { table: 'estimate_templates', p: { id: 'estimate_templates' } },
  '/api/leads/:id': { table: 'leads', p: { id: 'leads' } },
  '/api/properties/:id/location': { table: 'properties', p: { id: 'properties' } },
  // global/config routes — no :id, but they still UPDATE a row
  '/api/alerts/config': { table: null },
  '/api/auth/me': { table: 'users', rowId: () => ids.users },
  '/api/crm/tenant-settings': { table: 'tenants', rowId: () => TID },
  '/api/materials/credentials': { table: null },
  '/api/notifications/preferences': { table: null },
  '/api/onboarding/org': { table: 'tenants', rowId: () => TID },
  '/api/roof-measurement/config': { table: null },
  '/api/skip-trace/config': { table: null },
};

// Held back: these transition state regardless of body.
const TRANSITION = /\/(complete|toggle|read)$/;

const snapshotAll = async () => {
  const { rows } = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  const c = {};
  for (const { tablename } of rows) {
    try { c[tablename] = (await pool.query(`SELECT count(*)::int AS n FROM "${tablename}"`)).rows[0].n; } catch { /* skip */ }
  }
  return c;
};

const getRow = async (table, id) => (table && id ? await one(`SELECT * FROM ${table} WHERE id = $1`, [id]) : null);

const restoreRow = async (table, id, snap) => {
  // node-postgres binds a JS ARRAY as a Postgres ARRAY LITERAL, not JSON. Restoring a
  // jsonb column that way turns [] into '{}' -> a jsonb OBJECT, silently corrupting the
  // row. Serialize objects/arrays to text and cast instead.
  const cols = Object.keys(snap).filter(c => c !== 'id');
  const vals = cols.map(c => (snap[c] !== null && typeof snap[c] === 'object' && !(snap[c] instanceof Date))
    ? JSON.stringify(snap[c]) : snap[c]);
  const sets = cols.map((c, i) => (vals[i] !== null && typeof snap[c] === 'object' && !(snap[c] instanceof Date))
    ? `"${c}" = $${i + 1}::jsonb` : `"${c}" = $${i + 1}`).join(', ');
  await pool.query(`UPDATE ${table} SET ${sets} WHERE id = $${cols.length + 1}`, [...vals, id]);
};

const before = await snapshotAll();
const results = [];
const fivexx = [];
const mutated = [];
let skippedNoId = 0;

console.log('=== PATCH/PUT against a REAL row, empty body ===\n');

for (const r of inventory.filter((x) => ['PATCH', 'PUT'].includes(x.method))) {
  if (TRANSITION.test(r.path)) continue;
  const cfg = MAP[r.path];
  if (!cfg) { console.log(`  ??  UNMAPPED ${r.method} ${r.path}`); continue; }

  // build the url
  let url = r.path;
  let ok = true;
  if (cfg.p) {
    for (const [param, table] of Object.entries(cfg.p)) {
      const v = ids[table];
      if (!v) { ok = false; break; }
      url = url.replace(`:${param}`, v);
    }
  }
  if (!ok) { console.log(`  --  SKIP (no row) ${r.method} ${r.path}`); skippedNoId++; continue; }

  const rowId = cfg.rowId ? cfg.rowId() : (cfg.p ? ids[Object.values(cfg.p)[0]] : null);
  const targetId = cfg.table === 'work_order_milestones' ? ids.work_order_milestones : rowId;
  const snap = await getRow(cfg.table, targetId);

  let status = null; let body = '';
  try {
    const res = await fetch(`${BASE}${url}`, {
      method: r.method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({}),
    });
    status = res.status;
    body = (await res.text()).slice(0, 200);
  } catch (e) { status = 'THREW'; body = String(e).slice(0, 160); }

  results.push({ route: `${r.method} ${r.path}`, status });
  const flag = (typeof status === 'number' && status >= 500) || status === 'THREW' ? 'DEFECT' : '  ok  ';
  if (flag === 'DEFECT') fivexx.push({ route: `${r.method} ${r.path}`, url, status, body });

  // did the row move?
  let moved = '';
  if (snap) {
    const after = await getRow(cfg.table, targetId);
    const diff = Object.keys(snap).filter(
      (k) => k !== 'updated_at' && JSON.stringify(snap[k]) !== JSON.stringify(after?.[k])
    );
    if (diff.length) {
      moved = ` MUTATED[${diff.join(',')}] -> restored`;
      mutated.push({ route: `${r.method} ${r.path}`, cols: diff });
      await restoreRow(cfg.table, targetId, snap);
    }
  }
  console.log(`  ${flag} ${String(status).padEnd(5)} ${r.method.padEnd(6)} ${r.path.padEnd(50)}${moved}`);
  if (flag === 'DEFECT') console.log(`         ${body.replace(/\s+/g, ' ')}`);
}

const after = await snapshotAll();
const drift = Object.keys(after).filter((t) => before[t] !== after[t]).map((t) => `${t}: ${before[t]}->${after[t]}`);

console.log(`\nroutes exercised: ${results.length}   skipped (no row in table): ${skippedNoId}   held back (state transitions): ${inventory.filter((x) => ['PATCH', 'PUT'].includes(x.method) && TRANSITION.test(x.path)).length}`);
const buckets = {};
for (const r of results) buckets[r.status] = (buckets[r.status] || 0) + 1;
console.log('status buckets:', JSON.stringify(buckets));
console.log('rows mutated by an EMPTY body (then restored):', mutated.length ? JSON.stringify(mutated) : 'none');
console.log('global row-count drift:', drift.length ? drift.join(', ') : 'NONE (0 net writes)');
console.log(`\n5xx / threw: ${fivexx.length}`);
for (const f of fivexx) console.log(`  ${f.status}  ${f.route}\n     ${f.url}\n     ${f.body.replace(/\s+/g, ' ')}`);

await pool.end();
