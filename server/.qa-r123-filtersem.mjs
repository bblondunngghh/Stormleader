// Run 123-s1 — NEW DIMENSION: DO LIST FILTERS ACTUALLY FILTER?
// Prior s1 runs proved status codes and type rejection. Nothing has checked that a
// query param the client sends actually narrows the result set, that `total` tracks
// the filter, or that limit/offset paginate. READ-ONLY.
import fs from 'fs';
const BASE = 'http://localhost:3001';
const T = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { Authorization: `Bearer ${T}` };

const get = async (p) => {
  const r = await fetch(BASE + p, { headers: H });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { }
  return { st: r.status, j, t: t.slice(0, 120).replace(/\s+/g, ' ') };
};
const rows = (j, key) => (Array.isArray(j) ? j : (j && Array.isArray(j[key]) ? j[key] : (j && Array.isArray(j.features) ? j.features : null)));

const FAIL = [], PASS = [], INFO = [];
const rec = (ok, ep, param, msg) => (ok ? PASS : FAIL).push(`${ok ? 'PASS' : 'FAIL'} ${ep} ?${param} :: ${msg}`);

// ep, listKey, [ {param, field, real, realN, zero, bogus} ]
const CASES = [
  ['/api/crm/leads', 'leads', [
    { param: 'stage', field: 'stage', real: 'new', realN: 9, zero: 'sold', bogus: 'zzz' },
    { param: 'priority', field: 'priority', real: 'hot', realN: 2, zero: 'cold', bogus: 'zzz' },
    { param: 'source', field: 'source', real: 'canvassing', realN: 2, zero: 'referral', bogus: 'zzz' },
    { param: 'assigned_rep_id', field: 'assigned_rep_id', real: '45cc729d-cc5b-44b5-93ca-7c01b427fc26', realN: 2, zero: '00000000-0000-4000-8000-000000000000', bogus: null },
  ]],
  ['/api/leads', 'leads', [
    { param: 'stage', field: 'stage', real: 'new', realN: 9, zero: 'sold', bogus: 'zzz' },
    { param: 'priority', field: 'priority', real: 'hot', realN: 2, zero: 'cold', bogus: 'zzz' },
    { param: 'source', field: 'source', real: 'canvassing', realN: 2, zero: 'referral', bogus: 'zzz' },
  ]],
  ['/api/estimates', 'estimates', [
    { param: 'status', field: 'status', real: 'draft', realN: 14, zero: 'sent', bogus: 'zzz' },
  ]],
  ['/api/crm/invoices', 'invoices', [
    { param: 'status', field: 'status', real: 'draft', realN: 7, zero: 'overdue', bogus: 'zzz' },
  ]],
  ['/api/crm/contracts', 'contracts', [
    { param: 'status', field: 'status', real: 'draft', realN: 2, zero: 'signed', bogus: 'zzz' },
  ]],
  ['/api/crm/work-orders', 'workOrders', [
    { param: 'status', field: 'status', real: 'pending', realN: 7, zero: 'cancelled', bogus: 'zzz' },
  ]],
  ['/api/crm/expenses', 'expenses', [
    { param: 'category', field: 'category', real: 'materials', realN: 2, zero: 'labor', bogus: 'zzz' },
  ]],
  ['/api/crm/subcontractors', 'subcontractors', [
    { param: 'specialty', field: 'specialty', real: 'roofing', realN: 2, zero: 'gutters', bogus: 'zzz' },
    { param: 'status', field: 'status', real: 'active', realN: null, zero: 'inactive', bogus: 'zzz' },
  ]],
  ['/api/materials/orders', 'orders', [
    { param: 'status', field: 'status', real: 'draft', realN: 6, zero: 'submitted', bogus: 'zzz' },
  ]],
  ['/api/notifications', 'notifications', [
    { param: 'is_read', field: 'is_read', real: 'false', realN: null, zero: null, bogus: 'zzz' },
  ]],
];

for (const [ep, key, params] of CASES) {
  const all = await get(ep);
  const allRows = rows(all.j, key);
  if (all.st !== 200 || !allRows) { FAIL.push(`FAIL ${ep} baseline st=${all.st} ${all.t}`); continue; }
  const nAll = allRows.length;
  const totAll = all.j && typeof all.j.total === 'number' ? all.j.total : null;
  INFO.push(`${ep} unfiltered rows=${nAll} total=${totAll}`);

  for (const c of params) {
    // ---- real value: must narrow, and every row must match
    const r = await get(`${ep}?${c.param}=${encodeURIComponent(c.real)}`);
    const rr = rows(r.j, key);
    if (r.st !== 200 || !rr) { rec(false, ep, c.param, `real value st=${r.st} ${r.t}`); continue; }
    if (c.realN !== null && rr.length !== c.realN) rec(false, ep, c.param, `real "${c.real}" returned ${rr.length}, DB says ${c.realN}`);
    else rec(true, ep, c.param, `real "${c.real}" -> ${rr.length} rows`);
    const bad = rr.filter((x) => String(x[c.field]) !== String(c.real));
    if (bad.length) rec(false, ep, c.param, `real "${c.real}": ${bad.length}/${rr.length} rows have ${c.field}=${JSON.stringify(bad[0][c.field])}`);
    // total must track the filter
    if (totAll !== null && typeof r.j.total === 'number') {
      if (r.j.total === totAll && rr.length !== nAll) rec(false, ep, c.param, `TOTAL IGNORES FILTER: rows ${rr.length} but total ${r.j.total} (unfiltered ${totAll})`);
      else rec(true, ep, c.param, `total tracks filter (${r.j.total})`);
    }

    // ---- valid-but-empty value: must return 0, not everything
    if (c.zero) {
      const z = await get(`${ep}?${c.param}=${encodeURIComponent(c.zero)}`);
      const zr = rows(z.j, key);
      if (z.st !== 200 || !zr) rec(false, ep, c.param, `zero value "${c.zero}" st=${z.st} ${z.t}`);
      else if (zr.length === 0) rec(true, ep, c.param, `zero "${c.zero}" -> 0 rows`);
      else rec(false, ep, c.param, `zero "${c.zero}" returned ${zr.length} rows (expected 0)`);
    }

    // ---- bogus value: must NOT return the unfiltered set
    if (c.bogus) {
      const b = await get(`${ep}?${c.param}=${encodeURIComponent(c.bogus)}`);
      const br = rows(b.j, key);
      if (b.st >= 500) rec(false, ep, c.param, `bogus "${c.bogus}" -> ${b.st} ${b.t}`);
      else if (b.st >= 400) rec(true, ep, c.param, `bogus "${c.bogus}" -> ${b.st} (rejected)`);
      else if (br && br.length === nAll && nAll > 0) rec(false, ep, c.param, `SILENTLY IGNORED: bogus "${c.bogus}" returned all ${nAll} rows`);
      else rec(true, ep, c.param, `bogus "${c.bogus}" -> ${br ? br.length : '?'} rows`);
    }
  }

  // ---- pagination
  if (nAll > 1) {
    const p1 = await get(`${ep}?limit=1`);
    const p1r = rows(p1.j, key);
    if (!p1r || p1r.length !== 1) rec(false, ep, 'limit', `limit=1 returned ${p1r ? p1r.length : p1.st}`);
    else rec(true, ep, 'limit', 'limit=1 -> 1 row');
    const p2 = await get(`${ep}?limit=1&offset=1`);
    const p2r = rows(p2.j, key);
    if (!p2r || p2r.length !== 1) rec(false, ep, 'offset', `limit=1&offset=1 returned ${p2r ? p2r.length : p2.st}`);
    else if (p1r && p1r[0] && p2r[0] && p1r[0].id === p2r[0].id) rec(false, ep, 'offset', `offset=1 returned the SAME row as offset=0 (${p1r[0].id})`);
    else rec(true, ep, 'offset', 'offset=1 -> different row');
  }
}

console.log('=== INFO ===');
INFO.forEach((x) => console.log(x));
console.log('\n=== FAIL (' + FAIL.length + ') ===');
FAIL.forEach((x) => console.log(x));
console.log('\n=== PASS (' + PASS.length + ') ===');
PASS.forEach((x) => console.log(x));
