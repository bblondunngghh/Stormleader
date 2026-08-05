// Run 68 / s1 — AXIS E: semantic correctness of 2xx responses.
// Every prior sweep in this pipeline asserted STATUS CODES. This one asserts the BODY.
// E1: a filter must actually filter — returned set must EQUAL the unfiltered rows matching it.
// E2: pagination must actually paginate — limit caps, offset yields a disjoint page.
import fs from 'fs';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function get(path) {
  const r = await fetch(BASE + path, { headers: H });
  const txt = await r.text();
  let body = null;
  try { body = JSON.parse(txt); } catch { body = txt.slice(0, 200); }
  return { status: r.status, body };
}

// Find the array of records in an arbitrary response shape.
function rows(body) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    // prefer conventional keys, then any array of objects
    for (const k of ['data', 'items', 'rows', 'results', 'leads', 'estimates',
                     'contracts', 'invoices', 'expenses', 'orders', 'products',
                     'subcontractors', 'workOrders', 'work_orders', 'tasks',
                     'documents', 'notifications', 'payments', 'properties']) {
      if (Array.isArray(body[k])) return body[k];
    }
    for (const v of Object.values(body)) {
      if (Array.isArray(v) && (v.length === 0 || typeof v[0] === 'object')) return v;
    }
  }
  return null;
}

function idOf(r, i) {
  return r.id ?? r.uuid ?? r._id ?? r.lead_id ?? r.estimate_id ?? JSON.stringify(r) + '#' + i;
}

// endpoints: path, list of eq-filter params (param -> row field), pagination support
const TARGETS = [
  { p: '/api/crm/leads',        eq: ['stage', 'priority', 'source', 'assigned_rep_id'] },
  { p: '/api/leads',            eq: ['stage', 'priority', 'source', 'assigned_rep_id'], page: true },
  { p: '/api/crm/tasks',        eq: ['lead_id', 'assigned_to'] },
  { p: '/api/crm/contracts',    eq: ['status', 'lead_id'] },
  { p: '/api/estimates',        eq: ['status', 'lead_id'] },
  { p: '/api/crm/expenses',     eq: ['lead_id', 'category'] },
  { p: '/api/crm/invoices',     eq: ['status'] },
  { p: '/api/notifications',    eq: ['is_read'] },
  { p: '/api/materials/products', eq: ['category'] },
  { p: '/api/materials/orders', eq: ['status'], page: true },
  { p: '/api/crm/subcontractors', eq: ['specialty', 'status'], page: true },
  { p: '/api/crm/work-orders',  eq: ['status', 'assigned_to'] },
  { p: '/api/documents',        eq: ['lead_id', 'type'] },
  { p: '/api/payments/history', eq: ['status'] },
];

const out = { e1: [], e2: [], meta: [] };

for (const t of TARGETS) {
  // Baseline: grab everything (limit high enough to hold the whole tenant set).
  const base = await get(t.p + '?limit=1000');
  const all = rows(base.body);
  if (base.status !== 200 || !all) {
    out.meta.push({ path: t.p, status: base.status, note: 'baseline not a list — skipped',
                    bodyKeys: base.body && typeof base.body === 'object' ? Object.keys(base.body) : typeof base.body });
    continue;
  }
  out.meta.push({ path: t.p, status: 200, total: all.length,
                  fields: all.length ? Object.keys(all[0]) : [] });
  if (all.length === 0) continue;

  // ---------- E1: filters ----------
  for (const param of t.eq) {
    const field = param;
    if (!(field in all[0])) {
      out.e1.push({ path: t.p, param, verdict: 'NO_SUCH_FIELD',
                    note: `response rows have no "${field}" field — cannot verify` });
      continue;
    }
    // Choose a value that is present on SOME but not ALL rows: a dropped filter is
    // then detectable, because returning everything != returning the matching subset.
    const counts = new Map();
    for (const r of all) {
      const v = r[field];
      if (v === null || v === undefined) continue;
      const k = String(v);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const candidate = [...counts.entries()]
      .filter(([, n]) => n > 0 && n < all.length)
      .sort((a, b) => b[1] - a[1])[0];
    if (!candidate) {
      out.e1.push({ path: t.p, param, verdict: 'NO_DISCRIMINATING_VALUE',
                    note: `all ${all.length} rows share one value or are null — filter untestable here`,
                    distinct: [...counts.keys()].slice(0, 5) });
      continue;
    }
    const [val, expectN] = candidate;
    const res = await get(`${t.p}?limit=1000&${param}=${encodeURIComponent(val)}`);
    const got = rows(res.body);
    if (res.status !== 200 || !got) {
      out.e1.push({ path: t.p, param, val, verdict: 'NON_200', status: res.status,
                    body: typeof res.body === 'string' ? res.body : JSON.stringify(res.body).slice(0, 200) });
      continue;
    }
    const expectIds = new Set(all.filter(r => String(r[field]) === val).map(idOf));
    const gotIds = new Set(got.map(idOf));
    const missing = [...expectIds].filter(x => !gotIds.has(x));
    const extra = [...gotIds].filter(x => !expectIds.has(x));
    const nonMatching = got.filter(r => String(r[field]) !== val).length;

    let verdict;
    if (got.length === all.length && expectN < all.length) verdict = 'FILTER_IGNORED';
    else if (missing.length === 0 && extra.length === 0) verdict = 'PASS';
    else verdict = 'SET_MISMATCH';

    out.e1.push({ path: t.p, param, val, verdict,
                  unfiltered: all.length, expect: expectN, got: got.length,
                  missing: missing.length, extra: extra.length, nonMatchingRowsReturned: nonMatching });
  }

  // ---------- E2: pagination ----------
  if (t.page || true) {
    const lim = await get(t.p + '?limit=3');
    const limRows = rows(lim.body);
    const p1 = await get(t.p + '?limit=2&offset=0');
    const p2 = await get(t.p + '?limit=2&offset=2');
    const r1 = rows(p1.body), r2 = rows(p2.body);
    const rec = { path: t.p, total: all.length,
                  limit3: limRows ? limRows.length : `status ${lim.status}`,
                  page1: r1 ? r1.length : `status ${p1.status}`,
                  page2: r2 ? r2.length : `status ${p2.status}` };
    if (limRows && limRows.length > 3 && all.length > 3) rec.limitVerdict = 'LIMIT_IGNORED';
    else rec.limitVerdict = 'ok';
    if (r1 && r2 && r1.length && r2.length) {
      const s1 = new Set(r1.map(idOf));
      const overlap = r2.map(idOf).filter(x => s1.has(x));
      rec.offsetVerdict = overlap.length === 0 ? 'ok' : 'OFFSET_IGNORED_OR_UNSTABLE';
      rec.overlap = overlap.length;
    } else if (all.length > 2 && r2 && r2.length === 0) {
      rec.offsetVerdict = 'OFFSET_RETURNED_EMPTY_DESPITE_MORE_ROWS';
    } else rec.offsetVerdict = 'n/a';
    out.e2.push(rec);
  }
}

fs.writeFileSync('C:/tmp/qa-r68-axisE.json', JSON.stringify(out, null, 1));

const bad1 = out.e1.filter(r => ['FILTER_IGNORED', 'SET_MISMATCH', 'NON_200'].includes(r.verdict));
const bad2 = out.e2.filter(r => r.limitVerdict !== 'ok' ||
  !['ok', 'n/a'].includes(r.offsetVerdict));
console.log(`E1 checks: ${out.e1.length}  suspicious: ${bad1.length}`);
for (const b of bad1) console.log('  !!', b.verdict, b.path, `?${b.param}=${b.val}`,
  `unfiltered=${b.unfiltered} expect=${b.expect} got=${b.got}`);
console.log(`E2 checks: ${out.e2.length}  suspicious: ${bad2.length}`);
for (const b of bad2) console.log('  !!', b.path, JSON.stringify(b));
console.log('--- untestable/skipped ---');
for (const r of out.e1.filter(r => !['PASS'].includes(r.verdict) && !bad1.includes(r)))
  console.log('  ..', r.verdict, r.path, r.param, r.note || '');
for (const m of out.meta.filter(m => m.note)) console.log('  ..', m.path, m.status, m.note, JSON.stringify(m.bodyKeys));
