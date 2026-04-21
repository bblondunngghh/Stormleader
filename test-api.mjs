// Systematic API endpoint tester
import fs from 'fs';

const BASE = 'http://localhost:3001';
const loginRes = await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'brandon@accessvaletparking.com', password: '1234', tenantSlug: 'waterloo' }),
});
const TOKEN = (await loginRes.json()).accessToken;
if (!TOKEN) throw new Error('No token');
const H = { Authorization: `Bearer ${TOKEN}` };

async function hit(method, path, body) {
  const opts = { method, headers: { ...H } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(BASE + path, opts);
    const text = await res.text();
    let snippet = text.slice(0, 220).replace(/\n/g, ' ');
    return { status: res.status, snippet };
  } catch (e) {
    return { status: 'ERR', snippet: e.message };
  }
}

// GET endpoints that should work with valid data or empty lists
const GETS = [
  // auth
  ['/api/auth/me'],
  // dashboard
  ['/api/dashboard/stats'],
  ['/api/dashboard/funnel'],
  ['/api/dashboard/activity'],
  // storms
  ['/api/storms'],
  // counties
  ['/api/counties'],
  // alerts
  ['/api/alerts/config'],
  ['/api/alerts/history'],
  // crm - leads
  ['/api/crm/leads'],
  ['/api/crm/leads?limit=5'],
  // crm - pipeline
  ['/api/crm/pipeline/stages'],
  ['/api/crm/pipeline/metrics'],
  // crm - dashboard
  ['/api/crm/dashboard/stats'],
  ['/api/crm/dashboard/activity'],
  ['/api/crm/dashboard/properties-affected'],
  ['/api/crm/dashboard/properties-affected/list'],
  ['/api/crm/dashboard/followups'],
  ['/api/crm/dashboard/conversion-by-storm'],
  ['/api/crm/dashboard/estimate-summary'],
  ['/api/crm/dashboard/ar-summary'],
  ['/api/crm/dashboard/estimating-conversion'],
  ['/api/crm/dashboard/leaderboard'],
  ['/api/crm/dashboard/tasks-today'],
  ['/api/crm/dashboard/days-in-stage'],
  ['/api/crm/dashboard/stale-leads'],
  ['/api/crm/dashboard/customer-storm-alerts'],
  ['/api/crm/dashboard/lead-source-revenue'],
  // crm - team
  ['/api/crm/team'],
  // crm - tenant-settings
  ['/api/crm/tenant-settings'],
  // crm - tasks, prospect lists, calendar, custom-fields
  ['/api/crm/tasks'],
  ['/api/crm/prospect-lists'],
  ['/api/crm/calendar'],
  ['/api/crm/custom-fields'],
  // crm - automations
  ['/api/crm/automations'],
  // crm - invoices
  ['/api/crm/invoices'],
  // crm - canvass-pins
  ['/api/crm/canvass-pins'],
  ['/api/crm/canvass-pins/stats'],
  // crm - reports
  ['/api/crm/reports/revenue'],
  ['/api/crm/reports/pipeline'],
  ['/api/crm/reports/conversion'],
  ['/api/crm/reports/rep-performance'],
  ['/api/crm/reports/stage-duration'],
  ['/api/crm/reports/lead-sources'],
  // crm - work-orders
  ['/api/crm/work-orders'],
  ['/api/crm/work-orders/milestone-templates'],
  // crm - drip-sequences
  ['/api/crm/drip-sequences'],
  // crm - expenses
  ['/api/crm/expenses'],
  // crm - subcontractors
  ['/api/crm/subcontractors'],
  // crm - territories
  ['/api/crm/territories'],
  // crm - contracts
  ['/api/crm/contracts'],
  ['/api/crm/contracts/templates'],
  // crm - financing
  ['/api/crm/financing/lenders'],
  ['/api/crm/financing/plans'],
  ['/api/crm/financing/applications'],
  // estimates
  ['/api/estimates'],
  ['/api/estimates/templates'],
  // notifications
  ['/api/notifications'],
  ['/api/notifications/unread-count'],
  ['/api/notifications/preferences'],
  // search
  ['/api/search?q=test'],
  // documents
  ['/api/documents?leadId=fake'],
  // roof-measurement
  ['/api/roof-measurement/config'],
  ['/api/roof-measurement/usage'],
  ['/api/roof-measurement/balance'],
  // onboarding
  ['/api/onboarding/plans'],
  // admin
  ['/api/admin/overview'],
  ['/api/admin/tenants'],
  ['/api/admin/revenue'],
  ['/api/admin/usage'],
  // payments
  ['/api/payments/connect/status'],
  ['/api/payments/history'],
  // materials
  ['/api/materials/products'],
  ['/api/materials/branches'],
  ['/api/materials/orders'],
  ['/api/materials/credentials'],
  // properties
  ['/api/properties'],
  ['/api/properties/import-progress'],
  // map
  ['/api/map/properties?bbox=-98,30,-97,31'],
  ['/api/map/swaths'],
  // skip-trace
  ['/api/skip-trace/config'],
  ['/api/skip-trace/balance'],
  ['/api/skip-trace/invoices'],
  ['/api/skip-trace/usage'],
  ['/api/skip-trace/jobs'],
  // disaster declarations
  ['/api/disaster-declarations'],
  // storm history
  ['/api/storm-history'],
  ['/api/storm-history/heatmap'],
  // data apis
  ['/api/data/fema-housing?lat=30.27&lon=-97.74'],
  ['/api/data/directions?origin=30.27,-97.74&destination=30.28,-97.75'],
];

const results = [];
for (const [path] of GETS) {
  const r = await hit('GET', path);
  const ok = r.status === 200 || r.status === 404 || r.status === 400;
  results.push({ method: 'GET', path, status: r.status, ok, snippet: r.snippet });
  const marker = r.status === 500 || r.status === 'ERR' ? '!!' : r.status === 200 ? 'OK' : '--';
  console.log(`${marker} ${r.status} GET ${path}${r.status >= 400 ? ' | ' + r.snippet.slice(0, 150) : ''}`);
}

fs.writeFileSync('/tmp/api-get-results.json', JSON.stringify(results, null, 2));
console.log('\nTotal:', results.length);
console.log('500s:', results.filter(r => r.status === 500).length);
console.log('ERR:', results.filter(r => r.status === 'ERR').length);
