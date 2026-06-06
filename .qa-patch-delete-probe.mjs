// Sweep PATCH/PUT/DELETE endpoints with empty bodies and dummy UUIDs to
// surface any crash paths the POST-only write probe missed.

import { writeFileSync } from 'node:fs';

const API = 'http://localhost:3001';
const ZERO = '00000000-0000-0000-0000-000000000000';

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
  return (await r.json()).accessToken;
}

const PROBES = [
  // PATCH endpoints
  ['PATCH', '/api/auth/me', '{}'],
  ['PATCH', `/api/crm/automations/${ZERO}`, '{}'],
  ['PATCH', `/api/crm/automations/${ZERO}/toggle`, '{}'],
  ['PATCH', `/api/crm/canvass-pins/${ZERO}`, '{}'],
  ['PATCH', `/api/crm/contracts/templates/${ZERO}`, '{}'],
  ['PATCH', `/api/crm/contracts/${ZERO}`, '{}'],
  ['PATCH', `/api/crm/leads/${ZERO}`, '{}'],
  ['PATCH', `/api/crm/leads/${ZERO}/roof-type`, '{}'],
  ['PATCH', `/api/crm/tasks/${ZERO}`, '{}'],
  ['PATCH', `/api/crm/team/${ZERO}/role`, '{}'],
  ['PATCH', `/api/crm/drip-sequences/${ZERO}`, '{}'],
  ['PATCH', `/api/estimates/${ZERO}`, '{}'],
  ['PATCH', `/api/estimates/templates/${ZERO}`, '{}'],
  ['PATCH', `/api/crm/expenses/${ZERO}`, '{}'],
  ['PATCH', `/api/crm/financing/lenders/${ZERO}`, '{}'],
  ['PATCH', `/api/crm/financing/plans/${ZERO}`, '{}'],
  ['PATCH', `/api/crm/invoices/${ZERO}`, '{}'],
  ['PATCH', `/api/leads/${ZERO}`, '{}'],
  ['PATCH', `/api/notifications/${ZERO}/read`, '{}'],
  ['PATCH', `/api/notifications/preferences`, '{}'],
  ['PATCH', `/api/crm/subcontractors/${ZERO}`, '{}'],
  ['PATCH', `/api/crm/territories/${ZERO}`, '{}'],
  ['PATCH', `/api/crm/work-orders/${ZERO}`, '{}'],
  ['PATCH', `/api/crm/work-orders/${ZERO}/complete`, '{}'],
  ['PATCH', `/api/crm/work-orders/${ZERO}/milestones/${ZERO}`, '{}'],

  // PUT endpoints
  ['PUT', '/api/alerts/config', '{}'],
  ['PUT', `/api/admin/tenants/${ZERO}`, '{}'],
  ['PUT', `/api/crm/tenant-settings`, '{}'],
  ['PUT', `/api/materials/credentials`, '{}'],
  ['PUT', `/api/properties/${ZERO}/location`, '{}'],
  ['PUT', `/api/roof-measurement/config`, '{}'],
  ['PUT', `/api/skip-trace/config`, '{}'],

  // DELETE endpoints
  ['DELETE', `/api/crm/automations/${ZERO}`, null],
  ['DELETE', `/api/crm/leads/${ZERO}`, null],
  ['DELETE', `/api/crm/leads/${ZERO}/contacts/${ZERO}`, null],
  ['DELETE', `/api/crm/contracts/templates/${ZERO}`, null],
  ['DELETE', `/api/crm/drip-sequences/${ZERO}`, null],
  ['DELETE', `/api/estimates/${ZERO}`, null],
  ['DELETE', `/api/estimates/templates/${ZERO}`, null],
  ['DELETE', `/api/crm/expenses/${ZERO}`, null],
  ['DELETE', `/api/crm/financing/lenders/${ZERO}`, null],
  ['DELETE', `/api/documents/${ZERO}`, null],
  ['DELETE', `/api/crm/prospect-lists/${ZERO}`, null],
  ['DELETE', `/api/crm/prospect-lists/${ZERO}/items/${ZERO}`, null],
  ['DELETE', `/api/crm/custom-fields/${ZERO}`, null],
  ['DELETE', `/api/skip-trace/payment-method`, null],
  ['DELETE', `/api/crm/subcontractors/${ZERO}`, null],
  ['DELETE', `/api/crm/subcontractors/work-order/${ZERO}/${ZERO}`, null],
  ['DELETE', `/api/crm/territories/${ZERO}`, null],
  ['DELETE', `/api/crm/work-orders/${ZERO}/milestones/${ZERO}`, null],
];

const token = await login();
const results = [];

for (const [method, path, body] of PROBES) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== null) headers['Content-Type'] = 'application/json';
  try {
    const r = await fetch(`${API}${path}`, { method, headers, body });
    const ct = r.headers.get('content-type') || '';
    let resp;
    try { resp = ct.includes('application/json') ? await r.json() : (await r.text()).slice(0, 200); } catch { resp = null; }
    results.push({ method, path, status: r.status, resp });
  } catch (e) {
    results.push({ method, path, status: 'ERR', resp: String(e) });
  }
}

for (const r of results) {
  const marker = (r.status === 'ERR' || (typeof r.status === 'number' && r.status >= 500)) ? '!!' : '  ';
  const rstr = typeof r.resp === 'string' ? r.resp.slice(0, 120) : JSON.stringify(r.resp).slice(0, 180);
  console.log(`${marker} ${String(r.status).padEnd(4)} ${r.method.padEnd(6)} ${r.path.padEnd(70)} ${rstr}`);
}

writeFileSync('C:/Projects/stormleads/.qa-patch-delete-results.json', JSON.stringify(results, null, 2));

const fivexx = results.filter(r => r.status === 'ERR' || (typeof r.status === 'number' && r.status >= 500));
console.log(`\n5xx / err count: ${fivexx.length}`);
if (fivexx.length) {
  for (const r of fivexx) console.log(`  ${r.status}  ${r.method} ${r.path}: ${JSON.stringify(r.resp).slice(0, 240)}`);
}
