// Run 74 s1 — JSONB write-guard coverage.
// Method: create a THROWAWAY row per entity, PATCH it with hostile JSONB shapes,
// read back what was STORED, then delete. Real rows are never touched.
// Rationale (Run 68): a 2xx is not evidence the stored value is usable — an
// accepted-but-wrong shape is latent crash surface for every future reader.
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const mint = async () => (await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
})).json()).accessToken;
const token = await mint();
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const req = async (m, p, body) => {
  const r = await fetch(BASE + p, { method: m, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, json: j, text: t.slice(0, 200) };
};

// hostile shapes for a column whose reader expects an array of objects
const SHAPES = [
  ['string', 'abcde'],
  ['number', 12345],
  ['bool', true],
  ['object', { a: 1 }],
  ['array-of-null', [null]],
  ['array-of-scalar', [1, '', null]],
  ['nested', [{ q: { deep: 1 } }]],
];

const CASES = [
  { name: 'estimates.line_items', create: ['POST', '/api/estimates', { customer_name: 'QA r74 probe', line_items: [] }],
    patch: (id) => `/api/estimates/${id}`, field: 'line_items', table: 'estimates' },
  { name: 'estimates.upgrades', create: ['POST', '/api/estimates', { customer_name: 'QA r74 probe', line_items: [] }],
    patch: (id) => `/api/estimates/${id}`, field: 'upgrades', table: 'estimates' },
  { name: 'estimates.insurance_details', create: ['POST', '/api/estimates', { customer_name: 'QA r74 probe', line_items: [] }],
    patch: (id) => `/api/estimates/${id}`, field: 'insurance_details', table: 'estimates' },
  { name: 'estimates.financing_plan_ids', create: ['POST', '/api/estimates', { customer_name: 'QA r74 probe', line_items: [] }],
    patch: (id) => `/api/estimates/${id}`, field: 'financing_plan_ids', table: 'estimates' },
  { name: 'invoices.line_items', create: ['POST', '/api/crm/invoices', { customer_name: 'QA r74 probe', line_items: [] }],
    patch: (id) => `/api/crm/invoices/${id}`, field: 'line_items', table: 'invoices' },
  { name: 'work_orders.line_items', create: ['POST', '/api/crm/work-orders', { title: 'QA r74 probe', line_items: [] }],
    patch: (id) => `/api/crm/work-orders/${id}`, field: 'line_items', table: 'work_orders' },
];

const created = { estimates: [], invoices: [], work_orders: [] };
const report = [];

for (const c of CASES) {
  const [m, p, body] = c.create;
  const res = await req(m, p, body);
  const id = res.json?.id || res.json?.estimate?.id || res.json?.invoice?.id || res.json?.workOrder?.id || res.json?.work_order?.id;
  if (!id) { console.log(`SKIP ${c.name}: create -> ${res.status} ${res.text.slice(0, 120)}`); continue; }
  created[c.table].push(id);

  const line = [];
  for (const [label, shape] of SHAPES) {
    const pr = await req('PATCH', c.patch(id), { [c.field]: shape });
    let stored = '(unread)';
    if (pr.status < 300) {
      const { rows: [row] } = await pool.query(`SELECT ${c.field}::text AS v FROM ${c.table} WHERE id=$1`, [id]);
      stored = row ? String(row.v).slice(0, 40) : '(gone)';
    }
    line.push({ label, status: pr.status, stored });
  }
  report.push({ name: c.name, line });
  console.log(`\n--- ${c.name} ---`);
  line.forEach(x => console.log(`  ${String(x.status).padEnd(4)} ${x.label.padEnd(16)} stored=${x.stored}`));
}

console.log('\n================ SUMMARY: which columns REJECT hostile shapes ================');
for (const r of report) {
  const rejected = r.line.filter(x => x.status >= 400).length;
  console.log(`${r.name.padEnd(34)} rejected ${rejected}/${r.line.length}  ${rejected === r.line.length ? 'GUARDED' : rejected === 0 ? '** UNGUARDED **' : 'PARTIAL'}`);
}

// ---- cleanup ----
console.log('\ncleanup:');
for (const [t, arr] of Object.entries(created)) {
  if (!arr.length) continue;
  const { rowCount } = await pool.query(`DELETE FROM ${t} WHERE id = ANY($1::uuid[])`, [arr]);
  console.log(`  ${t}: deleted ${rowCount}/${arr.length}`);
}
for (const t of ['estimates', 'invoices', 'work_orders']) {
  const { rows: [c] } = await pool.query(`SELECT COUNT(*)::int n FROM ${t}`);
  console.log(`  ${t} now: ${c.n}`);
}
await pool.end();
