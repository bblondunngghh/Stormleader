// QA Run 41 — Hearth webhook + financing endpoint deep probe.
// Covers Carry-over #5 (Hearth webhook missing/malformed fields) and
// systematic invalid-input coverage of all /api/crm/financing routes
// (new on feat/financing branch).

const API = 'http://localhost:3001';

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

const HEARTH_PROBES = [
  ['HEARTH:empty-body',        'POST', '/api/webhooks/hearth', null,                                          {}],
  ['HEARTH:null-body',         'POST', '/api/webhooks/hearth', 'null',                                        { 'Content-Type': 'application/json' }],
  ['HEARTH:bad-json',          'POST', '/api/webhooks/hearth', '{garbage',                                    { 'Content-Type': 'application/json' }],
  ['HEARTH:missing-event',     'POST', '/api/webhooks/hearth', '{"data":{}}',                                 { 'Content-Type': 'application/json' }],
  ['HEARTH:missing-data',      'POST', '/api/webhooks/hearth', '{"event":"application.created"}',             { 'Content-Type': 'application/json' }],
  ['HEARTH:bad-signature',     'POST', '/api/webhooks/hearth', '{"event":"x"}',                               { 'Content-Type': 'application/json', 'X-Hearth-Signature': 'wrong' }],
  ['HEARTH:array-body',        'POST', '/api/webhooks/hearth', '[1,2,3]',                                     { 'Content-Type': 'application/json' }],
  ['HEARTH:nested-null',       'POST', '/api/webhooks/hearth', '{"event":null,"data":null}',                  { 'Content-Type': 'application/json' }],
  ['HEARTH:both-fields-empty', 'POST', '/api/webhooks/hearth', '{"event":"","data":{}}',                      { 'Content-Type': 'application/json' }],
  ['HEARTH:huge-payload',      'POST', '/api/webhooks/hearth', JSON.stringify({ event: 'x', data: { x: 'a'.repeat(10000) } }), { 'Content-Type': 'application/json' }],
];

const FIN_PUB_PROBES = [
  ['FIN-PUB:plans-bad-token',    'GET',  '/api/crm/financing/public/garbage-token-12345/plans',         null, {}],
  ['FIN-PUB:apps-bad-token',     'GET',  '/api/crm/financing/public/garbage-token-12345/applications', null, {}],
  ['FIN-PUB:apply-no-plan',      'POST', '/api/crm/financing/public/garbage-token-12345/apply', '{}',          { 'Content-Type': 'application/json' }],
  ['FIN-PUB:apply-bad-plan',     'POST', '/api/crm/financing/public/garbage-token-12345/apply', '{"planId":"not-a-uuid"}', { 'Content-Type': 'application/json' }],
  ['FIN-PUB:apply-uuid-plan',    'POST', '/api/crm/financing/public/garbage-token-12345/apply', '{"planId":"00000000-0000-0000-0000-000000000000"}', { 'Content-Type': 'application/json' }],
  ['FIN-PUB:apply-bad-json',     'POST', '/api/crm/financing/public/garbage-token-12345/apply', '{not-json', { 'Content-Type': 'application/json' }],
];

const FIN_AUTH_PROBES = [
  ['FIN-AUTH:lenders-list',         'GET',    '/api/crm/financing/lenders', null],
  ['FIN-AUTH:lender-no-fields',     'POST',   '/api/crm/financing/lenders', '{}'],
  ['FIN-AUTH:lender-bad-provider',  'POST',   '/api/crm/financing/lenders', '{"provider":"fake","apiKey":"x","merchantId":"y"}'],
  ['FIN-AUTH:lender-patch-bad-id',  'PATCH',  '/api/crm/financing/lenders/not-a-uuid', '{}'],
  ['FIN-AUTH:lender-patch-zero',    'PATCH',  '/api/crm/financing/lenders/00000000-0000-0000-0000-000000000000', '{}'],
  ['FIN-AUTH:lender-del-bad-id',    'DELETE', '/api/crm/financing/lenders/not-a-uuid', null],
  ['FIN-AUTH:lender-del-zero',      'DELETE', '/api/crm/financing/lenders/00000000-0000-0000-0000-000000000000', null],
  ['FIN-AUTH:plans-list',           'GET',    '/api/crm/financing/plans', null],
  ['FIN-AUTH:plans-bad-lender',     'GET',    '/api/crm/financing/plans?lenderId=not-a-uuid', null],
  ['FIN-AUTH:plans-sync-no-lender', 'POST',   '/api/crm/financing/plans/sync', '{}'],
  ['FIN-AUTH:plans-sync-bad-lender','POST',   '/api/crm/financing/plans/sync', '{"lenderId":"not-a-uuid"}'],
  ['FIN-AUTH:plans-sync-zero',      'POST',   '/api/crm/financing/plans/sync', '{"lenderId":"00000000-0000-0000-0000-000000000000"}'],
  ['FIN-AUTH:plan-patch-bad-id',    'PATCH',  '/api/crm/financing/plans/not-a-uuid', '{}'],
  ['FIN-AUTH:plan-patch-zero',      'PATCH',  '/api/crm/financing/plans/00000000-0000-0000-0000-000000000000', '{}'],
  ['FIN-AUTH:apps-list',            'GET',    '/api/crm/financing/applications', null],
  ['FIN-AUTH:apps-bad-id',          'GET',    '/api/crm/financing/applications/not-a-uuid', null],
  ['FIN-AUTH:apps-zero-uuid',       'GET',    '/api/crm/financing/applications/00000000-0000-0000-0000-000000000000', null],
  ['FIN-AUTH:apps-create-empty',    'POST',   '/api/crm/financing/applications', '{}'],
  ['FIN-AUTH:apps-create-no-plan',  'POST',   '/api/crm/financing/applications', '{"leadId":"00000000-0000-0000-0000-000000000000"}'],
  ['FIN-AUTH:apps-create-bad-ids',  'POST',   '/api/crm/financing/applications', '{"leadId":"not-a-uuid","planId":"not-a-uuid"}'],
  ['FIN-AUTH:apps-create-zero',     'POST',   '/api/crm/financing/applications', '{"leadId":"00000000-0000-0000-0000-000000000000","planId":"00000000-0000-0000-0000-000000000000"}'],
];

async function runProbe(name, method, path, body, extraHeaders, token) {
  const headers = { ...(extraHeaders || {}) };
  if (token && !path.includes('/public/') && !path.includes('/webhooks/')) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  try {
    const r = await fetch(`${API}${path}`, { method, headers, body });
    const ct = r.headers.get('content-type') || '';
    let resp;
    try { resp = ct.includes('application/json') ? await r.json() : (await r.text()).slice(0, 200); } catch { resp = null; }
    return { name, status: r.status, resp };
  } catch (e) {
    return { name, status: 'ERR', resp: String(e) };
  }
}

const token = await login();
const allProbes = [
  ...HEARTH_PROBES.map(p => [...p]),
  ...FIN_PUB_PROBES.map(p => [...p]),
  ...FIN_AUTH_PROBES.map(p => [p[0], p[1], p[2], p[3], {}]),
];

const results = [];
for (const [name, method, path, body, extra] of allProbes) {
  results.push(await runProbe(name, method, path, body, extra, token));
}

console.log('=== Hearth + Financing probe ===');
for (const r of results) {
  const marker = (r.status === 'ERR' || (typeof r.status === 'number' && r.status >= 500)) ? '!!' : '  ';
  const rstr = typeof r.resp === 'string' ? r.resp.slice(0, 140) : JSON.stringify(r.resp).slice(0, 200);
  console.log(`${marker} ${String(r.status).padEnd(4)} ${r.name.padEnd(36)} ${rstr}`);
}

import { writeFileSync } from 'node:fs';
writeFileSync('C:/Projects/stormleads/.qa-hearth-fin-results.json', JSON.stringify(results, null, 2));

const fivexx = results.filter(r => r.status === 'ERR' || (typeof r.status === 'number' && r.status >= 500));
console.log(`\n5xx / err count: ${fivexx.length}`);
if (fivexx.length) {
  for (const r of fivexx) console.log(`  ${r.status}  ${r.name}: ${JSON.stringify(r.resp).slice(0, 240)}`);
}
