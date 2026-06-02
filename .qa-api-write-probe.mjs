// Probe write endpoints with empty/invalid bodies to look for unhandled
// validation crashes (5xx). 400 is the correct response.

import { writeFileSync } from 'node:fs';

const API = 'http://localhost:3001';
const SAMPLE_LEAD = '3fa29df8-589c-44a6-ac4d-88cb78243cbe';
const SAMPLE_UUID = '00000000-0000-0000-0000-000000000000';

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
  const d = await r.json();
  return d.accessToken;
}

// [method, mount, path, body]
const PROBES = [
  // alerts
  ['POST', '/api/alerts/test', {}],

  // automations
  ['POST', '/api/crm/automations', {}],

  // canvassing
  ['POST', '/api/crm/canvass-pins', {}],

  // contracts
  ['POST', '/api/crm/contracts/templates', {}],
  ['POST', '/api/crm/contracts', {}],

  // counties
  ['POST', '/api/counties', {}],

  // crm leads
  ['POST', '/api/crm/leads', {}],
  ['POST', '/api/crm/leads/quick', {}],
  ['POST', '/api/crm/leads/bulk-assign', {}],
  ['POST', '/api/crm/leads/bulk-status', {}],

  // crm activities/tasks
  ['POST', '/api/crm/activities', {}],
  ['POST', '/api/crm/tasks', {}],

  // crm team
  ['POST', '/api/crm/team/invite', {}],

  // crm tenant settings
  ['POST', '/api/crm/test-email', {}],

  // crm prospect lists
  ['POST', '/api/crm/prospect-lists', {}],

  // crm custom fields
  ['POST', '/api/crm/custom-fields', {}],

  // drip
  ['POST', '/api/crm/drip-sequences', {}],

  // estimates
  ['POST', '/api/estimates', {}],
  ['POST', '/api/estimates/templates', {}],

  // expenses
  ['POST', '/api/crm/expenses', {}],

  // financing
  ['POST', '/api/crm/financing/lenders', {}],

  // invoices
  ['POST', '/api/crm/invoices', {}],

  // materials
  ['POST', '/api/materials/orders', {}],

  // notifications
  ['POST', '/api/notifications/mark-all-read', {}],

  // properties
  ['POST', '/api/properties', {}],
  ['POST', '/api/properties/geocode', {}],

  // roof measurement
  ['POST', '/api/roof-measurement/measure', {}],
  ['POST', '/api/roof-measurement/manual', {}],

  // skipTrace
  ['POST', '/api/skip-trace/submit', {}],

  // subcontractors
  ['POST', '/api/crm/subcontractors', {}],
  ['POST', '/api/crm/subcontractors/assign', {}],

  // territories
  ['POST', '/api/crm/territories', {}],

  // work orders
  ['POST', '/api/crm/work-orders', {}],

  // patches with empty body
  ['PATCH', `/api/crm/leads/${SAMPLE_LEAD}`, {}],
  ['PATCH', '/api/auth/me', {}],
  ['PATCH', '/api/notifications/preferences', {}],
];

async function probe(token, method, path, body) {
  const url = `${API}${path}`;
  try {
    const r = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    const ct = r.headers.get('content-type') || '';
    let rbody = null;
    if (ct.includes('application/json')) {
      try { rbody = await r.json(); } catch { rbody = null; }
    } else {
      try { rbody = (await r.text()).slice(0, 200); } catch { rbody = null; }
    }
    return { method, url, status: r.status, body: rbody };
  } catch (e) {
    return { method, url, status: 'ERR', body: String(e) };
  }
}

const token = await login();
const results = [];
for (const [method, path, body] of PROBES) {
  const r = await probe(token, method, path, body);
  results.push(r);
  if (r.status === 'ERR' || (typeof r.status === 'number' && r.status >= 500)) {
    console.log('!!', r.status, r.method, r.url, JSON.stringify(r.body).slice(0, 200));
  }
}

writeFileSync(
  'C:/Projects/stormleads/.qa-api-write-results.json',
  JSON.stringify(results, null, 2),
);

const by = {};
for (const r of results) by[r.status] = (by[r.status] || 0) + 1;
console.log('');
console.log('=== SUMMARY ===');
console.log(`Total : ${results.length}`);
console.log(by);

const fivexx = results.filter(r => r.status === 'ERR' || (typeof r.status === 'number' && r.status >= 500));
if (fivexx.length) {
  console.log('');
  console.log('=== 5xx / err ===');
  for (const r of fivexx) {
    console.log(`  ${r.status}  ${r.method} ${r.url}`);
    console.log(`     ${JSON.stringify(r.body).slice(0, 300)}`);
  }
} else {
  console.log('No 5xx — all empty-body POSTs cleanly rejected.');
}
