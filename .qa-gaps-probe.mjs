// Run 42 — probe routes uncovered by standing probe suites.
// Negative-case only: bad UUIDs, empty bodies, malformed tokens.
// Skips FEMA endpoints, bulk-write endpoints (generate-leads, import-csv,
// trigger-import) per project constraints (no FEMA touching, no bulk writes).

import { readFileSync, writeFileSync } from 'node:fs';

const API = 'http://localhost:3001';
const ZERO = '00000000-0000-0000-0000-000000000000';
const BAD_TOKEN = 'invalidtoken123';

const token = readFileSync('/tmp/qa-token.txt', 'utf8').trim();
const auth = { Authorization: `Bearer ${token}` };
const jsonAuth = { ...auth, 'Content-Type': 'application/json' };
const jsonOnly = { 'Content-Type': 'application/json' };

const results = [];

async function probe(label, method, path, opts = {}) {
  const url = path.startsWith('http') ? path : API + path;
  const headers = opts.public ? (opts.body ? jsonOnly : {}) : (opts.body ? jsonAuth : auth);
  try {
    const r = await fetch(url, {
      method,
      headers,
      body: opts.body || undefined,
    });
    const text = (await r.text()).slice(0, 300);
    results.push({ label, method, path, status: r.status, body: text });
  } catch (e) {
    results.push({ label, method, path, status: 'ERR', body: String(e) });
  }
}

// ===== auth =====
await probe('AUTH:register-empty', 'POST', '/api/auth/register', { body: '{}' });
await probe('AUTH:register-bad-json', 'POST', '/api/auth/register', { body: '{ bad json' });
await probe('AUTH:register-partial', 'POST', '/api/auth/register', { body: JSON.stringify({ email: 'foo' }) });
await probe('AUTH:refresh-empty', 'POST', '/api/auth/refresh', { body: '{}' });
await probe('AUTH:refresh-bad-token', 'POST', '/api/auth/refresh', { body: JSON.stringify({ refreshToken: BAD_TOKEN }) });
await probe('AUTH:refresh-bad-json', 'POST', '/api/auth/refresh', { body: '{ bad' });

// ===== canvassing =====
await probe('CANV:convert-zero', 'POST', `/api/crm/canvass-pins/${ZERO}/convert`, { body: '{}' });
await probe('CANV:convert-bad-uuid', 'POST', '/api/crm/canvass-pins/notauuid/convert', { body: '{}' });

// ===== contracts =====
await probe('CONTRACT:public-sign-bad-token', 'POST', '/api/crm/contracts/public/notatoken/sign', { body: '{}', public: true });
await probe('CONTRACT:send-zero', 'POST', `/api/crm/contracts/${ZERO}/send`, { body: '{}' });
await probe('CONTRACT:send-bad-uuid', 'POST', '/api/crm/contracts/notauuid/send', { body: '{}' });
await probe('CONTRACT:void-zero', 'POST', `/api/crm/contracts/${ZERO}/void`, { body: '{}' });
await probe('CONTRACT:pdf-zero', 'GET', `/api/crm/contracts/${ZERO}/pdf`);

// ===== crm leads =====
await probe('LEAD:score-zero', 'POST', `/api/crm/leads/${ZERO}/score`, { body: '{}' });
await probe('LEAD:score-bad-uuid', 'POST', '/api/crm/leads/notauuid/score', { body: '{}' });
// NOTE: leads/score-all is heavy-work — skip per carry-over #6

// ===== data apis =====
await probe('DATA:opt-route-empty', 'POST', '/api/data/optimize-route', { body: '{}' });
await probe('DATA:opt-route-bad-json', 'POST', '/api/data/optimize-route', { body: '{ bad' });
await probe('DATA:opt-route-no-stops', 'POST', '/api/data/optimize-route', { body: JSON.stringify({ origin: { lat: 40, lng: -95 } }) });
await probe('DATA:opt-route-junk-stops', 'POST', '/api/data/optimize-route', { body: JSON.stringify({ origin: { lat: 40, lng: -95 }, stops: 'notanarray' }) });

// ===== documents upload =====
await probe('DOC:upload-empty', 'POST', '/api/documents/upload', { body: '{}' });
await probe('DOC:upload-bad-ct', 'POST', '/api/documents/upload');

// ===== drift =====
await probe('DRIFT:correct-zero', 'POST', `/api/drift/${ZERO}/correct`, { body: '{}' });
await probe('DRIFT:correct-bad-uuid', 'POST', '/api/drift/notauuid/correct', { body: '{}' });
await probe('DRIFT:simulate-empty', 'POST', '/api/drift/simulate', { body: '{}' });
await probe('DRIFT:calibrate-empty', 'POST', '/api/drift/calibrate', { body: '{}' });
// NOTE: drift/correct-all skipped per carry-over #6 (heavy work)

// ===== drip =====
await probe('DRIP:cancel-zero', 'POST', `/api/crm/drip-sequences/${ZERO}/cancel`, { body: '{}' });
await probe('DRIP:cancel-bad-uuid', 'POST', '/api/crm/drip-sequences/notauuid/cancel', { body: '{}' });

// ===== estimates =====
await probe('EST:public-accept-bad-token', 'POST', '/api/estimates/public/notatoken/accept', { body: '{}', public: true });
await probe('EST:public-decline-bad-token', 'POST', '/api/estimates/public/notatoken/decline', { body: '{}', public: true });
await probe('EST:public-accept-empty', 'POST', '/api/estimates/public/notatoken/accept', { body: '', public: true });
await probe('EST:send-zero', 'POST', `/api/estimates/${ZERO}/send`, { body: '{}' });
await probe('EST:send-bad-uuid', 'POST', '/api/estimates/notauuid/send', { body: '{}' });
await probe('EST:duplicate-zero', 'POST', `/api/estimates/${ZERO}/duplicate`, { body: '{}' });
await probe('EST:pdf-zero', 'GET', `/api/estimates/${ZERO}/pdf`);
await probe('EST:pdf-bad-uuid', 'GET', '/api/estimates/notauuid/pdf');
await probe('EST:sign-in-person-zero', 'POST', `/api/estimates/${ZERO}/sign-in-person`, { body: '{}' });
await probe('EST:generate-tiers-zero', 'POST', `/api/estimates/${ZERO}/generate-tiers`, { body: '{}' });

// ===== invoices =====
await probe('INV:from-estimate-zero', 'POST', `/api/crm/invoices/from-estimate/${ZERO}`, { body: '{}' });
await probe('INV:from-estimate-bad-uuid', 'POST', '/api/crm/invoices/from-estimate/notauuid', { body: '{}' });
await probe('INV:send-zero', 'POST', `/api/crm/invoices/${ZERO}/send`, { body: '{}' });
await probe('INV:send-email-zero', 'POST', `/api/crm/invoices/${ZERO}/send-email`, { body: '{}' });

// ===== leads =====
await probe('LEAD:status-token-zero', 'POST', `/api/leads/${ZERO}/status-token`, { body: '{}' });
await probe('LEAD:from-storm-empty', 'POST', '/api/leads/from-storm', { body: '{}' });
await probe('LEAD:from-storm-bad-json', 'POST', '/api/leads/from-storm', { body: '{ bad' });

// ===== materials =====
await probe('MAT:auto-order-zero', 'POST', `/api/materials/estimate/${ZERO}/auto-order`, { body: '{}' });
await probe('MAT:auto-order-bad-uuid', 'POST', '/api/materials/estimate/notauuid/auto-order', { body: '{}' });

// ===== onboarding =====
await probe('ONB:create-tenant-empty', 'POST', '/api/onboarding/create-tenant', { body: '{}' });
await probe('ONB:create-tenant-bad-json', 'POST', '/api/onboarding/create-tenant', { body: '{ bad' });
await probe('ONB:org-empty', 'PUT', '/api/onboarding/org', { body: '{}' });
await probe('ONB:select-plan-empty', 'POST', '/api/onboarding/select-plan', { body: '{}' });
await probe('ONB:setup-payment-empty', 'POST', '/api/onboarding/setup-payment', { body: '{}' });
await probe('ONB:enable-addons-empty', 'POST', '/api/onboarding/enable-addons', { body: '{}' });

// ===== payments =====
await probe('PAY:connect-refresh-empty', 'POST', '/api/payments/connect/refresh', { body: '{}' });
await probe('PAY:create-intent-empty', 'POST', '/api/payments/create-intent', { body: '{}' });
await probe('PAY:create-intent-bad-amount', 'POST', '/api/payments/create-intent', { body: JSON.stringify({ amount: 'notanumber', invoiceId: ZERO }) });
await probe('PAY:public-create-intent-empty', 'POST', '/api/payments/public/create-intent', { body: '{}', public: true });

// ===== properties (SAFE non-FEMA endpoints only) =====
// NOTE: skipping fema-live, fema-live-polygon, fema-lookup per task constraints
// NOTE: skipping trigger-import, generate-leads, import-csv per heavy-work guard
await probe('PROP:reverse-geo-empty', 'GET', '/api/properties/reverse-geocode');
await probe('PROP:reverse-geo-bad-coords', 'GET', '/api/properties/reverse-geocode?lat=abc&lng=def');
await probe('PROP:reverse-geo-no-lng', 'GET', '/api/properties/reverse-geocode?lat=40');
await probe('PROP:weather-history-zero', 'GET', `/api/properties/${ZERO}/weather-history`);
await probe('PROP:weather-history-bad-uuid', 'GET', '/api/properties/notauuid/weather-history');
await probe('PROP:weather-history-pdf-zero', 'GET', `/api/properties/${ZERO}/weather-history/pdf`);
await probe('PROP:report-pdf-zero', 'GET', `/api/properties/${ZERO}/report/pdf`);
await probe('PROP:report-pdf-bad-uuid', 'GET', '/api/properties/notauuid/report/pdf');

// ===== skip-trace =====
await probe('ST:setup-payment-empty', 'POST', '/api/skip-trace/setup-payment', { body: '{}' });

// ===== tracerfy webhook =====
await probe('TRC:webhook-empty', 'POST', '/api/webhooks/tracerfy', { body: '{}', public: true });
await probe('TRC:webhook-bad-json', 'POST', '/api/webhooks/tracerfy', { body: '{ bad', public: true });
await probe('TRC:webhook-empty-body', 'POST', '/api/webhooks/tracerfy', { public: true });

// ===== work orders =====
await probe('WO:from-estimate-zero', 'POST', `/api/crm/work-orders/from-estimate/${ZERO}`, { body: '{}' });
await probe('WO:from-estimate-bad-uuid', 'POST', '/api/crm/work-orders/from-estimate/notauuid', { body: '{}' });
await probe('WO:pdf-zero', 'GET', `/api/crm/work-orders/${ZERO}/pdf`);

// ===== summary =====
console.log('=== SUMMARY ===');
console.log('Total probes:', results.length);
const fiveXX = results.filter(r => typeof r.status === 'number' && r.status >= 500);
const errs = results.filter(r => r.status === 'ERR');
console.log('5xx:', fiveXX.length);
console.log('ERR:', errs.length);
console.log();
for (const r of results) {
  const tag = (typeof r.status === 'number' && r.status >= 500) ? '!!' : (r.status === 'ERR' ? 'ER' : '  ');
  console.log(`${tag} ${String(r.status).padEnd(5)} ${r.label.padEnd(35)} ${r.body.slice(0, 100)}`);
}
console.log();
console.log('=== 5xx ===');
for (const r of fiveXX) console.log(`  ${r.status} ${r.method} ${r.path}\n    ${r.body}`);
console.log('=== ERR ===');
for (const r of errs) console.log(`  ${r.method} ${r.path}\n    ${r.body}`);

writeFileSync('.qa-gaps-results.json', JSON.stringify(results, null, 2));
