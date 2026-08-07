// R70 s1 — WRITE-PATH SWEEP. The pipeline's thinnest area: only 3 of 140 write
// routes had ever been exercised. This probes ALL of them.
//
// SAFETY MODEL:
//  * Every :param is filled with a NONEXISTENT but VALID uuid, so no real row is
//    ever read, updated or deleted. PATCH/PUT with an empty body against a REAL
//    id could null out live columns — that is why we never use a real id here.
//  * Cost/outward-effect routes are hard-excluded (geocoding = real money,
//    */send = real email to real customers, imports = bulk writes).
//  * POST-to-collection with {} may still create a row if validation is missing —
//    that IS the finding. Response bodies are captured so ids can be cleaned up.
//
// Expected: 400 (validation) / 404 (bad id) / 403 (gated). A 500 is a BUG.
// A 2xx on an empty body is a validation gap worth triaging.
import fs from 'fs';

const BASE = 'http://localhost:3001';
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

const NOPE = '00000000-0000-0000-0000-0000000000ff'; // valid uuid, no such row

// Hard exclusions — real money, real email, or bulk writes. Logged, not silent.
const EXCLUDE = [
  '/api/properties/geocode',          // Google geocoding = real money
  '/api/properties/import-csv',       // bulk writes
  '/api/properties/trigger-import',   // bulk writes
  '/api/counties/:id/import',         // bulk writes
  '/api/crm/test-email',              // sends real email
  '/api/crm/contracts/:id/send',
  '/api/crm/invoices/:id/send',
  '/api/crm/invoices/:id/send-email',
  '/api/estimates/:id/send',
  '/api/crm/financing/plans/sync',
  '/api/onboarding/setup-payment',
  '/api/payments/connect/onboard',
  '/api/payments/connect/refresh',
  '/api/payments/create-intent',
  '/api/payments/public/create-intent',
  '/api/payments/webhook',
  '/api/skip-trace/submit',
  '/api/skip-trace/setup-payment',
  '/api/skip-trace/config',
  '/api/skip-trace/payment-method',
];

let TOKEN = null;
async function login() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error('login failed: ' + JSON.stringify(j).slice(0, 200));
  TOKEN = j.accessToken;
}
await login();

async function req(method, path, body) {
  const opts = { method, headers: { Authorization: 'Bearer ' + TOKEN } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  try {
    const r = await fetch(BASE + path, opts);
    const ct = r.headers.get('content-type') || '';
    const text = await r.text();
    return { status: r.status, ct: ct.split(';')[0], text: text.slice(0, 400) };
  } catch (e) {
    return { status: 0, ct: '', text: 'FETCH_ERR ' + e.message };
  }
}

// fill every :param with a nonexistent-but-valid id
function fill(p) {
  return p.replace(/:([A-Za-z_]+)/g, (m, name) => {
    if (/token/i.test(name)) return 'qa-r70-nonexistent-token';
    if (/slug/i.test(name)) return 'qa-r70-nonexistent-slug';
    if (/productId|sku/i.test(name)) return 'qa-r70-nonexistent-sku';
    return NOPE;
  });
}

const writes = inv.filter(r => r.method !== 'GET');
const out = [];
const skipped = [];

for (const r of writes) {
  if (EXCLUDE.includes(r.path)) { skipped.push(r.method + ' ' + r.path); continue; }
  const p = fill(r.path);
  const res = await req(r.method, p, {});          // empty body
  const rec = {
    file: r.file, method: r.method, path: r.path, actual: p,
    status: res.status, ct: res.ct, body: res.text,
  };
  out.push(rec);
  if (res.status >= 500 || res.status === 0) {
    console.log('!!! ' + res.status + ' ' + r.method + ' ' + p + '\n    ' + res.text.slice(0, 250));
  } else if (res.status >= 200 && res.status < 300) {
    console.log('??? 2xx-on-empty-body ' + r.method + ' ' + p + ' :: ' + res.text.slice(0, 160));
  }
}

fs.writeFileSync('C:/tmp/qa-r70-writesweep.json', JSON.stringify({ skipped, out }, null, 1));

const byStatus = {};
for (const o of out) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
console.log('\n=== WRITE sweep: ' + out.length + ' routes probed, ' + skipped.length + ' excluded ===');
console.log(JSON.stringify(byStatus));
const bad = out.filter(o => o.status >= 500 || o.status === 0);
const accepted = out.filter(o => o.status >= 200 && o.status < 300);
console.log('5xx/0 (BUGS): ' + bad.length);
bad.forEach(o => console.log('   ' + o.status + ' ' + o.method + ' ' + o.path + ' [' + o.file + ']'));
console.log('2xx on empty body (validation gaps): ' + accepted.length);
accepted.forEach(o => console.log('   ' + o.status + ' ' + o.method + ' ' + o.path + ' [' + o.file + ']'));
console.log('\nEXCLUDED (cost/outward-effect/bulk):');
skipped.forEach(s => console.log('   ' + s));
