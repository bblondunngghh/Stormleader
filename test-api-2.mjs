// Part 2: parameterized GETs (with valid ids) + POST/PATCH/DELETE tests
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

async function hit(method, path, body, ct = 'application/json') {
  const opts = { method, headers: { ...H } };
  if (body !== undefined) {
    if (ct) opts.headers['Content-Type'] = ct;
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  try {
    const res = await fetch(BASE + path, opts);
    const text = await res.text();
    return { status: res.status, snippet: text.slice(0, 300).replace(/\n/g, ' ') };
  } catch (e) {
    return { status: 'ERR', snippet: e.message };
  }
}

function log(r, method, path, extra = '') {
  const mark = r.status === 500 || r.status === 'ERR' ? '!!' : (r.status >= 200 && r.status < 300 ? 'OK' : '--');
  const show = (r.status === 500 || r.status === 'ERR') ? ' | ' + r.snippet.slice(0, 250)
             : (r.status >= 400 ? ' | ' + r.snippet.slice(0, 120) : '');
  console.log(`${mark} ${r.status} ${method} ${path}${extra}${show}`);
  return r;
}

// First, fetch a real lead and property id to use
const leadsRes = await fetch(BASE + '/api/crm/leads?limit=3', { headers: H });
const leadsData = await leadsRes.json();
const LEAD_ID = leadsData.leads?.[0]?.id || leadsData.data?.[0]?.id || leadsData[0]?.id;
console.log('Sample LEAD_ID:', LEAD_ID);

const propsRes = await fetch(BASE + '/api/map/properties?bbox=-98,30,-97,31', { headers: H });
const propsData = await propsRes.json();
const PROP_ID = propsData.properties?.[0]?.id || propsData[0]?.id;
console.log('Sample PROP_ID:', PROP_ID);

const stormsRes = await fetch(BASE + '/api/storms', { headers: H });
const stormsData = await stormsRes.json();
const STORM_ID = stormsData.storms?.[0]?.id || stormsData.events?.[0]?.id || stormsData[0]?.id;
console.log('Sample STORM_ID:', STORM_ID);

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

console.log('\n=== Parameterized GETs ===');

// These need real ids; use FAKE_UUID fallback (should 404 or empty)
const paramGets = [
  ['/api/crm/leads/' + (LEAD_ID || FAKE_UUID)],
  ['/api/crm/leads/' + (LEAD_ID || FAKE_UUID) + '/activities'],
  ['/api/properties/' + (PROP_ID || FAKE_UUID)],
  ['/api/storms/' + (STORM_ID || FAKE_UUID)],
  ['/api/crm/calendar?start=2026-01-01&end=2026-12-31'],
  ['/api/properties?bbox=-98,30,-97,31'],
  ['/api/map/swaths?bbox=-98,30,-97,31'],
  ['/api/map/affected-properties?bbox=-98,30,-97,31&stormEventId=' + FAKE_UUID],
  ['/api/disaster-declarations?state=TX&county=Travis'],
  ['/api/storm-history?lat=30.27&lng=-97.74'],
  ['/api/storm-history/heatmap?bbox=-98,30,-97,31'],
  ['/api/data/fema-housing?zip=78701'],
  ['/api/data/directions?fromLat=30.27&fromLng=-97.74&toLat=30.28&toLng=-97.75'],
  ['/api/properties/reverse-geocode?lat=30.27&lon=-97.74'],
  ['/api/crm/drip-sequences/' + FAKE_UUID],
  ['/api/crm/drip-sequences/' + FAKE_UUID + '/enrollments'],
  ['/api/crm/subcontractors/' + FAKE_UUID],
  ['/api/crm/territories/' + FAKE_UUID],
  ['/api/crm/territories/' + FAKE_UUID + '/pins'],
  ['/api/crm/contracts/' + FAKE_UUID],
  ['/api/crm/financing/applications/' + FAKE_UUID],
  ['/api/crm/work-orders/' + FAKE_UUID],
  ['/api/crm/work-orders/' + FAKE_UUID + '/milestones'],
  ['/api/crm/invoices/' + FAKE_UUID],
  ['/api/estimates/' + FAKE_UUID],
  ['/api/skip-trace/job/' + FAKE_UUID],
  ['/api/crm/expenses/summary/' + FAKE_UUID],
  ['/api/roof-measurement/segments/' + FAKE_UUID],
  ['/api/roof-measurement/solar/' + FAKE_UUID],
  ['/api/materials/products/' + FAKE_UUID],
  ['/api/materials/orders/' + FAKE_UUID],
  ['/api/properties/in-swath/' + FAKE_UUID + '/count'],
  ['/api/properties/in-swath/' + FAKE_UUID],
  ['/api/properties/fema-live?lat=30.27&lon=-97.74'],
  ['/api/drift/' + FAKE_UUID],
  ['/api/counties/' + FAKE_UUID + '/status'],
  ['/api/crm/prospect-lists/' + FAKE_UUID + '/items'],
  ['/api/crm/subcontractors/work-order/' + FAKE_UUID],
];

for (const [p] of paramGets) {
  const r = await hit('GET', p);
  log(r, 'GET', p);
}

console.log('\n=== POST with EMPTY body (tests the req.body undefined crash class) ===');
const postsEmpty = [
  '/api/crm/leads',
  '/api/crm/leads/quick',
  '/api/crm/activities',
  '/api/crm/tasks',
  '/api/crm/custom-fields',
  '/api/crm/prospect-lists',
  '/api/crm/leads/bulk-assign',
  '/api/crm/leads/bulk-status',
  '/api/crm/leads/score-all',
  '/api/crm/automations',
  '/api/crm/canvass-pins',
  '/api/crm/invoices',
  '/api/crm/drip-sequences',
  '/api/crm/expenses',
  '/api/crm/subcontractors',
  '/api/crm/subcontractors/assign',
  '/api/crm/territories',
  '/api/crm/contracts',
  '/api/crm/contracts/templates',
  '/api/crm/financing/lenders',
  '/api/crm/financing/plans/sync',
  '/api/crm/financing/applications',
  '/api/crm/work-orders',
  '/api/estimates',
  '/api/estimates/templates',
  '/api/alerts/test',
  '/api/properties',
  '/api/properties/generate-leads',
  '/api/properties/geocode',
  '/api/properties/import-csv',
  '/api/properties/fema-live-polygon',
  '/api/counties',
  '/api/skip-trace/submit',
  '/api/skip-trace/setup-payment',
  '/api/drift/correct-all',
  '/api/drift/simulate',
  '/api/drift/calibrate',
  '/api/crm/test-email',
  '/api/crm/team/invite',
  '/api/roof-measurement/measure',
  '/api/roof-measurement/manual',
  '/api/leads/from-storm',
  '/api/materials/orders',
  '/api/notifications/mark-all-read',
];
for (const p of postsEmpty) {
  const r = await hit('POST', p, {});
  log(r, 'POST', p, ' (empty)');
}

console.log('\n=== POST with NO body / NO content-type ===');
// No Content-Type header, no body (tests the req.body undefined destructuring crash)
for (const p of postsEmpty.slice(0, 20)) {
  const r = await hit('POST', p);
  log(r, 'POST', p, ' (no-body)');
}

console.log('\n=== PATCH/PUT endpoints with fake UUID and empty body ===');
const patches = [
  ['PATCH', '/api/crm/leads/' + FAKE_UUID],
  ['PATCH', '/api/crm/leads/' + FAKE_UUID + '/roof-type'],
  ['PATCH', '/api/crm/tasks/' + FAKE_UUID],
  ['PATCH', '/api/crm/custom-fields/' + FAKE_UUID],
  ['PATCH', '/api/crm/automations/' + FAKE_UUID],
  ['PATCH', '/api/crm/automations/' + FAKE_UUID + '/toggle'],
  ['PATCH', '/api/crm/canvass-pins/' + FAKE_UUID],
  ['PATCH', '/api/crm/drip-sequences/' + FAKE_UUID],
  ['PATCH', '/api/crm/expenses/' + FAKE_UUID],
  ['PATCH', '/api/crm/subcontractors/' + FAKE_UUID],
  ['PATCH', '/api/crm/territories/' + FAKE_UUID],
  ['PATCH', '/api/crm/contracts/' + FAKE_UUID],
  ['PATCH', '/api/crm/contracts/templates/' + FAKE_UUID],
  ['PATCH', '/api/crm/financing/lenders/' + FAKE_UUID],
  ['PATCH', '/api/crm/financing/plans/' + FAKE_UUID],
  ['PATCH', '/api/crm/work-orders/' + FAKE_UUID],
  ['PATCH', '/api/crm/invoices/' + FAKE_UUID],
  ['PATCH', '/api/estimates/' + FAKE_UUID],
  ['PATCH', '/api/estimates/templates/' + FAKE_UUID],
  ['PATCH', '/api/notifications/' + FAKE_UUID + '/read'],
  ['PATCH', '/api/notifications/preferences'],
  ['PATCH', '/api/auth/me'],
  ['PUT', '/api/alerts/config'],
  ['PUT', '/api/crm/tenant-settings'],
  ['PUT', '/api/roof-measurement/config'],
  ['PUT', '/api/skip-trace/config'],
  ['PUT', '/api/materials/credentials'],
  ['PUT', '/api/onboarding/org'],
  ['PUT', '/api/properties/' + FAKE_UUID + '/location'],
];
for (const [m, p] of patches) {
  const r = await hit(m, p, {});
  log(r, m, p, ' (empty body)');
}

console.log('\n=== DELETE endpoints with fake UUID ===');
const deletes = [
  '/api/crm/leads/' + FAKE_UUID,
  '/api/crm/automations/' + FAKE_UUID,
  '/api/crm/custom-fields/' + FAKE_UUID,
  '/api/crm/prospect-lists/' + FAKE_UUID,
  '/api/crm/drip-sequences/' + FAKE_UUID,
  '/api/crm/expenses/' + FAKE_UUID,
  '/api/crm/subcontractors/' + FAKE_UUID,
  '/api/crm/territories/' + FAKE_UUID,
  '/api/crm/contracts/templates/' + FAKE_UUID,
  '/api/crm/financing/lenders/' + FAKE_UUID,
  '/api/estimates/' + FAKE_UUID,
  '/api/estimates/templates/' + FAKE_UUID,
  '/api/documents/' + FAKE_UUID,
  '/api/skip-trace/payment-method',
];
for (const p of deletes) {
  const r = await hit('DELETE', p);
  log(r, 'DELETE', p);
}
