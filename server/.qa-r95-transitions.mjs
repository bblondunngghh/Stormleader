// Run 95 (s1-api-test) — execute the state-transition PATCH routes that EVERY prior
// write sweep deliberately held back. They mutate regardless of body, so they have
// never been executed by QA.
//
// SAFETY: full row snapshot before, explicit restore after, restore VERIFIED by
// re-read + deep compare, plus a global row-count drift check.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };
const { rows: [t] } = await pool.query("SELECT id FROM tenants WHERE slug='waterloo'");
const TID = t.id;

const snapshotAll = async () => {
  const { rows } = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  const c = {};
  for (const { tablename } of rows) {
    try { c[tablename] = (await pool.query(`SELECT count(*)::int n FROM "${tablename}"`)).rows[0].n; } catch {}
  }
  return c;
};
const getRow = async (tb, id) => (await pool.query(`SELECT * FROM ${tb} WHERE id=$1`, [id])).rows[0] || null;
const restore = async (tb, id, snap) => {
  // node-postgres binds a JS ARRAY as a Postgres ARRAY LITERAL, not JSON. Restoring a
  // jsonb column that way turns [] into '{}' -> a jsonb OBJECT, silently corrupting the
  // row. Serialize objects/arrays to text and cast instead.
  const cols = Object.keys(snap).filter(c => c !== 'id');
  const vals = cols.map(c => (snap[c] !== null && typeof snap[c] === 'object' && !(snap[c] instanceof Date))
    ? JSON.stringify(snap[c]) : snap[c]);
  const sets = cols.map((c, i) => (vals[i] !== null && typeof snap[c] === 'object' && !(snap[c] instanceof Date))
    ? `"${c}" = $${i + 1}::jsonb` : `"${c}" = $${i + 1}`).join(', ');
  await pool.query(`UPDATE ${tb} SET ${sets} WHERE id = $${cols.length + 1}`, [...vals, id]);
};
const diff = (a,b) => Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));

const before = await snapshotAll();
const defects = [];

const cases = [
  { label: 'PATCH /api/crm/work-orders/:id/complete', table: 'work_orders',
    pick: `SELECT id FROM work_orders WHERE tenant_id=$1 AND status <> 'completed' LIMIT 1`,
    url: id => `/api/crm/work-orders/${id}/complete`,
    expect: r => r.status === 'completed' && r.completed_at !== null },
  { label: 'PATCH /api/notifications/:id/read', table: 'notifications',
    pick: `SELECT id FROM notifications WHERE tenant_id=$1 AND COALESCE(is_read,false)=false LIMIT 1`,
    url: id => `/api/notifications/${id}/read`,
    expect: r => r.is_read === true },
];

for (const c of cases) {
  const { rows } = await pool.query(c.pick, [TID]);
  if (!rows[0]) { console.log(`  --  SKIP (no eligible row) ${c.label}`); continue; }
  const id = rows[0].id;
  const snap = await getRow(c.table, id);

  let status, body = '';
  try {
    const res = await fetch(`${BASE}${c.url(id)}`, { method: 'PATCH', headers: H, body: JSON.stringify({}) });
    status = res.status; body = (await res.text()).slice(0, 160);
  } catch (e) { status = 'THREW'; body = String(e); }

  const after = await getRow(c.table, id);
  const moved = diff(snap, after).filter(k => k !== 'updated_at');
  const transitioned = after ? c.expect(after) : false;
  const bad = (typeof status === 'number' && status >= 500) || status === 'THREW' || !transitioned;
  if (bad) defects.push({ label: c.label, status, body, transitioned });

  console.log(`  ${bad ? 'DEFECT' : '  ok  '} ${String(status).padEnd(5)} ${c.label}`);
  console.log(`         row ${id.slice(0,8)}  changed=[${moved.join(',')}]  transitioned=${transitioned}`);
  if (bad) console.log(`         ${body.replace(/\s+/g,' ')}`);

  // restore + verify
  await restore(c.table, id, snap);
  const restored = await getRow(c.table, id);
  const residual = diff(snap, restored);
  console.log(`         restored: ${residual.length ? 'FAILED residual=[' + residual.join(',') + ']' : 'verified clean'}`);
}

const after = await snapshotAll();
const drift = Object.keys(after).filter(k => before[k] !== after[k]).map(k => `${k}: ${before[k]}->${after[k]}`);
console.log(`\nglobal row-count drift: ${drift.length ? drift.join(', ') : 'NONE (0 net writes)'}`);
console.log(`defects: ${defects.length}`);
await pool.end();
