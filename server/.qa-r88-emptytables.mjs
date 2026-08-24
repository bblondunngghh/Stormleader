// Run 88 — reach the 4 GET handlers that no sweep has ever executed.
//
// drip_sequences, prospect_lists and financing_applications all have ZERO rows,
// so every previous sweep 404'd before the handler body ran. Create one row per
// table, GET the dependent routes with that REAL id, then delete the row.
// Net DB writes: 0.
//
// Also dumps the non-2xx GET set so the 400/403 buckets can be checked
// individually rather than assumed correct.
import pool from './src/db/pool.js';
import fs from 'fs';

const BASE = process.argv[2] || 'http://localhost:3098';
const inventory = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
});
const auth = await login.json();
if (!auth.accessToken) { console.log('LOGIN FAILED', login.status); process.exit(1); }
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` };
const api = async (method, path, body) => {
  const r = await fetch(`${BASE}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch { /* none */ }
  return { status: r.status, body: j };
};

// ---------- PART 1: the non-2xx GET set, itemised ----------
const DANGEROUS = /import|geocod|skip-trace|sync|refresh|send|export|bulk|trigger/i;
console.log('=== non-2xx GET routes (no path params) ===');
for (const r of inventory.filter((x) => x.method === 'GET' && !/:/.test(x.path) && !DANGEROUS.test(x.path))) {
  const res = await api('GET', r.path);
  if (res.status < 200 || res.status > 299) {
    const msg = typeof res.body?.error === 'string' ? res.body.error : JSON.stringify(res.body || {});
    console.log(`  ${res.status}  ${r.path.padEnd(48)} ${msg.slice(0, 80)}`);
  }
}

// ---------- PART 2: create -> GET -> delete on the empty tables ----------
const created = [];
const probe = async (label, createPath, createBody, getPaths, deletePath) => {
  console.log(`\n=== ${label} ===`);
  const c = await api('POST', createPath, createBody);
  console.log(`  POST ${createPath} -> ${c.status}`);
  if (c.status !== 200 && c.status !== 201) {
    console.log('    body:', JSON.stringify(c.body || {}).slice(0, 250));
    return;
  }
  const id = c.body?.id || c.body?.sequence?.id || c.body?.list?.id;
  if (!id) { console.log('    NO ID in response:', JSON.stringify(c.body).slice(0, 250)); return; }
  console.log('  id', id);
  created.push([label, id, deletePath ? deletePath.replace(':id', id) : null]);

  for (const gp of getPaths) {
    const url = gp.replace(':id', id);
    const g = await api('GET', url);
    const flag = g.status >= 500 ? 'DEFECT' : '  ok  ';
    console.log(`  ${flag} ${g.status}  GET ${url}`);
    if (g.status >= 500) console.log('     ', JSON.stringify(g.body || {}).slice(0, 300));
  }
};

await probe(
  'drip_sequences',
  '/api/crm/drip-sequences',
  { name: 'QA-R88 probe sequence', trigger_type: 'lead_created', is_active: false },
  ['/api/crm/drip-sequences/:id', '/api/crm/drip-sequences/:id/enrollments'],
  '/api/crm/drip-sequences/:id'
);

await probe(
  'prospect_lists',
  '/api/crm/prospect-lists',
  { name: 'QA-R88 probe list' },
  ['/api/crm/prospect-lists/:id', '/api/crm/prospect-lists/:id/items'],
  '/api/crm/prospect-lists/:id'
);

// ---------- PART 3: clean up ----------
console.log('\n=== cleanup ===');
for (const [label, id, delPath] of created) {
  if (delPath) {
    const d = await api('DELETE', delPath);
    console.log(`  DELETE ${delPath} -> ${d.status}`);
  } else {
    console.log(`  ${label} ${id} has NO delete route — removing by SQL`);
  }
}

const leftovers = async (table, col = 'name') => {
  try {
    const { rows } = await pool.query(`SELECT id FROM ${table} WHERE ${col} LIKE 'QA-R88%'`);
    if (rows.length) {
      await pool.query(`DELETE FROM ${table} WHERE ${col} LIKE 'QA-R88%'`);
      console.log(`  SQL-removed ${rows.length} leftover row(s) from ${table}`);
    }
    const { rows: after } = await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${col} LIKE 'QA-R88%'`);
    console.log(`  ${table} QA-R88 rows remaining: ${after[0].n}`);
  } catch (e) { console.log(`  ${table}: ${String(e.message).slice(0, 90)}`); }
};
await leftovers('drip_sequences');
await leftovers('prospect_lists');
await pool.end();
