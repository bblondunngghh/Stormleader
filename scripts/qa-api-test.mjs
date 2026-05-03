// QA API test harness — exercises every GET endpoint and a sampling of write
// endpoints with both valid and missing-required-field bodies. Writes a flat
// pipe-delimited results file. Designed for the overnight QA orchestration.
import fs from 'fs';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/Users/brand/AppData/Local/Temp/token.txt', 'utf8').trim();

const IDS = {
  lead: 'e25ad9f6-f3dc-4ca7-a5da-63b6c3ee6d14',
  storm: '025f97dc-e308-40fd-a136-8fff074aa680',
  workOrder: '2b75d7fd-dcba-4313-aba1-d373e4fddcad',
  estimate: 'd788790e-a680-4d47-80af-4e8ca077740b',
  invoice: '63453e95-a2e8-4851-abf7-e5059eff61cc',
  expense: 'bfe5df21-efcd-4e16-9a88-6b234a984c64',
  contract: '74049fb1-aaea-4548-818b-2d86b71a9569',
  subcontractor: '339cd4b4-a4cc-4133-8ec9-675073022a4c',
  territory: 'dca7cea0-622b-4c40-a1e0-4a9e18d9abe2',
  canvassPin: 'e91c7d1c-2844-4060-bac1-dc1582813e8c',
  user: '93fb33ea-e7d8-461f-87e4-bba4e55acc9e',
  tenant: '791bb51d-3293-4839-92e9-bd4d4f873af2',
};

const BAD_ID = 'not-a-uuid';

const results = [];

async function hit(method, path, opts = {}) {
  const { body, expect, note, skipAuth, raw } = opts;
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
    if (raw) snippet = `<${text.length} bytes binary>`;
    if (status >= 500) issue = `5xx error: ${snippet}`;
    if (expect && !expect.includes(status)) {
      issue = issue || `expected ${expect.join('|')} got ${status}: ${snippet}`;
    }
  } catch (e) {
    status = -1;
    issue = `fetch threw: ${e.message}`;
  }
  results.push({ method, path, status, note: note || '', issue, snippet });
}

// --- AUTH ---
await hit('POST', '/api/auth/login', { skipAuth: true, body: {}, expect: [400], note: 'empty body' });
await hit('POST', '/api/auth/login', { skipAuth: true, body: { email: 'nope', password: 'x', tenantSlug: 'waterloo' }, expect: [400, 401], note: 'bad creds' });
await hit('GET', '/api/auth/me', { expect: [200] });
await hit('PATCH', '/api/auth/me', { body: {}, expect: [200, 400] });
await hit('POST', '/api/auth/refresh', { skipAuth: true, body: {}, expect: [400, 401] });

// --- ADMIN ---
await hit('GET', '/api/admin/overview', { expect: [200, 403] });
await hit('GET', '/api/admin/tenants', { expect: [200, 403] });
await hit('GET', `/api/admin/tenants/${IDS.tenant}`, { expect: [200, 403, 404] });
await hit('GET', `/api/admin/tenants/${BAD_ID}`, { expect: [400, 403] });
await hit('GET', '/api/admin/revenue', { expect: [200, 403] });
await hit('GET', '/api/admin/usage', { expect: [200, 403] });

// --- ALERTS ---
await hit('GET', '/api/alerts/config', { expect: [200] });
await hit('PUT', '/api/alerts/config', { body: {}, expect: [200, 400] });
await hit('GET', '/api/alerts/history', { expect: [200] });

// --- AUTOMATIONS ---
await hit('GET', '/api/crm/automations', { expect: [200] });
await hit('POST', '/api/crm/automations', { body: {}, expect: [400] });
await hit('PATCH', `/api/crm/automations/${BAD_ID}`, { body: {}, expect: [400] });
await hit('DELETE', `/api/crm/automations/${BAD_ID}`, { expect: [400] });
await hit('PATCH', `/api/crm/automations/${BAD_ID}/toggle`, { expect: [400] });

// --- CANVASSING ---
await hit('GET', '/api/crm/canvass-pins', { expect: [200] });
await hit('GET', '/api/crm/canvass-pins/stats', { expect: [200] });
await hit('POST', '/api/crm/canvass-pins', { body: {}, expect: [400] });
await hit('PATCH', `/api/crm/canvass-pins/${BAD_ID}`, { body: {}, expect: [400] });
await hit('POST', `/api/crm/canvass-pins/${BAD_ID}/convert`, { body: {}, expect: [400] });
await hit('PATCH', `/api/crm/canvass-pins/${IDS.canvassPin}`, { body: { outcome: 'follow_up' }, expect: [200] });

// --- CONTRACTS ---
await hit('GET', '/api/crm/contracts', { expect: [200] });
await hit('GET', '/api/crm/contracts/templates', { expect: [200] });
await hit('GET', `/api/crm/contracts/${IDS.contract}`, { expect: [200] });
await hit('GET', `/api/crm/contracts/${BAD_ID}`, { expect: [400] });
await hit('POST', '/api/crm/contracts', { body: {}, expect: [400] });
await hit('GET', `/api/crm/contracts/${IDS.contract}/pdf`, { expect: [200, 400], raw: true });

// --- COUNTIES ---
await hit('GET', '/api/counties', { expect: [200] });

// --- CRM (huge surface) ---
await hit('GET', '/api/crm/leads', { expect: [200] });
await hit('GET', '/api/crm/leads?limit=5&page=1', { expect: [200] });
await hit('GET', `/api/crm/leads/${IDS.lead}`, { expect: [200] });
await hit('GET', `/api/crm/leads/${BAD_ID}`, { expect: [400] });
await hit('PATCH', `/api/crm/leads/${IDS.lead}`, { body: {}, expect: [200, 400] });
await hit('POST', '/api/crm/leads/bulk-assign', { body: {}, expect: [400] });
await hit('POST', '/api/crm/leads/bulk-status', { body: {}, expect: [400] });
await hit('POST', `/api/crm/leads/${BAD_ID}/score`, { body: {}, expect: [400] });
await hit('POST', `/api/crm/leads/${BAD_ID}/contacts`, { body: {}, expect: [400] });
await hit('POST', '/api/crm/activities', { body: {}, expect: [400] });
await hit('GET', `/api/crm/leads/${IDS.lead}/activities`, { expect: [200] });
await hit('GET', '/api/crm/tasks', { expect: [200] });
await hit('POST', '/api/crm/tasks', { body: {}, expect: [400] });
await hit('PATCH', `/api/crm/tasks/${BAD_ID}`, { body: {}, expect: [400] });
await hit('GET', '/api/crm/pipeline/stages', { expect: [200] });
await hit('GET', '/api/crm/pipeline/metrics', { expect: [200] });
await hit('GET', '/api/crm/dashboard/stats', { expect: [200] });
await hit('GET', '/api/crm/dashboard/activity', { expect: [200] });
await hit('GET', '/api/crm/dashboard/properties-affected', { expect: [200] });
await hit('GET', '/api/crm/dashboard/properties-affected/list', { expect: [200] });
await hit('GET', '/api/crm/dashboard/followups', { expect: [200] });
await hit('GET', '/api/crm/dashboard/conversion-by-storm', { expect: [200] });
await hit('GET', '/api/crm/dashboard/estimate-summary', { expect: [200] });
await hit('GET', '/api/crm/dashboard/ar-summary', { expect: [200] });
await hit('GET', '/api/crm/dashboard/estimating-conversion', { expect: [200] });
await hit('GET', '/api/crm/dashboard/leaderboard', { expect: [200] });
await hit('GET', '/api/crm/dashboard/tasks-today', { expect: [200] });
await hit('GET', '/api/crm/dashboard/days-in-stage', { expect: [200] });
await hit('GET', '/api/crm/dashboard/stale-leads', { expect: [200] });
await hit('GET', '/api/crm/dashboard/customer-storm-alerts', { expect: [200] });
await hit('GET', '/api/crm/dashboard/lead-source-revenue', { expect: [200] });
await hit('GET', '/api/crm/team', { expect: [200] });
await hit('GET', '/api/crm/tenant-settings', { expect: [200] });
await hit('GET', '/api/crm/calendar?start=2026-04-01&end=2026-06-30', { expect: [200] });
await hit('GET', '/api/crm/calendar', { expect: [400], note: 'no start/end' });
await hit('GET', '/api/crm/custom-fields', { expect: [200] });
await hit('GET', '/api/crm/prospect-lists', { expect: [200] });

// --- DASHBOARD ---
await hit('GET', '/api/dashboard/stats', { expect: [200] });
await hit('GET', '/api/dashboard/funnel', { expect: [200] });
await hit('GET', '/api/dashboard/activity', { expect: [200] });

// --- DATA APIS ---
await hit('GET', '/api/data/fema-housing', { expect: [200, 400] });
await hit('GET', '/api/data/fema-housing?county=12345', { expect: [200, 400] });
await hit('POST', '/api/data/optimize-route', { body: {}, expect: [400] });
await hit('GET', '/api/data/directions', { expect: [400] });

// --- DISASTER DECLARATIONS ---
await hit('GET', '/api/disaster-declarations?state=TX&county=Harris', { expect: [200] });
await hit('GET', '/api/disaster-declarations', { expect: [400], note: 'no state/county' });

// --- DOCUMENTS ---
await hit('GET', '/api/documents', { expect: [200] });

// --- DRIFT (require valid storm) ---
await hit('GET', `/api/drift/${IDS.storm}`, { expect: [200, 404] });
await hit('GET', `/api/drift/${BAD_ID}`, { expect: [400] });
await hit('POST', '/api/drift/simulate', { body: {}, expect: [400] });
await hit('POST', '/api/drift/calibrate', { body: {}, expect: [400] });

// --- DRIP ---
await hit('GET', '/api/crm/drip-sequences', { expect: [200] });
await hit('POST', '/api/crm/drip-sequences', { body: {}, expect: [400] });
await hit('GET', `/api/crm/drip-sequences/${BAD_ID}`, { expect: [400] });

// --- ESTIMATES ---
await hit('GET', '/api/estimates', { expect: [200] });
await hit('GET', '/api/estimates/templates', { expect: [200] });
await hit('GET', `/api/estimates/${IDS.estimate}`, { expect: [200] });
await hit('GET', `/api/estimates/${BAD_ID}`, { expect: [400] });
await hit('POST', '/api/estimates', { body: {}, expect: [400] });

// --- EXPENSES ---
await hit('GET', '/api/crm/expenses', { expect: [200] });
await hit('GET', `/api/crm/expenses/summary/${IDS.lead}`, { expect: [200] });
await hit('GET', `/api/crm/expenses/summary/${BAD_ID}`, { expect: [400] });
await hit('POST', '/api/crm/expenses', { body: {}, expect: [400] });

// --- FINANCING ---
await hit('GET', '/api/crm/financing/lenders', { expect: [200] });
await hit('POST', '/api/crm/financing/lenders', { body: {}, expect: [400] });
await hit('GET', '/api/crm/financing/plans', { expect: [200] });
await hit('GET', '/api/crm/financing/applications', { expect: [200] });
await hit('GET', `/api/crm/financing/applications/${BAD_ID}`, { expect: [400] });
await hit('POST', '/api/crm/financing/applications', { body: {}, expect: [400] });

// --- INVOICES ---
await hit('GET', '/api/crm/invoices', { expect: [200] });
await hit('GET', `/api/crm/invoices/${IDS.invoice}`, { expect: [200] });
await hit('GET', `/api/crm/invoices/${BAD_ID}`, { expect: [400] });
await hit('POST', '/api/crm/invoices', { body: {}, expect: [400] });
await hit('POST', `/api/crm/invoices/from-estimate/${BAD_ID}`, { body: {}, expect: [400] });

// --- LEADS (top-level) ---
await hit('GET', '/api/leads', { expect: [200] });
await hit('GET', `/api/leads/${IDS.lead}`, { expect: [200] });
await hit('GET', `/api/leads/${BAD_ID}`, { expect: [400] });

// --- MAP ---
await hit('GET', '/api/map/properties?bbox=-97,30,-96,31', { expect: [200, 400] });
await hit('GET', '/api/map/affected-properties?storm=' + IDS.storm, { expect: [200, 400] });
await hit('GET', '/api/map/swaths?bbox=-97,30,-96,31', { expect: [200, 400] });

// --- MATERIALS ---
await hit('GET', '/api/materials/products', { expect: [200, 401, 503] });
await hit('GET', '/api/materials/branches', { expect: [200, 401, 503] });
await hit('GET', '/api/materials/orders', { expect: [200] });
await hit('GET', '/api/materials/credentials', { expect: [200] });

// --- NOTIFICATIONS ---
await hit('GET', '/api/notifications', { expect: [200] });
await hit('GET', '/api/notifications/unread-count', { expect: [200] });
await hit('GET', '/api/notifications/preferences', { expect: [200] });
await hit('POST', '/api/notifications/mark-all-read', { expect: [200] });
await hit('PATCH', `/api/notifications/${BAD_ID}/read`, { expect: [400] });

// --- ONBOARDING ---
await hit('GET', '/api/onboarding/plans', { expect: [200] });

// --- PAYMENTS ---
await hit('GET', '/api/payments/connect/status', { expect: [200, 503] });
await hit('GET', '/api/payments/history', { expect: [200] });
await hit('POST', '/api/payments/create-intent', { body: {}, expect: [400] });

// --- PROPERTIES ---
await hit('GET', '/api/properties?bbox=-97,30,-96,31', { expect: [200] });
await hit('GET', '/api/properties', { expect: [400], note: 'no bbox' });
await hit('GET', `/api/properties/${BAD_ID}`, { expect: [400] });
await hit('GET', `/api/properties/in-swath/${IDS.storm}/count`, { expect: [200] });
await hit('GET', `/api/properties/in-swath/${IDS.storm}`, { expect: [200] });
await hit('GET', `/api/properties/in-swath/${BAD_ID}/count`, { expect: [400] });
await hit('GET', '/api/properties/import-progress', { expect: [200] });
await hit('GET', '/api/properties/reverse-geocode?lat=30&lng=-97', { expect: [200, 400] });

// --- REPORTS ---
await hit('GET', '/api/crm/reports/revenue', { expect: [200] });
await hit('GET', '/api/crm/reports/pipeline', { expect: [200] });
await hit('GET', '/api/crm/reports/conversion', { expect: [200] });
await hit('GET', '/api/crm/reports/rep-performance', { expect: [200] });
await hit('GET', '/api/crm/reports/stage-duration', { expect: [200] });
await hit('GET', '/api/crm/reports/lead-sources', { expect: [200] });

// --- ROOF MEASUREMENT ---
await hit('GET', '/api/roof-measurement/config', { expect: [200] });
await hit('GET', '/api/roof-measurement/usage', { expect: [200] });
await hit('GET', '/api/roof-measurement/balance', { expect: [200] });
await hit('GET', `/api/roof-measurement/segments/${BAD_ID}`, { expect: [400] });
await hit('GET', `/api/roof-measurement/solar/${BAD_ID}`, { expect: [400] });
await hit('POST', '/api/roof-measurement/measure', { body: {}, expect: [400] });
await hit('POST', '/api/roof-measurement/manual', { body: {}, expect: [400] });

// --- SEARCH ---
await hit('GET', '/api/search?q=test', { expect: [200] });
await hit('GET', '/api/search', { expect: [200, 400] });

// --- SKIP TRACE ---
await hit('GET', '/api/skip-trace/config', { expect: [200] });
await hit('GET', '/api/skip-trace/balance', { expect: [200] });
await hit('GET', '/api/skip-trace/invoices', { expect: [200] });
await hit('GET', '/api/skip-trace/usage', { expect: [200] });
await hit('GET', '/api/skip-trace/jobs', { expect: [200] });
await hit('GET', `/api/skip-trace/job/${BAD_ID}`, { expect: [400] });
await hit('POST', '/api/skip-trace/submit', { body: {}, expect: [400] });

// --- STORM HISTORY ---
await hit('GET', '/api/storm-history', { expect: [200, 400] });
await hit('GET', '/api/storm-history/heatmap', { expect: [200, 400] });

// --- STORMS ---
await hit('GET', '/api/storms', { expect: [200] });
await hit('GET', `/api/storms/${IDS.storm}`, { expect: [200] });
await hit('GET', `/api/storms/${BAD_ID}`, { expect: [400, 404] });

// --- SUBCONTRACTORS ---
await hit('GET', '/api/crm/subcontractors', { expect: [200] });
await hit('GET', `/api/crm/subcontractors/${IDS.subcontractor}`, { expect: [200] });
await hit('GET', `/api/crm/subcontractors/${BAD_ID}`, { expect: [400] });
await hit('POST', '/api/crm/subcontractors', { body: {}, expect: [400] });
await hit('POST', '/api/crm/subcontractors/assign', { body: {}, expect: [400] });
await hit('GET', `/api/crm/subcontractors/work-order/${IDS.workOrder}`, { expect: [200] });

// --- TERRITORIES ---
await hit('GET', '/api/crm/territories', { expect: [200] });
await hit('GET', `/api/crm/territories/${IDS.territory}`, { expect: [200] });
await hit('GET', `/api/crm/territories/${BAD_ID}`, { expect: [400] });
await hit('POST', '/api/crm/territories', { body: {}, expect: [400] });
await hit('GET', `/api/crm/territories/${IDS.territory}/pins`, { expect: [200] });

// --- WORK ORDERS ---
await hit('GET', '/api/crm/work-orders', { expect: [200] });
await hit('GET', '/api/crm/work-orders/milestone-templates', { expect: [200] });
await hit('GET', `/api/crm/work-orders/${IDS.workOrder}`, { expect: [200] });
await hit('GET', `/api/crm/work-orders/${BAD_ID}`, { expect: [400] });
await hit('POST', '/api/crm/work-orders', { body: {}, expect: [400] });
await hit('GET', `/api/crm/work-orders/${IDS.workOrder}/milestones`, { expect: [200] });
await hit('POST', `/api/crm/work-orders/${IDS.workOrder}/milestones`, { body: {}, expect: [400] });

// Persist results
const out = [];
out.push('| Method | Path | Status | Issue | Snippet |');
out.push('|---|---|---|---|---|');
for (const r of results) {
  out.push(`| ${r.method} | ${r.path} | ${r.status} | ${r.issue || 'OK'} | ${r.snippet.slice(0, 100)} |`);
}
const path = 'C:/Users/brand/AppData/Local/Temp/api-test-results.txt';
fs.writeFileSync(path, out.join('\n') + '\n');

const issues = results.filter(r => r.issue);
console.log(`Total: ${results.length}`);
console.log(`Issues: ${issues.length}`);
for (const r of issues) {
  console.log(`  [${r.status}] ${r.method} ${r.path} -- ${r.issue}`);
}
