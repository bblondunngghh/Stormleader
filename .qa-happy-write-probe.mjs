// Run 45 — happy-path WRITE probe. Exercises PATCH handlers with VALID data,
// writing each field back to its CURRENT value (no-op writes — zero data change,
// no automation/score side-effects). Confirms write paths return 200, not just
// that they reject bad input. Retries login to survive the auth rate-limiter.
const BASE = 'http://localhost:3001';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function login() {
  for (let i = 0; i < 105; i++) { // ride out the 15-min login rate-limit window
    const r = await fetch(BASE + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
    });
    if (r.status === 200) { const b = await r.json(); return b.accessToken || b.token; }
    if (r.status === 429) { console.log(`  login 429, retry ${i + 1}/12 in 10s`); await sleep(10000); continue; }
    console.log('  login unexpected', r.status, await r.text()); return null;
  }
  return null;
}

const token = await login();
if (!token) { console.error('LOGIN FAILED after retries'); process.exit(1); }
const h = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
const results = [];

// 1. PATCH lead priority -> its current value (no scoring/automation: priority not in scoreRelevant)
{
  const lr = await fetch(BASE + '/api/crm/leads?limit=1', { headers: h });
  const lb = await lr.json();
  const lead = (Array.isArray(lb) ? lb : (lb.leads || lb.data || lb.rows || []))[0];
  if (lead) {
    const cur = lead.priority || 'warm';
    const r = await fetch(BASE + '/api/crm/leads/' + lead.id, { method: 'PATCH', headers: h, body: JSON.stringify({ priority: cur }) });
    const b = await r.text();
    results.push({ name: `PATCH /crm/leads/:id {priority:${cur}}`, status: r.status, ok: r.status === 200, snip: b.slice(0, 120) });
  } else results.push({ name: 'PATCH lead', status: 'SKIP', ok: true, snip: 'no lead found' });
}

// 2. PATCH estimate status -> current value
{
  const er = await fetch(BASE + '/api/crm/estimates?limit=1', { headers: h });
  const eb = await er.json();
  const est = (Array.isArray(eb) ? eb : (eb.estimates || eb.data || eb.rows || []))[0];
  if (est) {
    const cur = est.status || 'draft';
    const r = await fetch(BASE + '/api/crm/estimates/' + est.id, { method: 'PATCH', headers: h, body: JSON.stringify({ status: cur }) });
    const b = await r.text();
    results.push({ name: `PATCH /crm/estimates/:id {status:${cur}}`, status: r.status, ok: r.status === 200, snip: b.slice(0, 120) });
  } else results.push({ name: 'PATCH estimate', status: 'SKIP', ok: true, snip: 'no estimate found' });
}

// 3. PATCH invoice -> current status
{
  const ir = await fetch(BASE + '/api/crm/invoices?limit=1', { headers: h });
  const ib = await ir.json();
  const inv = (Array.isArray(ib) ? ib : (ib.invoices || ib.data || ib.rows || []))[0];
  if (inv) {
    const cur = inv.status || 'draft';
    const r = await fetch(BASE + '/api/crm/invoices/' + inv.id, { method: 'PATCH', headers: h, body: JSON.stringify({ status: cur }) });
    const b = await r.text();
    results.push({ name: `PATCH /crm/invoices/:id {status:${cur}}`, status: r.status, ok: r.status === 200, snip: b.slice(0, 120) });
  } else results.push({ name: 'PATCH invoice', status: 'SKIP', ok: true, snip: 'no invoice found' });
}

console.log('\n=== HAPPY-PATH WRITE RESULTS ===');
for (const r of results) console.log(`${r.ok ? 'OK ' : '!! '} ${String(r.status).padEnd(4)} ${r.name}  ${r.ok ? '' : r.snip}`);
const bad = results.filter(r => !r.ok);
console.log(`\n${results.length} writes | ${results.length - bad.length} OK | ${bad.length} FAILED`);
if (bad.length) bad.forEach(b => console.log('  FAIL', b.name, b.status, b.snip));
