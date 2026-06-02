// Overnight QA probe — hits every GET endpoint with the auth token and
// records any non-2xx/3xx/4xx (anything 5xx, or unexpected) so we can dig.

import { writeFileSync } from 'node:fs';

const API = 'http://localhost:3001';
const SAMPLE_LEAD = '3fa29df8-589c-44a6-ac4d-88cb78243cbe';
const SAMPLE_UUID = '00000000-0000-0000-0000-000000000000';
const SAMPLE_TOKEN = 'invalidtoken123';

async function login() {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'waterlooconstruction1@gmail.com',
      password: '2Wealth&health',
      tenantSlug: 'waterloo',
    }),
  });
  if (!r.ok) throw new Error(`login failed: ${r.status}`);
  const d = await r.json();
  return d.accessToken;
}

// All GET endpoints worth poking. Each entry is [mountPath, routeLine].
// We expand :id-style placeholders using a sample lead UUID and the zero-UUID.
const ENDPOINTS = [
  // admin
  ['/api/admin', '/overview'],
  ['/api/admin', '/tenants'],
  ['/api/admin', `/tenants/${SAMPLE_UUID}`],
  ['/api/admin', '/revenue'],
  ['/api/admin', '/usage'],

  // alerts
  ['/api/alerts', '/config'],
  ['/api/alerts', '/history'],

  // auth
  ['/api/auth', '/me'],

  // automations
  ['/api/crm/automations', '/'],

  // canvassing
  ['/api/crm/canvass-pins', '/'],
  ['/api/crm/canvass-pins', '/stats'],

  // contracts
  ['/api/crm/contracts', '/templates'],
  ['/api/crm/contracts', '/'],
  ['/api/crm/contracts', `/${SAMPLE_UUID}`],

  // counties
  ['/api/counties', '/'],
  ['/api/counties', `/${SAMPLE_UUID}/status`],

  // crm leads
  ['/api/crm', '/leads'],
  ['/api/crm', `/leads/${SAMPLE_LEAD}`],
  ['/api/crm', `/leads/${SAMPLE_LEAD}/activities`],

  // crm tasks/pipeline/dashboard
  ['/api/crm', '/tasks'],
  ['/api/crm', '/pipeline/stages'],
  ['/api/crm', '/pipeline/metrics'],
  ['/api/crm', '/dashboard/stats'],
  ['/api/crm', '/dashboard/activity'],
  ['/api/crm', '/dashboard/properties-affected'],
  ['/api/crm', '/dashboard/properties-affected/list'],
  ['/api/crm', '/dashboard/followups'],
  ['/api/crm', '/dashboard/conversion-by-storm'],
  ['/api/crm', '/dashboard/estimate-summary'],
  ['/api/crm', '/dashboard/ar-summary'],
  ['/api/crm', '/dashboard/estimating-conversion'],
  ['/api/crm', '/dashboard/leaderboard'],
  ['/api/crm', '/dashboard/tasks-today'],
  ['/api/crm', '/dashboard/days-in-stage'],
  ['/api/crm', '/dashboard/stale-leads'],
  ['/api/crm', '/dashboard/customer-storm-alerts'],
  ['/api/crm', '/dashboard/lead-source-revenue'],

  // crm team/settings
  ['/api/crm', '/team'],
  ['/api/crm', '/tenant-settings'],

  // crm prospect lists / calendar / custom fields
  ['/api/crm', '/prospect-lists'],
  ['/api/crm', '/calendar'],
  ['/api/crm', '/custom-fields'],

  // dashboard (legacy)
  ['/api/dashboard', '/stats'],
  ['/api/dashboard', '/funnel'],
  ['/api/dashboard', '/activity'],

  // disaster-declarations
  ['/api/disaster-declarations', '/'],

  // documents
  ['/api/documents', '/'],

  // drift
  ['/api/drift', `/${SAMPLE_UUID}`],

  // drip
  ['/api/crm/drip-sequences', '/'],
  ['/api/crm/drip-sequences', `/${SAMPLE_UUID}`],
  ['/api/crm/drip-sequences', `/${SAMPLE_UUID}/enrollments`],

  // estimates
  ['/api/estimates', '/'],
  ['/api/estimates', '/templates'],
  ['/api/estimates', `/${SAMPLE_UUID}`],

  // expenses
  ['/api/crm/expenses', '/'],
  ['/api/crm/expenses', `/summary/${SAMPLE_LEAD}`],

  // financing
  ['/api/crm/financing', '/lenders'],
  ['/api/crm/financing', '/plans'],
  ['/api/crm/financing', '/applications'],
  ['/api/crm/financing', `/applications/${SAMPLE_UUID}`],

  // invoices
  ['/api/crm/invoices', '/'],
  ['/api/crm/invoices', `/${SAMPLE_UUID}`],

  // leads (legacy)
  ['/api/leads', '/'],
  ['/api/leads', `/${SAMPLE_LEAD}`],

  // map
  ['/api/map', '/properties'],
  ['/api/map', '/affected-properties'],
  ['/api/map', '/swaths'],

  // materials
  ['/api/materials', '/products'],
  ['/api/materials', `/products/${SAMPLE_UUID}`],
  ['/api/materials', '/branches'],
  ['/api/materials', '/orders'],
  ['/api/materials', `/orders/${SAMPLE_UUID}`],
  ['/api/materials', '/credentials'],

  // notifications
  ['/api/notifications', '/'],
  ['/api/notifications', '/unread-count'],
  ['/api/notifications', '/preferences'],

  // onboarding
  ['/api/onboarding', '/plans'],

  // payments
  ['/api/payments', '/connect/status'],
  ['/api/payments', '/history'],

  // properties
  ['/api/properties', '/'],
  ['/api/properties', '/import-progress'],
  ['/api/properties', `/in-swath/${SAMPLE_UUID}/count`],
  ['/api/properties', `/in-swath/${SAMPLE_UUID}`],
  ['/api/properties', `/${SAMPLE_UUID}`],

  // reports
  ['/api/crm/reports', '/revenue'],
  ['/api/crm/reports', '/pipeline'],
  ['/api/crm/reports', '/conversion'],
  ['/api/crm/reports', '/rep-performance'],
  ['/api/crm/reports', '/stage-duration'],
  ['/api/crm/reports', '/lead-sources'],

  // roof measurement
  ['/api/roof-measurement', '/config'],
  ['/api/roof-measurement', `/segments/${SAMPLE_UUID}`],
  ['/api/roof-measurement', `/solar/${SAMPLE_UUID}`],
  ['/api/roof-measurement', '/usage'],
  ['/api/roof-measurement', '/balance'],

  // search
  ['/api/search', '/?q=test'],

  // skipTrace
  ['/api/skip-trace', '/config'],
  ['/api/skip-trace', `/job/${SAMPLE_UUID}`],
  ['/api/skip-trace', '/balance'],
  ['/api/skip-trace', '/invoices'],
  ['/api/skip-trace', '/usage'],
  ['/api/skip-trace', '/jobs'],

  // stormHistory
  ['/api/storm-history', '/'],
  ['/api/storm-history', '/heatmap'],

  // storms
  ['/api/storms', '/'],
  ['/api/storms', `/${SAMPLE_UUID}`],

  // subcontractors
  ['/api/crm/subcontractors', '/'],
  ['/api/crm/subcontractors', `/${SAMPLE_UUID}`],
  ['/api/crm/subcontractors', `/work-order/${SAMPLE_UUID}`],

  // territories
  ['/api/crm/territories', '/'],
  ['/api/crm/territories', `/${SAMPLE_UUID}`],
  ['/api/crm/territories', `/${SAMPLE_UUID}/pins`],

  // work orders
  ['/api/crm/work-orders', '/milestone-templates'],
  ['/api/crm/work-orders', '/'],
  ['/api/crm/work-orders', `/${SAMPLE_UUID}`],
  ['/api/crm/work-orders', `/${SAMPLE_UUID}/milestones`],

  // dataApis (external — may fail upstream, that's fine)
  ['/api/data', '/fema-housing?lat=40&lng=-95&radius=1000'],
  ['/api/data', '/directions?fromLat=40&fromLng=-95&toLat=41&toLng=-96'],
];

async function probe(token, mount, route) {
  const path = mount === '/' ? route : `${mount}${route}`.replace(/\/+/g, '/');
  // The route paths already include leading slash; mount + route should be fine.
  // Build the URL: mount already has /api prefix, route starts with /
  const url = `${API}${mount}${route === '/' ? '' : route}`;
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const ct = r.headers.get('content-type') || '';
    let body = null;
    if (ct.includes('application/json')) {
      try { body = await r.json(); } catch { body = null; }
    } else {
      try { body = (await r.text()).slice(0, 200); } catch { body = null; }
    }
    return { url, status: r.status, body };
  } catch (e) {
    return { url, status: 'ERR', body: String(e) };
  }
}

const token = await login();
console.log('token ok');

const results = [];
for (const [mount, route] of ENDPOINTS) {
  const r = await probe(token, mount, route);
  results.push(r);
  // Print only the interesting ones live
  if (r.status === 'ERR' || (typeof r.status === 'number' && r.status >= 500)) {
    console.log('!!', r.status, r.url, JSON.stringify(r.body).slice(0, 200));
  }
}

writeFileSync(
  'C:/Projects/stormleads/.qa-api-results.json',
  JSON.stringify(results, null, 2),
);

const fivexx = results.filter(r => r.status === 'ERR' || (typeof r.status === 'number' && r.status >= 500));
const fourxx = results.filter(r => typeof r.status === 'number' && r.status >= 400 && r.status < 500);
const ok = results.filter(r => typeof r.status === 'number' && r.status >= 200 && r.status < 300);

console.log('');
console.log('=== SUMMARY ===');
console.log(`Total probed : ${results.length}`);
console.log(`2xx          : ${ok.length}`);
console.log(`4xx          : ${fourxx.length}`);
console.log(`5xx / err    : ${fivexx.length}`);

if (fivexx.length) {
  console.log('');
  console.log('=== 5xx / errors ===');
  for (const r of fivexx) {
    console.log(`  ${r.status}  ${r.url}`);
    console.log(`     ${JSON.stringify(r.body).slice(0, 300)}`);
  }
}
