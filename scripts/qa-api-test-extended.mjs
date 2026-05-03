// Extended QA tests — focus on POST/PATCH/DELETE paths, public-token routes,
// and payloads designed to crash naive validation. Goal is to find any 500s.
import fs from 'fs';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/Users/brand/AppData/Local/Temp/token.txt', 'utf8').trim();

const IDS = {
  lead: 'e25ad9f6-f3dc-4ca7-a5da-63b6c3ee6d14',
  storm: '025f97dc-e308-40fd-a136-8fff074aa680',
  workOrder: '2b75d7fd-dcba-4313-aba1-d373e4fddcad',
  estimate: 'd788790e-a680-4d47-80af-4e8ca077740b',
  invoice: '63453e95-a2e8-4851-abf7-e5059eff61cc',
  contract: '74049fb1-aaea-4548-818b-2d86b71a9569',
  subcontractor: '339cd4b4-a4cc-4133-8ec9-675073022a4c',
  territory: 'dca7cea0-622b-4c40-a1e0-4a9e18d9abe2',
  canvassPin: 'e91c7d1c-2844-4060-bac1-dc1582813e8c',
  user: '93fb33ea-e7d8-461f-87e4-bba4e55acc9e',
};

const results = [];

async function hit(method, path, opts = {}) {
  const { body, skipAuth, raw } = opts;
  const headers = { 'Content-Type': 'application/json' };
  if (!skipAuth) headers.Authorization = `Bearer ${TOKEN}`;
  let status = 0;
  let snippet = '';
  let issue = '';
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    const text = await res.text();
    snippet = text.slice(0, 240).replace(/\s+/g, ' ');
    if (raw) snippet = `<${text.length} bytes>`;
    if (status >= 500) issue = `5xx: ${snippet}`;
  } catch (e) {
    status = -1;
    issue = `fetch threw: ${e.message}`;
  }
  results.push({ method, path, status, issue, snippet });
}

// --- AUTH refresh edge cases ---
await hit('POST', '/api/auth/refresh', { skipAuth: true, body: { refreshToken: 'garbage' } });
await hit('POST', '/api/auth/refresh', { skipAuth: true, body: { refreshToken: '' } });
await hit('POST', '/api/auth/refresh', { skipAuth: true, body: { refreshToken: null } });

// --- ONBOARDING validation ---
await hit('POST', '/api/onboarding/create-tenant', { body: {} });
await hit('POST', '/api/onboarding/create-tenant', { body: { name: 'x', slug: 'x' } });
await hit('PUT', '/api/onboarding/org', { body: {} });
await hit('POST', '/api/onboarding/select-plan', { body: {} });
await hit('POST', '/api/onboarding/setup-payment', { body: {} });
await hit('POST', '/api/onboarding/enable-addons', { body: {} });
await hit('POST', '/api/onboarding/complete', { body: {} });

// --- PROPERTIES write ops ---
await hit('POST', '/api/properties/generate-leads', { body: {} });
await hit('POST', '/api/properties/geocode', { body: {} });
await hit('POST', '/api/properties/geocode', { body: { address: 123 } });
await hit('POST', '/api/properties/import-csv', { body: {} });
await hit('POST', '/api/properties', { body: {} });
await hit('POST', `/api/properties/${IDS.lead}/fema-lookup`, { body: {} });
await hit('GET', `/api/properties/${IDS.lead}/weather-history`, {});
await hit('PUT', `/api/properties/${IDS.lead}/location`, { body: {} });
await hit('PUT', `/api/properties/${IDS.lead}/location`, { body: { lat: 'foo', lng: 'bar' } });

// --- DRIFT POSTs with real storm ID ---
await hit('POST', `/api/drift/${IDS.storm}/correct`, { body: {} });
await hit('POST', '/api/drift/correct-all', { body: {} });
await hit('POST', '/api/drift/simulate', { body: { hailSizeIn: 1.5 } });
await hit('POST', '/api/drift/calibrate', { body: { stormEventId: IDS.storm } });

// --- ESTIMATES write & template ---
await hit('POST', '/api/estimates/templates', { body: {} });
await hit('PATCH', `/api/estimates/${IDS.estimate}`, { body: {} });
await hit('POST', `/api/estimates/${IDS.estimate}/send`, { body: {} });
await hit('POST', `/api/estimates/${IDS.estimate}/duplicate`, { body: {} });
await hit('POST', `/api/estimates/${IDS.estimate}/sign-in-person`, { body: {} });
await hit('POST', `/api/estimates/${IDS.estimate}/generate-tiers`, { body: {} });
await hit('POST', '/api/estimates/public/garbage-token/accept', { skipAuth: true, body: {} });
await hit('GET', '/api/estimates/public/garbage-token', { skipAuth: true });

// --- INVOICES ---
await hit('PATCH', `/api/crm/invoices/${IDS.invoice}`, { body: {} });
await hit('POST', `/api/crm/invoices/${IDS.invoice}/payment`, { body: {} });
await hit('POST', `/api/crm/invoices/${IDS.invoice}/payment`, { body: { amount: 'not-a-number' } });
await hit('POST', `/api/crm/invoices/${IDS.invoice}/send`, { body: {} });
await hit('POST', `/api/crm/invoices/${IDS.invoice}/send-email`, { body: {} });

// --- CONTRACTS ---
await hit('PATCH', `/api/crm/contracts/${IDS.contract}`, { body: {} });
await hit('POST', `/api/crm/contracts/${IDS.contract}/send`, { body: {} });
await hit('POST', `/api/crm/contracts/${IDS.contract}/void`, { body: {} });
await hit('POST', '/api/crm/contracts/templates', { body: {} });
await hit('GET', '/api/crm/contracts/public/garbage-token', { skipAuth: true });
await hit('POST', '/api/crm/contracts/public/garbage-token/sign', { skipAuth: true, body: {} });

// --- FINANCING public + payments ---
await hit('GET', '/api/crm/financing/public/garbage-token/plans', { skipAuth: true });
await hit('GET', '/api/crm/financing/public/garbage-token/applications', { skipAuth: true });
await hit('POST', '/api/crm/financing/public/garbage-token/apply', { skipAuth: true, body: {} });
await hit('POST', '/api/crm/financing/plans/sync', { body: {} });

// --- LEADS public + write ---
await hit('GET', '/api/leads/status/public/garbage-token', { skipAuth: true });
await hit('PATCH', `/api/leads/${IDS.lead}`, { body: {} });
await hit('POST', `/api/leads/${IDS.lead}/status-token`, { body: {} });
await hit('POST', '/api/leads/from-storm', { body: {} });

// --- CRM lead writes ---
await hit('POST', '/api/crm/leads', { body: {} });
await hit('POST', '/api/crm/leads/quick', { body: {} });
await hit('PATCH', `/api/crm/leads/${IDS.lead}/roof-type`, { body: {} });
await hit('POST', '/api/crm/leads/score-all', { body: {} });
await hit('POST', `/api/crm/leads/${IDS.lead}/score`, { body: {} });
await hit('POST', `/api/crm/leads/${IDS.lead}/contacts`, { body: {} });
await hit('POST', '/api/crm/test-email', { body: {} });
await hit('POST', '/api/crm/team/invite', { body: {} });
await hit('PATCH', `/api/crm/team/${IDS.user}/role`, { body: {} });
await hit('PUT', '/api/crm/tenant-settings', { body: {} });
await hit('POST', '/api/crm/custom-fields', { body: {} });
await hit('PATCH', '/api/crm/custom-fields/00000000-0000-0000-0000-000000000000', { body: {} });
await hit('POST', '/api/crm/prospect-lists', { body: {} });

// --- ALERTS ---
await hit('POST', '/api/alerts/test', { body: {} });
await hit('PUT', '/api/alerts/config', { body: { enabled: 'maybe' } });

// --- WORK ORDERS write ---
await hit('POST', `/api/crm/work-orders/from-estimate/${IDS.estimate}`, { body: {} });
await hit('PATCH', `/api/crm/work-orders/${IDS.workOrder}`, { body: {} });
await hit('PATCH', `/api/crm/work-orders/${IDS.workOrder}/complete`, { body: {} });
await hit('POST', `/api/crm/work-orders/${IDS.workOrder}/milestones`, { body: { title: 'QA Probe Milestone' } });

// --- TERRITORIES ---
await hit('PATCH', `/api/crm/territories/${IDS.territory}`, { body: {} });

// --- ROOF MEASUREMENT extra ---
await hit('PUT', '/api/roof-measurement/config', { body: {} });

// --- SKIP TRACE writes ---
await hit('PUT', '/api/skip-trace/config', { body: {} });
await hit('POST', '/api/skip-trace/setup-payment', { body: {} });
await hit('DELETE', '/api/skip-trace/payment-method', {});

// --- PAYMENTS ---
await hit('POST', '/api/payments/connect/onboard', { body: {} });
await hit('POST', '/api/payments/connect/refresh', { body: {} });
await hit('POST', '/api/payments/public/create-intent', { skipAuth: true, body: {} });

// --- NOTIFICATIONS ---
await hit('PATCH', '/api/notifications/preferences', { body: {} });

// --- AUTOMATIONS valid ---
await hit('POST', '/api/crm/automations', { body: { name: 'QA test automation' } });

// Persist
const out = [];
out.push('| Method | Path | Status | Issue | Snippet |');
out.push('|---|---|---|---|---|');
for (const r of results) {
  out.push(`| ${r.method} | ${r.path} | ${r.status} | ${r.issue || 'OK'} | ${r.snippet.slice(0, 120)} |`);
}
fs.writeFileSync('C:/Users/brand/AppData/Local/Temp/api-test-results-extended.txt', out.join('\n') + '\n');

const issues = results.filter(r => r.issue);
console.log(`Total: ${results.length}`);
console.log(`5xx/crashes: ${issues.length}`);
for (const r of issues) {
  console.log(`  [${r.status}] ${r.method} ${r.path}\n    ${r.snippet}`);
}

// Also list any unexpected 200s on missing-body PATCH/POST tests — those are
// candidates for missing input validation.
const fishy = results.filter(r => r.status === 200 && (r.method === 'POST' || r.method === 'PATCH' || r.method === 'PUT'));
console.log(`\nWrite calls with empty/garbage bodies that returned 200 (suspect validation gaps):`);
for (const r of fishy) {
  console.log(`  [200] ${r.method} ${r.path}`);
}
