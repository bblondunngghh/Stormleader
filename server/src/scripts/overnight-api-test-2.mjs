#!/usr/bin/env node
// Second-pass: test :id endpoints by first fetching real IDs from list endpoints,
// then hitting each /:id route. Also probes /:id with a bogus UUID to verify
// graceful 404 (not 500).

import http from 'node:http';

const BASE = 'http://localhost:3001';
const BOGUS_UUID = '00000000-0000-0000-0000-000000000000';

function req(method, path, { token, body } = {}) {
  return new Promise((resolve) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    const r = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers, timeout: 30000 },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          let json = null;
          try { json = buf ? JSON.parse(buf) : null; } catch {}
          resolve({ status: res.statusCode, body: json, raw: buf });
        });
      }
    );
    r.on('timeout', () => { r.destroy(new Error('timeout')); resolve({ status: 0, err: 'timeout' }); });
    r.on('error', (e) => resolve({ status: 0, err: String(e) }));
    if (data) r.write(data);
    r.end();
  });
}

const login = await req('POST', '/api/auth/login', { body: { email: 'brandon@accessvaletparking.com', password: '1234', tenantSlug: 'waterloo' } });
const token = login.body.accessToken;

// helper: take first row's id from a list endpoint
async function firstId(path, arrayKey = null, idKey = 'id') {
  const r = await req('GET', path, { token });
  if (!r.body) return null;
  let arr;
  if (Array.isArray(r.body)) arr = r.body;
  else if (arrayKey && Array.isArray(r.body[arrayKey])) arr = r.body[arrayKey];
  else {
    // try common keys
    for (const k of ['leads','tasks','estimates','contracts','workOrders','invoices','subcontractors','expenses','territories','results','items','rows','data','lists','members','templates','sequences','automations','lenders','plans','applications','notifications','tenants','features','pins','customFields','fields']) {
      if (Array.isArray(r.body[k])) { arr = r.body[k]; break; }
    }
  }
  if (Array.isArray(arr) && arr.length > 0) {
    const row = arr[0];
    if (row.properties && row.properties.id) return row.properties.id; // GeoJSON Feature
    return row[idKey] || row.uuid || row.lead_id || null;
  }
  return null;
}

// fetch real IDs
const ids = {};
ids.lead = await firstId('/api/crm/leads');
ids.estimate = await firstId('/api/estimates');
ids.invoice = await firstId('/api/crm/invoices');
ids.workOrder = await firstId('/api/crm/work-orders');
ids.task = await firstId('/api/crm/tasks');
ids.contract = await firstId('/api/crm/contracts');
ids.drip = await firstId('/api/crm/drip-sequences');
ids.territory = await firstId('/api/crm/territories');
ids.subcontractor = await firstId('/api/crm/subcontractors');
ids.expense = await firstId('/api/crm/expenses');
ids.financing = await firstId('/api/crm/financing/applications');
ids.lender = await firstId('/api/crm/financing/lenders');
ids.plan = await firstId('/api/crm/financing/plans');
ids.automation = await firstId('/api/crm/automations');
ids.notification = await firstId('/api/notifications');
ids.document = await firstId('/api/documents');
ids.storm = await firstId('/api/storms', 'id');
ids.county = await firstId('/api/counties');
ids.customField = await firstId('/api/crm/custom-fields');
ids.canvassPin = await firstId('/api/crm/canvass-pins');
ids.tenant = await firstId('/api/admin/tenants');
ids.prospectList = await firstId('/api/crm/prospect-lists');
ids.property = await firstId('/api/properties?bbox=-100,30,-95,35');

console.log('# Resolved IDs:');
for (const [k, v] of Object.entries(ids)) {
  console.log(`  ${k}: ${v || '(none)'}`);
}
console.log();

const ID_TESTS = [
  ids.lead && ['GET', `/api/crm/leads/${ids.lead}`, 'lead detail'],
  ids.lead && ['GET', `/api/crm/leads/${ids.lead}/activities`, 'lead activities'],
  ids.estimate && ['GET', `/api/estimates/${ids.estimate}`, 'estimate detail'],
  ids.estimate && ['GET', `/api/estimates/${ids.estimate}/pdf`, 'estimate pdf'],
  ids.invoice && ['GET', `/api/crm/invoices/${ids.invoice}`, 'invoice detail'],
  ids.workOrder && ['GET', `/api/crm/work-orders/${ids.workOrder}`, 'WO detail'],
  ids.workOrder && ['GET', `/api/crm/work-orders/${ids.workOrder}/milestones`, 'WO milestones'],
  ids.workOrder && ['GET', `/api/crm/work-orders/${ids.workOrder}/pdf`, 'WO pdf'],
  ids.contract && ['GET', `/api/crm/contracts/${ids.contract}`, 'contract detail'],
  ids.contract && ['GET', `/api/crm/contracts/${ids.contract}/pdf`, 'contract pdf'],
  ids.drip && ['GET', `/api/crm/drip-sequences/${ids.drip}`, 'drip detail'],
  ids.drip && ['GET', `/api/crm/drip-sequences/${ids.drip}/enrollments`, 'drip enrollments'],
  ids.territory && ['GET', `/api/crm/territories/${ids.territory}`, 'territory detail'],
  ids.territory && ['GET', `/api/crm/territories/${ids.territory}/pins`, 'territory pins'],
  ids.subcontractor && ['GET', `/api/crm/subcontractors/${ids.subcontractor}`, 'subcontractor detail'],
  ids.lead && ['GET', `/api/crm/expenses/summary/${ids.lead}`, 'expenses summary'],
  ids.financing && ['GET', `/api/crm/financing/applications/${ids.financing}`, 'financing app detail'],
  ids.property && ['GET', `/api/properties/${ids.property}`, 'property detail'],
  ids.property && ['GET', `/api/properties/${ids.property}/weather-history`, 'property weather'],
  ids.property && ['GET', `/api/roof-measurement/segments/${ids.property}`, 'roof segments'],
  ids.property && ['GET', `/api/roof-measurement/solar/${ids.property}`, 'roof solar'],
  ids.storm && ['GET', `/api/storms/${ids.storm}`, 'storm detail'],
  ids.county && ['GET', `/api/counties/${ids.county}/status`, 'county status'],
  ids.tenant && ['GET', `/api/admin/tenants/${ids.tenant}`, 'admin tenant detail'],
  ids.prospectList && ['GET', `/api/crm/prospect-lists/${ids.prospectList}/items`, 'prospect list items'],
].filter(Boolean);

console.log('## :id endpoint coverage (real ID)');
console.log();

const issues = [];
for (const [method, path, label] of ID_TESTS) {
  const t0 = Date.now();
  const r = await req(method, path, { token });
  const ms = Date.now() - t0;
  const flag = r.status >= 500 ? '**5XX**' : (r.status >= 200 && r.status < 300 ? 'ok' : `${r.status}`);
  console.log(`${flag.padEnd(8)} ${String(r.status).padEnd(3)} ${String(ms).padStart(5)}ms ${path}  [${label}]`);
  if (r.status >= 500) {
    console.log('     5XX BODY: ' + (r.raw || '').slice(0, 400));
    issues.push({ path, status: r.status, body: r.raw });
  } else if (r.status >= 400 && r.status !== 404) {
    console.log('     ' + r.status + ' BODY: ' + (r.raw || '').slice(0, 200));
  }
}

console.log();
console.log('## :id endpoint coverage (bogus UUID — expect 404, not 500)');
console.log();

const BOGUS_TESTS = [
  ['GET', `/api/crm/leads/${BOGUS_UUID}`, 'lead detail (bogus)'],
  ['GET', `/api/estimates/${BOGUS_UUID}`, 'estimate detail (bogus)'],
  ['GET', `/api/crm/invoices/${BOGUS_UUID}`, 'invoice detail (bogus)'],
  ['GET', `/api/crm/work-orders/${BOGUS_UUID}`, 'WO detail (bogus)'],
  ['GET', `/api/crm/contracts/${BOGUS_UUID}`, 'contract detail (bogus)'],
  ['GET', `/api/crm/drip-sequences/${BOGUS_UUID}`, 'drip detail (bogus)'],
  ['GET', `/api/crm/territories/${BOGUS_UUID}`, 'territory detail (bogus)'],
  ['GET', `/api/crm/subcontractors/${BOGUS_UUID}`, 'subcontractor detail (bogus)'],
  ['GET', `/api/properties/${BOGUS_UUID}`, 'property detail (bogus)'],
  ['GET', `/api/properties/${BOGUS_UUID}/weather-history`, 'property weather (bogus)'],
  ['GET', `/api/crm/financing/applications/${BOGUS_UUID}`, 'financing app (bogus)'],
  ['GET', `/api/admin/tenants/${BOGUS_UUID}`, 'admin tenant (bogus)'],
];

for (const [method, path, label] of BOGUS_TESTS) {
  const r = await req(method, path, { token });
  const flag = r.status >= 500 ? '**5XX**' : (r.status === 404 ? 'ok' : `${r.status}`);
  console.log(`${flag.padEnd(8)} ${String(r.status).padEnd(3)} ${path}  [${label}]`);
  if (r.status >= 500) {
    console.log('     5XX BODY: ' + (r.raw || '').slice(0, 400));
    issues.push({ path, status: r.status, body: r.raw });
  }
}

// Test non-UUID-shaped IDs - the validateId middleware should reject
console.log();
console.log('## :id endpoint coverage (non-UUID id — expect 400)');
console.log();
const BAD_ID_TESTS = [
  ['GET', `/api/crm/leads/notauuid`, 'lead (bad shape)'],
  ['GET', `/api/estimates/notauuid`, 'estimate (bad shape)'],
  ['GET', `/api/crm/invoices/notauuid`, 'invoice (bad shape)'],
];

for (const [method, path, label] of BAD_ID_TESTS) {
  const r = await req(method, path, { token });
  const flag = r.status >= 500 ? '**5XX**' : (r.status === 400 ? 'ok' : `${r.status}`);
  console.log(`${flag.padEnd(8)} ${String(r.status).padEnd(3)} ${path}  [${label}]`);
  if (r.status >= 500) {
    console.log('     5XX BODY: ' + (r.raw || '').slice(0, 400));
    issues.push({ path, status: r.status, body: r.raw });
  }
}

console.log();
console.log('## Issues found');
console.log(JSON.stringify(issues, null, 2));
