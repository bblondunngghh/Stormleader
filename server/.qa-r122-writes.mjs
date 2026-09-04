// Run 122-s1 — sweep 2: the 52 PATCH/PUT/DELETE routes, untouched by sweep 1.
// Three passes, all chosen so NOTHING can be written:
//   A) DEAD-but-valid uuid  -> WHERE id=<dead> matches 0 rows -> expect 404
//   B) MALFORMED id ('abc') -> expect 400 "Invalid id format", never 500
//   C) tenant-singleton routes (no :id) with an EMPTY body -> documented no-op
// Snapshots count(*) AND max(updated_at) per table around the whole thing.
// SKIPs by SEMANTICS: DELETE /skip-trace/payment-method (no id - would really
// delete the tenant's saved card).
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const T = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const DEAD = '00000000-0000-4000-8000-000000000000';

const req = async (m, p, b) => {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(BASE + p, {
      method: m,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T },
      body: b === undefined ? undefined : JSON.stringify(b), signal: ctl.signal,
    });
    const t = await r.text();
    return { st: r.status, body: t.slice(0, 200) };
  } catch (e) { return { st: 0, body: 'ERR ' + e.name }; } finally { clearTimeout(to); }
};

const q = async (sql, p = []) => { try { return (await pool.query(sql, p)).rows; } catch (e) { return [{ __err: e.code }]; } };
const TABLES = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`)).map(r => r.table_name).filter(Boolean);
const UPD = {};
for (const t of TABLES) UPD[t] = (await q(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='updated_at'`, [t])).length > 0;
async function snap() {
  const s = {};
  for (const t of TABLES) {
    const r = await q(`SELECT count(*)::int c${UPD[t] ? ', max(updated_at) m' : ''} FROM "${t}"`);
    s[t] = r[0] && !r[0].__err ? { c: r[0].c, m: r[0].m ? String(r[0].m) : null } : { err: 1 };
  }
  return s;
}

const SKIP = /skip-trace\/payment-method|admin\/tenants/;
const writes = inv.filter(r => ['PATCH', 'PUT', 'DELETE'].includes(r.method) && !SKIP.test(r.path));
const withId = writes.filter(r => /:/.test(r.path));
const singletons = writes.filter(r => !/:/.test(r.path));

const before = await snap();
const A = [], B = [], C = [];

// A) dead uuid
for (const r of withId) {
  const p = r.path.replace(/:[A-Za-z_]+/g, DEAD);
  const res = await req(r.method, p, r.method === 'DELETE' ? undefined : { notes: 'qa-r122-dead-uuid-probe' });
  A.push({ m: r.method, path: r.path, st: res.st, body: res.body });
}
// B) malformed id
for (const r of withId) {
  const p = r.path.replace(/:[A-Za-z_]+/g, 'abc');
  const res = await req(r.method, p, r.method === 'DELETE' ? undefined : { notes: 'qa-r122-badid-probe' });
  B.push({ m: r.method, path: r.path, st: res.st, body: res.body });
}
// C) tenant singletons, empty body
for (const r of singletons) {
  const res = await req(r.method, r.path, {});
  C.push({ m: r.method, path: r.path, st: res.st, body: res.body });
}

const after = await snap();
const drift = [];
for (const t of TABLES) {
  const b = before[t], a = after[t]; if (!b || !a || b.err || a.err) continue;
  if (b.c !== a.c) drift.push({ table: t, kind: 'COUNT', before: b.c, after: a.c });
  if (b.m !== a.m) drift.push({ table: t, kind: 'UPDATED_AT', before: b.m, after: a.m });
}

fs.writeFileSync('C:/tmp/qa-r122-writes.json', JSON.stringify({ A, B, C, drift }, null, 1));
const hist = a => { const h = {}; a.forEach(x => h[x.st] = (h[x.st] || 0) + 1); return JSON.stringify(h); };
console.log('=== A) DEAD uuid on', A.length, 'routes ===', hist(A));
A.filter(x => x.st === 0 || x.st >= 500 || (x.st >= 200 && x.st < 300)).forEach(x => console.log('  !!', x.st, x.m, x.path, '|', x.body.slice(0, 140)));
console.log('\n=== B) MALFORMED id on', B.length, 'routes ===', hist(B));
B.filter(x => x.st === 0 || x.st >= 500 || (x.st >= 200 && x.st < 300)).forEach(x => console.log('  !!', x.st, x.m, x.path, '|', x.body.slice(0, 140)));
console.log('\n=== C) tenant singletons, empty body:', C.length, '===', hist(C));
C.forEach(x => console.log('  ', x.st, x.m, x.path, '|', x.body.slice(0, 110)));
console.log('\n=== DB DRIFT ===');
console.log(drift.length ? JSON.stringify(drift, null, 1) : 'NONE');
await pool.end();
