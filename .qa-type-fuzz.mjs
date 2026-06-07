// Type-fuzz probe — for every POST/PUT/PATCH route, send a body where every
// "obvious field" carries a wrong type. Looking for handlers that do
// .toLowerCase() / .trim() / arithmetic on a value the caller controls
// without validating its type first — classic source of TypeError 500s.

import { readFileSync, writeFileSync } from 'node:fs';

const API = 'http://localhost:3001';
const SAMPLE_UUID = '00000000-0000-0000-0000-000000000000';
const SAMPLE_LEAD = '3fa29df8-589c-44a6-ac4d-88cb78243cbe';

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
  return (await r.json()).accessToken;
}

function fillParams(p) {
  return p.replace(/:[a-zA-Z]+/g, (m) => {
    if (m === ':leadId' || m === ':lead_id') return SAMPLE_LEAD;
    return SAMPLE_UUID;
  });
}

// Fuzz payloads — each represents a class of bad input
const FUZZ_BODIES = [
  // Numeric where string expected
  { name: 12345, email: 67890, status: 11111, type: 22222, slug: 33333 },
  // Array where scalar expected
  { name: [1,2,3], email: ['a','b'], status: ['x'], type: ['y'] },
  // Object where scalar expected (nested injection)
  { name: { $eq: 1 }, email: { foo: 'bar' }, status: { a: 1 } },
  // Boolean where string expected (and vice versa)
  { name: true, email: false, enabled: 'maybe', active: 'sometimes' },
  // null on required fields
  { name: null, email: null, status: null, lat: null, lng: null, planId: null, leadId: null },
  // Huge strings
  { name: 'x'.repeat(50000), email: 'x'.repeat(10000) + '@y.z', notes: 'x'.repeat(100000) },
  // Number fields with non-numbers
  { lat: 'north', lng: 'east', amount: 'tons', total: 'lots', limit: 'big', page: 'one' },
  // Negative / NaN numbers
  { amount: -99999999, total: NaN, limit: -1, page: -100, lat: 9999, lng: -9999 },
  // Date fields with bad dates
  { date: 'tomorrow', startDate: 'soon', endDate: 'later', created_at: 'now', due_date: 'never' },
];

const ROUTES = JSON.parse(readFileSync('.qa-routes.json', 'utf8'));

// Only mutate POST/PUT/PATCH. Skip:
//   - auth/login/register/refresh (need real bodies, would burn rate limits)
//   - hearth webhook (special raw-body handling — covered by .qa-hearth-fin.mjs)
//   - identity-mutating routes (auth/me, tenant-settings, materials/credentials,
//     leads PATCH, etc.) — historically these silently accepted bogus types
//     and corrupted user/tenant identity. Now guarded by the 2026-06-06 fixes
//     to auth/me + work-orders milestones, but the LEAD PATCH route still
//     trustingly writes whatever it's given. Keep these skipped to keep the
//     sample lead clean across runs.
const SKIP = new Set([
  'POST /api/auth/login',
  'POST /api/auth/register',
  'POST /api/auth/refresh',
  'POST /api/webhooks/hearth/',
  'PATCH /api/auth/me',
  'PUT /api/crm/tenant-settings',
  'PUT /api/materials/credentials',
  'PATCH /api/crm/leads/:id',
  'PATCH /api/crm/leads/:leadId',
]);

const token = await login();
console.log('token ok\n');

const fivexx = [];
let n = 0;

for (const r of ROUTES) {
  if (!['POST', 'PUT', 'PATCH'].includes(r.method)) continue;
  const key = `${r.method} ${r.full}`;
  if (SKIP.has(key)) continue;

  const url = API + fillParams(r.full);

  for (let i = 0; i < FUZZ_BODIES.length; i++) {
    const body = FUZZ_BODIES[i];
    let bodyText;
    try { bodyText = JSON.stringify(body); }
    catch { bodyText = '{}'; }
    let status, respBody;
    try {
      const resp = await fetch(url, {
        method: r.method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: bodyText,
      });
      status = resp.status;
      respBody = (await resp.text()).slice(0, 250);
    } catch (e) {
      status = 'ERR';
      respBody = e.message;
    }
    n++;
    if (typeof status === 'number' && status >= 500) {
      fivexx.push({ method: r.method, full: r.full, fuzzIdx: i, status, body: respBody });
      console.log(`  !! ${status}  ${r.method.padEnd(6)} ${r.full} fuzz#${i}`);
      console.log(`       ${respBody}`);
    } else if (status === 'ERR') {
      fivexx.push({ method: r.method, full: r.full, fuzzIdx: i, status, body: respBody });
    }
  }
}

writeFileSync('.qa-type-fuzz-results.json', JSON.stringify(fivexx, null, 2));

console.log(`\nTotal probes : ${n}`);
console.log(`5xx/err count : ${fivexx.length}`);
