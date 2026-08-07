// R70 s1 — AUTH ENFORCEMENT sweep across ALL 272 routes.
// A route that forgot its authenticate/tenantScope middleware leaks or mutates
// another tenant's data with no credentials at all. We are on branch
// feat/financing, so newly added routes are the prime suspects.
//
// SAFETY: no Authorization header, every :param = nonexistent uuid, empty body.
// Cost/outward-effect routes excluded exactly as in the write sweep.
import fs from 'fs';

const BASE = 'http://localhost:3001';
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const NOPE = '00000000-0000-0000-0000-0000000000ff';

const EXCLUDE = new Set([
  '/api/properties/geocode', '/api/properties/import-csv', '/api/properties/trigger-import',
  '/api/counties/:id/import', '/api/crm/test-email', '/api/crm/contracts/:id/send',
  '/api/crm/invoices/:id/send', '/api/crm/invoices/:id/send-email', '/api/estimates/:id/send',
  '/api/crm/financing/plans/sync', '/api/onboarding/setup-payment',
  '/api/payments/connect/onboard', '/api/payments/connect/refresh',
  '/api/payments/create-intent', '/api/payments/public/create-intent',
  '/api/payments/webhook', '/api/skip-trace/submit', '/api/skip-trace/setup-payment',
  '/api/skip-trace/config', '/api/skip-trace/payment-method',
]);

// Routes that are PUBLIC BY DESIGN — customer-facing pages, webhooks, auth.
const EXPECTED_PUBLIC = [
  /^\/api\/auth\//,
  /^\/api\/webhooks\//,
  /^\/api\/payments\/public\//,
  /^\/api\/public\//,
  /\/public\//,
  /^\/api\/health/,
];
const isExpectedPublic = (p) => EXPECTED_PUBLIC.some(rx => rx.test(p));

const fill = (p) => p.replace(/:([A-Za-z_]+)/g, (m, name) => {
  if (/token/i.test(name)) return 'qa-r70-nonexistent-token';
  if (/slug/i.test(name)) return 'qa-r70-nonexistent-slug';
  if (/productId|sku/i.test(name)) return 'qa-r70-nonexistent-sku';
  return NOPE;
});

async function req(method, path, withBody) {
  const opts = { method, headers: {} };          // <-- NO Authorization header
  if (withBody) { opts.headers['Content-Type'] = 'application/json'; opts.body = '{}'; }
  try {
    const r = await fetch(BASE + path, opts);
    return { status: r.status, text: (await r.text()).slice(0, 200) };
  } catch (e) { return { status: 0, text: 'FETCH_ERR ' + e.message }; }
}

const out = [];
for (const r of inv) {
  if (EXCLUDE.has(r.path)) continue;
  const p = fill(r.path);
  const res = await req(r.method, p, r.method !== 'GET');
  const unauth = res.status === 401 || res.status === 403;
  const rec = { method: r.method, path: r.path, file: r.file, status: res.status, unauth, body: res.text };
  out.push(rec);
  if (!unauth && !isExpectedPublic(r.path)) {
    console.log(`OPEN? ${String(res.status).padEnd(4)} ${r.method.padEnd(6)} ${r.path}  [${r.file}]  :: ${res.text.slice(0, 110)}`);
  }
}

fs.writeFileSync('C:/tmp/qa-r70-authsweep.json', JSON.stringify(out, null, 1));
const open = out.filter(o => !o.unauth && !isExpectedPublic(o.path));
const pub = out.filter(o => !o.unauth && isExpectedPublic(o.path));
console.log('\n=== AUTH sweep: ' + out.length + ' routes, no credentials ===');
console.log('401/403 (protected)      : ' + out.filter(o => o.unauth).length);
console.log('reachable, EXPECTED public: ' + pub.length);
console.log('reachable, UNEXPECTED     : ' + open.length + '   <== investigate each');
