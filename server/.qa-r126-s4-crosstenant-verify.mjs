// Run 126-s4 — VERIFY the two cross-tenant PII fixes (3a3d752, 1e94206) are LIVE in the
// running server process, not merely present in the source file.
//
// Method: plant ONE lead in a foreign tenant, temporarily repoint ONE existing waterloo
// row per entity at it, read the list back THROUGH THE API, assert the lead fields come
// back NULL (the scoped join must not resolve a foreign lead), then revert every row and
// delete the planted lead. Net DB change: zero rows, zero mutated columns.
//
// Also probes the assertOwned() write-boundary guard on tasks (should 400 on a foreign
// lead_id) and confirms the other five create routes are still the documented OPEN item.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const T = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${T}` };
const req = async (m, p, b) => {
  const r = await fetch(BASE + p, { method: m, headers: H, body: b === undefined ? undefined : JSON.stringify(b) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { st: r.status, j, t: String(t).slice(0, 160).replace(/\s+/g, ' ') };
};
const q = async (s, p) => (await pool.query(s, p)).rows;

const W = (await q(`SELECT id FROM tenants WHERE slug='waterloo'`))[0].id;
const F = (await q(`SELECT id FROM tenants WHERE slug='stormleads-test'`))[0].id;
const FAIL = [], PASS = [];
const judge = (ok, label, extra = '') => {
  (ok ? PASS : FAIL).push(label);
  console.log(`${ok ? 'PASS' : '*** FAIL'}  ${label} ${extra}`);
};

// ---------- baseline counts ----------
const counts = async () => (await q(
  `SELECT (SELECT count(*)::int FROM leads) leads,(SELECT count(*)::int FROM estimates) est,
          (SELECT count(*)::int FROM invoices) inv,(SELECT count(*)::int FROM contracts) con,
          (SELECT count(*)::int FROM work_orders) wo,(SELECT count(*)::int FROM expenses) exp,
          (SELECT count(*)::int FROM tasks) tasks`))[0];
const before = await counts();
console.log('BEFORE', JSON.stringify(before));

// ---------- plant the foreign lead ----------
const victim = (await q(
  `INSERT INTO leads (tenant_id, contact_name, address, city, stage)
   VALUES ($1,'ZZ-VICTIM-R126','999 SECRET STREET R126','Nowhere','new') RETURNING id`, [F]))[0].id;
console.log('planted foreign lead', victim, 'in tenant', F);

// ---------- entity table: which waterloo row to repoint, and how to read it back ----------
const ENTITIES = [
  { tbl: 'estimates',   path: '/api/estimates',          key: 'estimates' },
  { tbl: 'invoices',    path: '/api/crm/invoices',       key: 'invoices' },
  { tbl: 'contracts',   path: '/api/crm/contracts',      key: 'contracts' },
  { tbl: 'work_orders', path: '/api/crm/work-orders',    key: 'work_orders' },
  { tbl: 'expenses',    path: '/api/crm/expenses',       key: 'expenses' },
];
const LEAKY = /ZZ-VICTIM-R126|999 SECRET STREET R126/;
const restore = [];

try {
  for (const e of ENTITIES) {
    const row = (await q(`SELECT id, lead_id FROM ${e.tbl} WHERE tenant_id=$1 ORDER BY created_at LIMIT 1`, [W]))[0];
    if (!row) { console.log(`skip ${e.tbl} — no waterloo row`); continue; }
    restore.push({ tbl: e.tbl, id: row.id, lead_id: row.lead_id });
    await q(`UPDATE ${e.tbl} SET lead_id=$1 WHERE id=$2`, [victim, row.id]);

    const r = await req('GET', e.path);
    const body = JSON.stringify(r.j || {});
    const arr = Array.isArray(r.j) ? r.j : (r.j?.[e.key] || Object.values(r.j || {}).find(Array.isArray) || []);
    const target = arr.find(o => o.id === row.id);
    const leakedFields = target
      ? Object.entries(target).filter(([, v]) => typeof v === 'string' && LEAKY.test(v)).map(([k]) => k)
      : [];
    judge(r.st === 200 && !LEAKY.test(body) && leakedFields.length === 0,
      `${e.tbl.padEnd(12)} foreign lead NOT disclosed via ${e.path}`,
      `HTTP ${r.st} rows=${arr.length} rowFound=${!!target} leakedFields=[${leakedFields}]`);

    // revert immediately so only one entity is ever mispointed at a time
    await q(`UPDATE ${e.tbl} SET lead_id=$1 WHERE id=$2`, [row.lead_id, row.id]);
    restore.pop();
  }

  // ---------- tasks: the write-boundary guard (assertOwned) ----------
  const t1 = await req('POST', '/api/crm/tasks', { title: 'ZZ-R126-GUARD-PROBE', lead_id: victim });
  judge(t1.st >= 400 && t1.st < 500, 'tasks    POST with a foreign lead_id is REJECTED', `HTTP ${t1.st} ${t1.t}`);
  if (t1.st < 300 && t1.j?.id) { await q(`DELETE FROM tasks WHERE id=$1`, [t1.j.id]); console.log('  (cleaned up the task that should not have been created)'); }

  // ---------- tasks read path: plant a task carrying the foreign lead directly in SQL ----------
  const badTask = (await q(
    `INSERT INTO tasks (tenant_id, title, lead_id, status) VALUES ($1,'ZZ-R126-READPATH',$2,'pending') RETURNING id`,
    [W, victim]))[0].id;
  for (const p of ['/api/crm/tasks', '/api/crm/dashboard/tasks-today']) {
    const r = await req('GET', p);
    const body = JSON.stringify(r.j || {});
    judge(r.st === 200 && !LEAKY.test(body), `tasks    foreign lead NOT disclosed via ${p}`, `HTTP ${r.st} len=${body.length}`);
  }
  await q(`DELETE FROM tasks WHERE id=$1`, [badTask]);

  // ---------- the documented OPEN item: do the other create routes still accept a foreign lead_id? ----------
  console.log('\n--- OPEN ITEM #1 recheck: foreign lead_id at the WRITE boundary ---');
  const openProbes = [
    ['POST /api/crm/contracts',    '/api/crm/contracts',    { lead_id: victim, title: 'ZZ-R126' }],
    ['POST /api/crm/invoices',     '/api/crm/invoices',     { lead_id: victim }],
    ['POST /api/crm/expenses',     '/api/crm/expenses',     { lead_id: victim, amount: 1, category: 'Materials', description: 'ZZ-R126' }],
    ['POST /api/estimates',        '/api/estimates',        { lead_id: victim }],
    ['POST /api/crm/work-orders',  '/api/crm/work-orders',  { lead_id: victim, title: 'ZZ-R126' }],
  ];
  for (const [label, path, body] of openProbes) {
    const r = await req('POST', path, body);
    const accepted = r.st >= 200 && r.st < 300;
    console.log(`  ${accepted ? 'ACCEPTS FOREIGN' : 'rejects        '} ${String(r.st).padEnd(4)} ${label} ${r.t.slice(0, 70)}`);
    if (accepted && r.j?.id) {
      const tbl = path.includes('contracts') ? 'contracts' : path.includes('invoices') ? 'invoices'
        : path.includes('expenses') ? 'expenses' : path.includes('work-orders') ? 'work_orders' : 'estimates';
      await q(`DELETE FROM ${tbl} WHERE id=$1`, [r.j.id]);
      console.log(`     cleaned up ${tbl} ${r.j.id}`);
    }
  }
} finally {
  for (const r of restore) await q(`UPDATE ${r.tbl} SET lead_id=$1 WHERE id=$2`, [r.lead_id, r.id]);
  await q(`DELETE FROM leads WHERE id=$1`, [victim]);
  const after = await counts();
  console.log('\nAFTER ', JSON.stringify(after));
  const netZero = JSON.stringify(before) === JSON.stringify(after);
  console.log(netZero ? 'DB NET ZERO' : '*** DB DRIFT ***');
  console.log(`\n=== ${PASS.length} PASS / ${FAIL.length} FAIL ===`);
  if (FAIL.length) console.log('FAILURES:', FAIL.join(' | '));
  await pool.end();
}
