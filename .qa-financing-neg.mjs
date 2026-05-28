// Negative-case probe for the financing module (new in this branch).
// Run 33 found 3 "bogus UUID → 500" bugs in other modules — apply same probe here.

import fs from 'node:fs';

const BASE = 'http://localhost:3001/api';
const EMAIL = 'brandon@accessvaletparking.com';
const PASS = '1234';
const TENANT = 'waterloo';

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';
const BAD_TOKEN = 'definitely-not-a-real-token-just-garbage';
const NOT_UUID = 'not-a-uuid-at-all';

async function login() {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS, tenantSlug: TENANT }),
  });
  return (await r.json()).accessToken;
}

async function call(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let bodyParsed = text;
  try { bodyParsed = JSON.parse(text); } catch {}
  return { status: r.status, body: bodyParsed };
}

const tests = [
  // PATCH/DELETE on bogus lender IDs — should be 404, not 500
  ['PATCH', `/crm/financing/lenders/${FAKE_UUID}`, { name: 'changed' }, 'expect 404'],
  ['DELETE', `/crm/financing/lenders/${FAKE_UUID}`, null, 'expect 404'],

  // Non-UUID IDs — should be 400 (validateId middleware)
  ['PATCH', `/crm/financing/lenders/${NOT_UUID}`, { name: 'x' }, 'expect 400 invalid uuid'],
  ['DELETE', `/crm/financing/lenders/${NOT_UUID}`, null, 'expect 400 invalid uuid'],

  // PATCH on bogus plan ID — should be 404
  ['PATCH', `/crm/financing/plans/${FAKE_UUID}`, { name: 'x' }, 'expect 404'],

  // GET application by bogus IDs
  ['GET', `/crm/financing/applications/${FAKE_UUID}`, null, 'expect 404'],
  ['GET', `/crm/financing/applications/${NOT_UUID}`, null, 'expect 400 invalid uuid'],

  // POST lender with missing required fields
  ['POST', '/crm/financing/lenders', {}, 'expect 400 missing provider'],
  ['POST', '/crm/financing/lenders', { provider: 'hearth' }, 'expect 400 missing apiKey/merchantId'],

  // POST plans/sync without lenderId
  ['POST', '/crm/financing/plans/sync', {}, 'expect 400 missing lenderId'],
  ['POST', '/crm/financing/plans/sync', { lenderId: FAKE_UUID }, 'expect 404 or proper error'],
  ['POST', '/crm/financing/plans/sync', { lenderId: NOT_UUID }, 'expect 400 invalid uuid (no validateId on body)'],

  // POST application missing required fields
  ['POST', '/crm/financing/applications', {}, 'expect 400 lead_id required'],
  ['POST', '/crm/financing/applications', { lead_id: FAKE_UUID }, 'expect 400 lender_id required'],
  ['POST', '/crm/financing/applications', { lead_id: FAKE_UUID, lender_id: FAKE_UUID }, 'expect 4xx/proper'],

  // Public routes with garbage tokens
  ['GET', `/crm/financing/public/${BAD_TOKEN}/plans`, null, 'expect 4xx noauth'],
  ['GET', `/crm/financing/public/${BAD_TOKEN}/applications`, null, 'expect 4xx noauth'],
  ['POST', `/crm/financing/public/${BAD_TOKEN}/apply`, { planId: FAKE_UUID }, 'expect 404 noauth'],
  ['POST', `/crm/financing/public/${BAD_TOKEN}/apply`, {}, 'expect 400 missing planId'],
];

(async () => {
  const token = await login();
  const results = [];
  for (const [method, path, body, expect] of tests) {
    // Public endpoints test without token
    const useToken = path.includes('/public/') ? null : token;
    const r = await call(method, path, useToken, body);
    const status = r.status;
    const summary = typeof r.body === 'object' ? (r.body.error || r.body.message || JSON.stringify(r.body).slice(0, 100)) : String(r.body).slice(0, 100);
    const flag = status === 500 ? '🔴 FIVEHUNDRED' : status >= 200 && status < 300 ? '⚪ 2XX' : '✅';
    console.log(`${flag} ${status} ${method.padEnd(6)} ${path}`);
    console.log(`         expect: ${expect}`);
    console.log(`         body:   ${summary}`);
    results.push({ method, path, status, expect, summary });
  }
  console.log('\n--- 500s ---');
  const fives = results.filter(r => r.status === 500);
  fives.forEach(r => console.log(r));
  console.log(fives.length === 0 ? '✓ no 500s' : `✗ ${fives.length} found`);

  fs.writeFileSync('.qa-financing-neg-results.txt', JSON.stringify(results, null, 2));
})();
