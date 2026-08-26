// Run 97 (s1-api-test) — PROTOTYPE-KEY LOOKUP probe.
//
// THE CLASS: `MAP[userInput] ?? fallback` on a PLAIN OBJECT LITERAL. A plain object
// inherits Object.prototype, so `MAP['constructor']`, `MAP['toString']`, `MAP['__proto__']`
// etc. return a TRUTHY inherited value and the `??` / `||` fallback NEVER FIRES. The
// caller then uses a Function/Object where it expected a whitelisted string.
//
// Two reachable sites found by grep:
//   1. routes/admin.js:126   sortCol = SORTABLE[sort] ?? 't.created_at'  -> spliced into
//                            `ORDER BY ${sortCol}` => SQL syntax error => 500.
//                            (super_admin only)
//   2. services/workOrderService.js:150  MILESTONE_TEMPLATES[templateKey] || .default
//                            -> template.milestones is undefined -> .map() TypeError => 500,
//                            AFTER the work_orders row is already inserted (orphan row).
//
// This file probes site 1 ONLY (read-only GETs, zero writes). Site 2 is a write and is
// probed separately.
import fs from 'fs';
import jwt from 'jsonwebtoken';
import pool from './src/db/pool.js';
import config from './src/config/env.js';

const BASE = 'http://localhost:3001';

const { rows: [u] } = await pool.query(
  "SELECT id, email, role, tenant_id FROM users WHERE role = 'super_admin' LIMIT 1"
);
if (!u) { console.log('NO super_admin USER — cannot probe site 1'); await pool.end(); process.exit(0); }
console.log('super_admin:', u.email);

const superTok = jwt.sign(
  { id: u.id, tenantId: u.tenant_id, email: u.email, role: 'super_admin' },
  config.JWT_SECRET,
  { expiresIn: '15m' }
);
const adminTok = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();

const get = async (path, tok) => {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${tok}` } });
  let body = null;
  try { body = await r.json(); } catch { /* non-json */ }
  return { status: r.status, body };
};

// sanity: the happy path must work as super_admin, else the probe proves nothing
const base = await get('/api/admin/tenants', superTok);
console.log(`\nBASELINE  GET /api/admin/tenants -> ${base.status} (rows=${Array.isArray(base.body) ? base.body.length : 'n/a'})`);
if (base.status !== 200) {
  console.log('  baseline is not 200 — every result below would be meaningless. body:', JSON.stringify(base.body).slice(0, 200));
  await pool.end();
  process.exit(1);
}
const goodSort = await get('/api/admin/tenants?sort=name&order=asc', superTok);
console.log(`BASELINE  ?sort=name&order=asc      -> ${goodSort.status}`);
const junkSort = await get('/api/admin/tenants?sort=totally_not_a_column', superTok);
console.log(`BASELINE  ?sort=totally_not_a_column -> ${junkSort.status}  (whitelist fallback works for ORDINARY junk)`);

console.log('\n--- prototype keys (each SHOULD fall back to the default sort, i.e. 200) ---');
const defects = [];
const cases = [
  ['?sort=constructor', 'inherited Function -> spliced into ORDER BY'],
  ['?sort=__proto__', 'inherited Object.prototype -> "[object Object]"'],
  ['?sort=toString', 'inherited Function'],
  ['?sort=valueOf', 'inherited Function'],
  ['?sort=hasOwnProperty', 'inherited Function'],
  ['?order=constructor', 'order is compared, not spliced — expect 200'],
  ['?order[]=a&order[]=b', 'array -> order.toLowerCase is not a function'],
  ['?sort[]=a&sort[]=b', 'array sort key'],
];
for (const [q, why] of cases) {
  const r = await get(`/api/admin/tenants${q}`, superTok);
  const bad = r.status >= 500;
  if (bad) defects.push({ q, status: r.status, why });
  console.log(`  ${bad ? 'DEFECT' : '  ok  '} ${r.status}  ${q.padEnd(24)} ${why}`);
  if (bad) console.log('           ', JSON.stringify(r.body || {}).slice(0, 220));
}

// confirm the route is still correctly 403 for a plain admin (regression guard)
const asAdmin = await get('/api/admin/tenants?sort=constructor', adminTok);
console.log(`\nrole guard: same request as plain admin -> ${asAdmin.status} (expect 403)`);

console.log(`\n5xx DEFECTS: ${defects.length}`);
for (const d of defects) console.log(`  ${d.status}  ${d.q}`);

await pool.end();
