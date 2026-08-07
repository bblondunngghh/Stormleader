// R70 s1 — DATA-CORRECTNESS sweep. Run 67's lesson: an error-signal sweep cannot
// see a route that returns 200 with the WRONG DATA. This reads the values.
//
// Checks per list endpoint:
//   A. limit=1 must return <= 1 row          (limit honoured)
//   B. offset=1 must differ from offset=0    (offset honoured, not silently dropped)
//   C. limit=abc / limit=-1 / limit=0        (must not 500, must not dump the table)
import fs from 'fs';

const BASE = 'http://localhost:3001';
const r0 = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
});
const TOKEN = (await r0.json()).accessToken;

async function get(path) {
  const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + TOKEN } });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch {}
  return { status: r.status, j, text: text.slice(0, 200) };
}
function arrOf(j) {
  if (Array.isArray(j)) return j;
  if (!j || typeof j !== 'object') return null;
  for (const k of ['data', 'items', 'rows', 'results', 'leads', 'estimates', 'invoices',
    'contracts', 'workOrders', 'subcontractors', 'expenses', 'products', 'orders', 'tasks']) {
    if (Array.isArray(j[k])) return j[k];
  }
  for (const v of Object.values(j)) if (Array.isArray(v)) return v;
  return null;
}
const idOf = (o) => (o && (o.id ?? o.event_id ?? o.sku ?? JSON.stringify(o).slice(0, 60))) || null;

// CRM list endpoints only — /api/properties has 94k rows and is off-limits for
// wide reads (Neon free tier + it is global reference data).
const LISTS = [
  '/api/crm/leads', '/api/estimates', '/api/crm/invoices', '/api/crm/contracts',
  '/api/crm/work-orders', '/api/crm/subcontractors', '/api/crm/expenses',
  '/api/crm/tasks', '/api/materials/products', '/api/materials/orders',
  '/api/crm/prospect-lists', '/api/notifications', '/api/crm/documents',
];

const findings = [];
for (const base of LISTS) {
  const sep = base.includes('?') ? '&' : '?';
  const all = await get(base);
  if (all.status !== 200) { console.log(`skip ${base} (status ${all.status})`); continue; }
  const allArr = arrOf(all.j);
  if (!allArr) { console.log(`skip ${base} (no array in response)`); continue; }

  // A. limit honoured
  const l1 = await get(`${base}${sep}limit=1`);
  const l1Arr = arrOf(l1.j) || [];
  const limitOk = l1Arr.length <= 1;

  // B. offset honoured (only meaningful with >=2 rows)
  let offsetOk = 'n/a';
  if (allArr.length >= 2) {
    const o0 = await get(`${base}${sep}limit=1&offset=0`);
    const o1 = await get(`${base}${sep}limit=1&offset=1`);
    const a = idOf((arrOf(o0.j) || [])[0]);
    const b = idOf((arrOf(o1.j) || [])[0]);
    offsetOk = (a && b && a !== b) ? true : false;
  }

  // C. hostile limits must not 500 and must not dump more than the table
  const bad = {};
  for (const v of ['abc', '-1', '0', '99999999']) {
    const r = await get(`${base}${sep}limit=${v}`);
    bad[v] = { status: r.status, n: (arrOf(r.j) || []).length };
  }

  const row = { endpoint: base, total: allArr.length, limitOk, offsetOk, bad };
  findings.push(row);
  const flag = (!limitOk || offsetOk === false || Object.values(bad).some(b => b.status >= 500)) ? '  <== FLAG' : '';
  console.log(`${base.padEnd(30)} n=${String(allArr.length).padEnd(5)} limit=${String(limitOk).padEnd(5)} offset=${String(offsetOk).padEnd(5)} hostile=${JSON.stringify(bad)}${flag}`);
}

fs.writeFileSync('C:/tmp/qa-r70-datacorrect.json', JSON.stringify(findings, null, 1));
console.log('\n--- FLAGS ---');
findings.filter(f => !f.limitOk).forEach(f => console.log('LIMIT IGNORED : ' + f.endpoint + ' (limit=1 returned ' + f.total + ')'));
findings.filter(f => f.offsetOk === false).forEach(f => console.log('OFFSET IGNORED: ' + f.endpoint));
findings.forEach(f => Object.entries(f.bad).forEach(([k, v]) => {
  if (v.status >= 500) console.log('5xx on limit=' + k + ' : ' + f.endpoint);
}));
