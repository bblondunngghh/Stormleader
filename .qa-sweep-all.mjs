// QA sweep — exhaustive endpoint hammer. GET all + POST/PATCH/DELETE with empty/bad payloads.
// Goal: catch 5xx crashes, not validate business logic.
import fs from 'node:fs';
import http from 'node:http';

const TOKEN = fs.readFileSync('.qa-token.txt', 'utf8').trim();
const HOST = 'localhost';
const PORT = 3001;

// Sample IDs for path substitution. UUIDs are valid format but unlikely to exist.
const SAMPLE = {
  ':id': '00000000-0000-0000-0000-000000000001',
  ':leadId': '00000000-0000-0000-0000-000000000001',
  ':userId': '00000000-0000-0000-0000-000000000001',
  ':propertyId': '00000000-0000-0000-0000-000000000001',
  ':contactId': '00000000-0000-0000-0000-000000000001',
  ':estimateId': '00000000-0000-0000-0000-000000000001',
  ':woId': '00000000-0000-0000-0000-000000000001',
  ':milestoneId': '00000000-0000-0000-0000-000000000001',
  ':workOrderId': '00000000-0000-0000-0000-000000000001',
  ':subcontractorId': '00000000-0000-0000-0000-000000000001',
  ':stormEventId': '00000000-0000-0000-0000-000000000001',
  ':token': 'invalid-token-test',
  ':jobId': '00000000-0000-0000-0000-000000000001',
};

function sub(path) {
  return path.replace(/:[a-zA-Z]+/g, m => SAMPLE[m] ?? 'test');
}

function req(method, fullPath, body) {
  return new Promise(resolve => {
    const payload = body == null ? null : JSON.stringify(body);
    const headers = { Authorization: `Bearer ${TOKEN}` };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const r = http.request(
      { hostname: HOST, port: PORT, path: fullPath, method, headers, timeout: 15000 },
      res => {
        let chunks = '';
        res.on('data', c => (chunks += c));
        res.on('end', () => resolve({ status: res.statusCode, body: chunks.slice(0, 500) }));
      }
    );
    r.on('error', e => resolve({ status: 0, body: 'ERR ' + e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, body: 'TIMEOUT' }); });
    if (payload) r.write(payload);
    r.end();
  });
}

// Mount points: from server/src/routes/index.js
const MOUNTS = {
  auth: '/api/auth',
  storms: '/api/storms',
  map: '/api/map',
  dashboard: '/api/dashboard',
  properties: '/api/properties',
  leads: '/api/leads',
  skipTrace: '/api/skip-trace',
  webhook: '/api/webhooks',
  alerts: '/api/alerts',
  drift: '/api/drift',
  counties: '/api/counties',
  financing: '/api/crm/financing',
  contracts: '/api/crm/contracts',
  crm: '/api/crm',
  automations: '/api/crm/automations',
  invoices: '/api/crm/invoices',
  canvassing: '/api/crm/canvass-pins',
  reports: '/api/crm/reports',
  workOrders: '/api/crm/work-orders',
  drip: '/api/crm/drip-sequences',
  estimates: '/api/estimates',
  notifications: '/api/notifications',
  search: '/api/search',
  documents: '/api/documents',
  roofMeasurement: '/api/roof-measurement',
  onboarding: '/api/onboarding',
  admin: '/api/admin',
  payments: '/api/payments',
  materials: '/api/materials',
  expenses: '/api/crm/expenses',
  subcontractors: '/api/crm/subcontractors',
  territories: '/api/crm/territories',
  hearthWebhook: '/api/webhooks/hearth',
  disasterDeclarations: '/api/disaster-declarations',
  stormHistory: '/api/storm-history',
  dataApis: '/api/data',
};

// Parsed from /tmp/routes-inventory.txt — every route in the API.
// Format: [mount-key, method, path-template]
const ROUTES = [
  // admin
  ['admin', 'get', '/overview'],
  ['admin', 'get', '/tenants'],
  ['admin', 'get', '/tenants/:id'],
  ['admin', 'put', '/tenants/:id'],
  ['admin', 'get', '/revenue'],
  ['admin', 'get', '/usage'],
  // alerts
  ['alerts', 'get', '/config'],
  ['alerts', 'put', '/config'],
  ['alerts', 'get', '/history'],
  ['alerts', 'post', '/test'],
  // auth
  ['auth', 'post', '/register'],
  ['auth', 'post', '/login'],
  ['auth', 'get', '/me'],
  ['auth', 'patch', '/me'],
  ['auth', 'post', '/refresh'],
  // automations
  ['automations', 'get', '/'],
  ['automations', 'post', '/'],
  ['automations', 'patch', '/:id'],
  ['automations', 'delete', '/:id'],
  ['automations', 'patch', '/:id/toggle'],
  // canvassing
  ['canvassing', 'get', '/'],
  ['canvassing', 'get', '/stats'],
  ['canvassing', 'post', '/'],
  ['canvassing', 'patch', '/:id'],
  ['canvassing', 'post', '/:id/convert'],
  // contracts
  ['contracts', 'get', '/public/:token'],
  ['contracts', 'post', '/public/:token/sign'],
  ['contracts', 'get', '/templates'],
  ['contracts', 'post', '/templates'],
  ['contracts', 'patch', '/templates/:id'],
  ['contracts', 'delete', '/templates/:id'],
  ['contracts', 'get', '/'],
  ['contracts', 'get', '/:id'],
  ['contracts', 'post', '/'],
  ['contracts', 'patch', '/:id'],
  ['contracts', 'post', '/:id/send'],
  ['contracts', 'post', '/:id/void'],
  ['contracts', 'get', '/:id/pdf'],
  // counties
  ['counties', 'get', '/'],
  ['counties', 'post', '/'],
  ['counties', 'post', '/:id/import'],
  ['counties', 'get', '/:id/status'],
  // crm
  ['crm', 'get', '/leads'],
  ['crm', 'post', '/leads'],
  ['crm', 'post', '/leads/quick'],
  ['crm', 'get', '/leads/:id'],
  ['crm', 'patch', '/leads/:id'],
  ['crm', 'delete', '/leads/:id'],
  ['crm', 'patch', '/leads/:id/roof-type'],
  ['crm', 'post', '/leads/bulk-assign'],
  ['crm', 'post', '/leads/bulk-status'],
  ['crm', 'post', '/leads/:id/score'],
  // skip heavy /leads/score-all
  ['crm', 'post', '/leads/:id/contacts'],
  ['crm', 'delete', '/leads/:leadId/contacts/:contactId'],
  ['crm', 'post', '/activities'],
  ['crm', 'get', '/leads/:id/activities'],
  ['crm', 'get', '/tasks'],
  ['crm', 'post', '/tasks'],
  ['crm', 'patch', '/tasks/:id'],
  ['crm', 'delete', '/tasks/:id'],  // Run 32 finding: may be missing
  ['crm', 'get', '/pipeline/stages'],
  ['crm', 'get', '/pipeline/metrics'],
  ['crm', 'get', '/dashboard/stats'],
  ['crm', 'get', '/dashboard/activity'],
  ['crm', 'get', '/team'],
  ['crm', 'patch', '/team/:userId/role'],
  ['crm', 'post', '/team/invite'],
  ['crm', 'get', '/tenant-settings'],
  ['crm', 'put', '/tenant-settings'],
  // skip test-email — sends real email
  ['crm', 'get', '/dashboard/properties-affected'],
  ['crm', 'get', '/dashboard/properties-affected/list'],
  ['crm', 'get', '/dashboard/followups'],
  ['crm', 'get', '/dashboard/conversion-by-storm'],
  ['crm', 'get', '/dashboard/estimate-summary'],
  ['crm', 'get', '/dashboard/ar-summary'],
  ['crm', 'get', '/dashboard/estimating-conversion'],
  ['crm', 'get', '/dashboard/leaderboard'],
  ['crm', 'get', '/dashboard/tasks-today'],
  ['crm', 'get', '/dashboard/days-in-stage'],
  ['crm', 'get', '/dashboard/stale-leads'],
  ['crm', 'get', '/dashboard/customer-storm-alerts'],
  ['crm', 'get', '/dashboard/lead-source-revenue'],
  ['crm', 'post', '/prospect-lists'],
  ['crm', 'get', '/prospect-lists'],
  ['crm', 'get', '/prospect-lists/:id/items'],
  ['crm', 'delete', '/prospect-lists/:id/items/:propertyId'],
  ['crm', 'delete', '/prospect-lists/:id'],
  ['crm', 'get', '/calendar'],
  ['crm', 'get', '/custom-fields'],
  ['crm', 'post', '/custom-fields'],
  ['crm', 'patch', '/custom-fields/:id'],
  ['crm', 'delete', '/custom-fields/:id'],
  // dashboard
  ['dashboard', 'get', '/stats'],
  ['dashboard', 'get', '/funnel'],
  ['dashboard', 'get', '/activity'],
  // dataApis
  ['dataApis', 'get', '/fema-housing'],
  ['dataApis', 'post', '/optimize-route'],
  ['dataApis', 'get', '/directions'],
  // disasterDeclarations
  ['disasterDeclarations', 'get', '/'],
  // documents
  ['documents', 'get', '/'],
  // skip /upload — multipart
  ['documents', 'delete', '/:id'],
  // drift
  ['drift', 'get', '/:stormEventId'],
  ['drift', 'post', '/:stormEventId/correct'],
  // skip /correct-all — heavy
  ['drift', 'post', '/simulate'],
  ['drift', 'post', '/calibrate'],
  // drip
  ['drip', 'get', '/'],
  ['drip', 'get', '/:id'],
  ['drip', 'post', '/'],
  ['drip', 'patch', '/:id'],
  ['drip', 'delete', '/:id'],
  ['drip', 'post', '/:id/enroll'],
  ['drip', 'post', '/:id/cancel'],
  ['drip', 'get', '/:id/enrollments'],
  // estimates
  ['estimates', 'get', '/public/:token'],
  ['estimates', 'post', '/public/:token/accept'],
  ['estimates', 'post', '/public/:token/decline'],
  ['estimates', 'get', '/'],
  ['estimates', 'get', '/templates'],
  ['estimates', 'post', '/templates'],
  ['estimates', 'patch', '/templates/:id'],
  ['estimates', 'delete', '/templates/:id'],
  ['estimates', 'get', '/:id'],
  ['estimates', 'post', '/'],
  ['estimates', 'patch', '/:id'],
  ['estimates', 'delete', '/:id'],
  ['estimates', 'post', '/:id/send'],
  ['estimates', 'post', '/:id/duplicate'],
  ['estimates', 'get', '/:id/pdf'],
  ['estimates', 'post', '/:id/sign-in-person'],
  ['estimates', 'post', '/:id/generate-tiers'],
  // expenses
  ['expenses', 'get', '/'],
  ['expenses', 'get', '/summary/:leadId'],
  ['expenses', 'post', '/'],
  ['expenses', 'patch', '/:id'],
  ['expenses', 'delete', '/:id'],
  // financing
  ['financing', 'get', '/public/:token/plans'],
  ['financing', 'get', '/public/:token/applications'],
  ['financing', 'post', '/public/:token/apply'],
  ['financing', 'get', '/lenders'],
  ['financing', 'post', '/lenders'],
  ['financing', 'patch', '/lenders/:id'],
  ['financing', 'delete', '/lenders/:id'],
  ['financing', 'get', '/plans'],
  ['financing', 'post', '/plans/sync'],
  ['financing', 'patch', '/plans/:id'],
  ['financing', 'get', '/applications'],
  ['financing', 'get', '/applications/:id'],
  ['financing', 'post', '/applications'],
  // invoices
  ['invoices', 'get', '/'],
  ['invoices', 'get', '/:id'],
  ['invoices', 'post', '/'],
  ['invoices', 'post', '/from-estimate/:estimateId'],
  ['invoices', 'patch', '/:id'],
  ['invoices', 'post', '/:id/payment'],
  ['invoices', 'post', '/:id/send'],
  // skip send-email — real email
  // leads
  ['leads', 'get', '/status/public/:token'],
  ['leads', 'get', '/'],
  ['leads', 'get', '/:id'],
  ['leads', 'patch', '/:id'],
  ['leads', 'post', '/:id/status-token'],
  ['leads', 'post', '/from-storm'],
  // map
  ['map', 'get', '/properties'],
  ['map', 'get', '/affected-properties'],
  ['map', 'get', '/swaths'],
  // materials
  ['materials', 'get', '/products'],
  ['materials', 'get', '/products/:id'],
  ['materials', 'get', '/branches'],
  ['materials', 'post', '/orders'],
  ['materials', 'get', '/orders'],
  ['materials', 'get', '/orders/:id'],
  ['materials', 'post', '/estimate/:estimateId/auto-order'],
  ['materials', 'put', '/credentials'],
  ['materials', 'get', '/credentials'],
  // notifications
  ['notifications', 'get', '/'],
  ['notifications', 'get', '/unread-count'],
  ['notifications', 'patch', '/:id/read'],
  ['notifications', 'post', '/mark-all-read'],
  ['notifications', 'get', '/preferences'],
  ['notifications', 'patch', '/preferences'],
  // onboarding
  ['onboarding', 'put', '/org'],
  ['onboarding', 'get', '/plans'],
  // skip create-tenant, select-plan, setup-payment, enable-addons, complete — state changes
  // payments
  ['payments', 'get', '/connect/status'],
  ['payments', 'get', '/history'],
  // properties
  ['properties', 'get', '/import-progress'],
  ['properties', 'get', '/'],
  ['properties', 'get', '/in-swath/:stormEventId/count'],
  ['properties', 'get', '/in-swath/:stormEventId'],
  ['properties', 'get', '/reverse-geocode'],
  ['properties', 'get', '/:id'],
  ['properties', 'get', '/:id/weather-history'],
  ['properties', 'get', '/:id/weather-history/pdf'],
  ['properties', 'get', '/:id/report/pdf'],
  // skip POST geocode/import/etc — costs money or heavy
  // reports
  ['reports', 'get', '/revenue'],
  ['reports', 'get', '/pipeline'],
  ['reports', 'get', '/conversion'],
  ['reports', 'get', '/rep-performance'],
  ['reports', 'get', '/stage-duration'],
  ['reports', 'get', '/lead-sources'],
  // roofMeasurement
  ['roofMeasurement', 'get', '/config'],
  ['roofMeasurement', 'put', '/config'],
  ['roofMeasurement', 'post', '/measure'],
  ['roofMeasurement', 'post', '/manual'],
  ['roofMeasurement', 'get', '/segments/:propertyId'],
  ['roofMeasurement', 'get', '/solar/:propertyId'],
  ['roofMeasurement', 'get', '/usage'],
  ['roofMeasurement', 'get', '/balance'],
  // search
  ['search', 'get', '/?q=test'],
  // skipTrace
  ['skipTrace', 'get', '/config'],
  ['skipTrace', 'put', '/config'],
  ['skipTrace', 'post', '/submit'],
  ['skipTrace', 'get', '/job/:jobId'],
  ['skipTrace', 'get', '/balance'],
  ['skipTrace', 'get', '/invoices'],
  ['skipTrace', 'get', '/usage'],
  ['skipTrace', 'get', '/jobs'],
  // stormHistory
  ['stormHistory', 'get', '/'],
  ['stormHistory', 'get', '/heatmap'],
  // storms
  ['storms', 'get', '/'],
  ['storms', 'get', '/:id'],
  // subcontractors
  ['subcontractors', 'get', '/'],
  ['subcontractors', 'get', '/:id'],
  ['subcontractors', 'post', '/'],
  ['subcontractors', 'patch', '/:id'],
  ['subcontractors', 'delete', '/:id'],
  ['subcontractors', 'post', '/assign'],
  ['subcontractors', 'get', '/work-order/:workOrderId'],
  ['subcontractors', 'delete', '/work-order/:workOrderId/:subcontractorId'],
  // territories
  ['territories', 'get', '/'],
  ['territories', 'get', '/:id'],
  ['territories', 'post', '/'],
  ['territories', 'patch', '/:id'],
  ['territories', 'delete', '/:id'],
  ['territories', 'get', '/:id/pins'],
  // workOrders
  ['workOrders', 'get', '/milestone-templates'],
  ['workOrders', 'get', '/'],
  ['workOrders', 'get', '/:id'],
  ['workOrders', 'post', '/'],
  ['workOrders', 'post', '/from-estimate/:estimateId'],
  ['workOrders', 'patch', '/:id'],
  ['workOrders', 'patch', '/:id/complete'],
  ['workOrders', 'get', '/:id/milestones'],
  ['workOrders', 'post', '/:id/milestones'],
  ['workOrders', 'delete', '/:woId/milestones/:milestoneId'],
  ['workOrders', 'patch', '/:id/milestones/:milestoneId'],
  ['workOrders', 'get', '/:id/pdf'],
];

const results = [];
let i = 0;
for (const [mount, method, p] of ROUTES) {
  i++;
  const path = MOUNTS[mount] + sub(p);
  const body = ['post','patch','put'].includes(method) ? {} : null;
  const { status, body: rb } = await req(method.toUpperCase(), path, body);
  const flag = status >= 500 ? '🔥5XX' : status === 0 ? '⛔CONN' : status >= 400 ? '⚠️' : '✓';
  results.push({ mount, method, path, status, flag, snippet: rb.replace(/\s+/g,' ').slice(0,200) });
  if (status >= 500 || status === 0) {
    console.log(`${flag} ${method.toUpperCase()} ${path} → ${status} | ${rb.slice(0,200)}`);
  }
}

console.log(`\nTotal: ${results.length}`);
const buckets = {};
for (const r of results) buckets[r.status] = (buckets[r.status]||0)+1;
console.log('Status distribution:', buckets);

fs.writeFileSync('.qa-api-results.txt',
  results.map(r => `${r.flag}\t${r.status}\t${r.method.toUpperCase()}\t${r.path}\t${r.snippet}`).join('\n')
);
console.log('Saved .qa-api-results.txt');
