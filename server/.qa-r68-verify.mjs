// Run 68 s4-verify — re-verify the 5 fixes committed after checkpoint 1b29eb0.
// READ-ONLY except for POST /crm/custom-fields probes, which are all expected to be
// REJECTED at validation (400) — the throw/return precedes the INSERT, so 0 rows written.
import fs from 'node:fs';

const TOKEN = fs.readFileSync('C:/tmp/qa-r68-token.txt', 'utf8').trim();
const FRESH = process.env.FRESH_BASE || 'http://localhost:3099';

const results = [];
function rec(fix, name, expected, actual, pass, note = '') {
  results.push({ fix, name, expected, actual, pass, note });
  console.log(`${pass ? 'PASS' : 'FAIL'}  [${fix}] ${name}  expected=${expected} actual=${actual}${note ? '  ' + note : ''}`);
}

async function req(base, path, opts = {}) {
  const r = await fetch(base + path, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const ct = r.headers.get('content-type') || '';
  let body;
  if (ct.includes('application/json')) body = await r.json().catch(() => null);
  else if (ct.includes('pdf')) { const b = await r.arrayBuffer(); body = { __pdfBytes: b.byteLength, __magic: Buffer.from(b.slice(0, 5)).toString('latin1') }; }
  else body = (await r.text().catch(() => '')).slice(0, 300);
  return { status: r.status, body, ct };
}

// ─────────────────────────────────────────────────────────────
// FIX a9fb0e4 — custom-fields type guard on field_label / field_key
// ─────────────────────────────────────────────────────────────
const badShapes = [
  ['field_label array', { field_label: [1, 2] }],
  ['field_label number', { field_label: 123 }],
  ['field_label boolean', { field_label: true }],
  ['field_label object', { field_label: { a: 1 } }],
  ['field_key array', { field_label: 'QA Probe', field_key: ['x', 'y'] }],
  ['field_key number', { field_label: 'QA Probe', field_key: 42 }],
  ['field_key object', { field_label: 'QA Probe', field_key: { a: 1 } }],
  ['field_key boolean', { field_label: 'QA Probe', field_key: true }],
];
for (const [name, body] of badShapes) {
  const r = await req(FRESH, '/api/crm/custom-fields', { method: 'POST', body: JSON.stringify(body) });
  rec('a9fb0e4', name, '400', r.status, r.status === 400, JSON.stringify(r.body).slice(0, 90));
}
{
  const r = await req(FRESH, '/api/crm/custom-fields', { method: 'POST', body: JSON.stringify({}) });
  rec('a9fb0e4', 'CONTROL empty body', '400', r.status, r.status === 400, JSON.stringify(r.body).slice(0, 90));
}
{
  const r = await req(FRESH, '/api/crm/custom-fields');
  rec('a9fb0e4', 'CONTROL GET list still works', '200', r.status, r.status === 200,
    Array.isArray(r.body) ? `${r.body.length} fields` : Array.isArray(r.body?.data) ? `${r.body.data.length} fields` : '');
}

// ─────────────────────────────────────────────────────────────
// FIX a023c66 — estimate PDF with a null line_items entry
// ─────────────────────────────────────────────────────────────
const estList = await req(FRESH, '/api/estimates?limit=100');
const rows = Array.isArray(estList.body) ? estList.body : (estList.body?.data || estList.body?.estimates || []);
console.log(`\n[a023c66] estimate list -> ${estList.status}, ${rows.length} rows`);
const byNum = Object.fromEntries(rows.map(e => [e.estimate_number, e]));
const targets = ['EST-082', 'EST-083'];
for (const num of targets) {
  const e = byNum[num];
  if (!e) { rec('a023c66', `${num} present in list`, 'found', 'MISSING', false); continue; }
  const r = await req(FRESH, `/api/estimates/${e.id}/pdf`);
  const ok = r.status === 200 && r.body?.__magic?.startsWith('%PDF');
  rec('a023c66', `${num} PDF`, '200 + %PDF', `${r.status} ${r.body?.__magic || ''} ${r.body?.__pdfBytes || ''}b`, ok);
}
// control: a normal estimate must still render
const control = rows.find(e => !targets.includes(e.estimate_number));
if (control) {
  const r = await req(FRESH, `/api/estimates/${control.id}/pdf`);
  const ok = r.status === 200 && r.body?.__magic?.startsWith('%PDF');
  rec('a023c66', `CONTROL ${control.estimate_number} PDF unaffected`, '200 + %PDF', `${r.status} ${r.body?.__pdfBytes || ''}b`, ok);
}
// sweep every estimate — the fix claims identity on 75 of 77
let sweepFail = [];
for (const e of rows) {
  const r = await req(FRESH, `/api/estimates/${e.id}/pdf`);
  if (r.status !== 200) sweepFail.push(`${e.estimate_number}:${r.status}`);
}
rec('a023c66', `SWEEP all ${rows.length} estimate PDFs`, '0 non-200', `${sweepFail.length} non-200`, sweepFail.length === 0, sweepFail.join(','));

// ─────────────────────────────────────────────────────────────
// FIX d6fa299 — estimate summary no longer windowed to 30 days
// ─────────────────────────────────────────────────────────────
{
  const r = await req(FRESH, '/api/crm/dashboard/estimate-summary');
  const s = r.body?.data || r.body || {};
  const total = ['draft', 'sent', 'viewed', 'accepted'].reduce((a, k) => a + Number(s[k] || 0), 0);
  rec('d6fa299', 'estimate-summary counts non-zero', '>0', total, total > 0, JSON.stringify(s).slice(0, 160));
  const listCount = rows.length;
  rec('d6fa299', 'summary reconciles with estimate list', `>=${listCount}`, total, total >= listCount,
    `list=${listCount} summary=${total}`);
}

// ─────────────────────────────────────────────────────────────
// FIX 0692fc2 (server side) — days-in-stage returns enum KEYS, and
// /api/leads?stage=<key> accepts every key the dashboard links to.
// ─────────────────────────────────────────────────────────────
{
  const r = await req(FRESH, '/api/crm/dashboard/days-in-stage');
  const arr = r.body?.data || r.body || [];
  const stages = (Array.isArray(arr) ? arr : []).map(s => s.stage);
  console.log(`\n[0692fc2] days-in-stage stages: ${JSON.stringify(stages)}`);
  let bad = [];
  for (const st of stages) {
    const lr = await req(FRESH, `/api/leads?stage=${encodeURIComponent(st)}&limit=1`);
    if (lr.status !== 200) bad.push(`${st}:${lr.status}`);
  }
  rec('0692fc2', `days-in-stage links (${stages.length}) all accepted by /api/leads`, '0 rejected', `${bad.length} rejected`, bad.length === 0, bad.join(','));
  const sold = await req(FRESH, '/api/leads?stage=sold&limit=1');
  rec('0692fc2', 'GET /api/leads?stage=sold (the new KPI link)', '200', sold.status, sold.status === 200);
  const old = await req(FRESH, '/api/leads?stage=closed_won&limit=1');
  rec('0692fc2', 'GET /api/leads?stage=closed_won (the OLD broken link)', 'documented', old.status, true,
    `was the pre-fix target; now ${old.status}`);
}

// ─────────────────────────────────────────────────────────────
// STALENESS PROBE — is the :3001 the browser proxies to current?
// ─────────────────────────────────────────────────────────────
console.log('\n=== :3001 staleness (browser proxy target) ===');
try {
  const lr = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
  });
  const tok3001 = (await lr.json()).accessToken;
  const g = async (p) => {
    const r = await fetch('http://localhost:3001' + p, { headers: { Authorization: `Bearer ${tok3001}` } });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const es = await g('/api/crm/dashboard/estimate-summary');
  const s = es.body?.data || es.body || {};
  const total = ['draft', 'sent', 'viewed', 'accepted'].reduce((a, k) => a + Number(s[k] || 0), 0);
  console.log(`:3001 estimate-summary total=${total}  ${JSON.stringify(s).slice(0, 160)}`);
  const cf = await fetch('http://localhost:3001/api/crm/custom-fields', {
    method: 'POST', headers: { Authorization: `Bearer ${tok3001}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ field_label: 123 }),
  });
  console.log(`:3001 custom-fields{field_label:123} -> ${cf.status} (400 = a9fb0e4 is live on :3001)`);
  results.push({ fix: 'ENV', name: ':3001 estimate-summary total', expected: 'matches :3099', actual: total, pass: null });
} catch (e) {
  console.log(':3001 probe failed: ' + e.message);
}

fs.writeFileSync('C:/tmp/qa-r68-verify.json', JSON.stringify(results, null, 2));
const failed = results.filter(r => r.pass === false);
console.log(`\n===== ${results.length} checks, ${failed.length} FAILED =====`);
failed.forEach(f => console.log(`  FAIL [${f.fix}] ${f.name}: expected ${f.expected}, got ${f.actual} ${f.note}`));
