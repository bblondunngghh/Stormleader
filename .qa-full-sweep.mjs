// Full-sweep probe — hit every route in server/src/routes/*.js using the
// inventory file (.qa-routes.json). For each route:
//   - Replace :params with a sample UUID
//   - GET/DELETE — no body
//   - POST/PUT/PATCH — empty {} body
// Capture status. Anything 5xx is a defect (except the well-known intentional
// 503 from /api/skip-trace/job/* when TRACERFY_API_KEY is unset).

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
  const d = await r.json();
  return d.accessToken;
}

function fillParams(p) {
  // :id → SAMPLE_UUID, :leadId → SAMPLE_LEAD, etc.
  return p.replace(/:[a-zA-Z]+/g, (m) => {
    if (m === ':leadId' || m === ':lead_id') return SAMPLE_LEAD;
    return SAMPLE_UUID;
  });
}

const routes = JSON.parse(readFileSync('.qa-routes.json', 'utf8'));

// Skip routes that are known to be problematic to hit blindly:
// - DELETE /api/auth/* (none exist but be safe)
// - POST /api/auth/logout - it would invalidate our token mid-sweep
// - POST /api/auth/login,register,refresh - need special bodies
// - Webhook routes that don't accept JSON body
const SKIP = new Set([
  'POST /api/auth/login',
  'POST /api/auth/register',
  'POST /api/auth/refresh',
  'POST /api/auth/logout',
  // Hearth webhook needs special raw-body handling (already covered)
  'POST /api/webhooks/hearth/',
]);

const token = await login();
console.log('token ok');

const results = [];
let n = 0;
const total = routes.length;
for (const r of routes) {
  if (!r.full) continue;
  const full = fillParams(r.full);
  const key = `${r.method} ${r.full}`;
  if (SKIP.has(key)) {
    results.push({ ...r, full, status: 'SKIP', body: 'intentionally skipped' });
    continue;
  }
  const opts = {
    method: r.method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
  if (r.method !== 'GET' && r.method !== 'DELETE') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = '{}';
  }
  let status, body;
  try {
    const resp = await fetch(API + full, opts);
    status = resp.status;
    body = (await resp.text()).slice(0, 250);
  } catch (e) {
    status = 'ERR';
    body = e.message;
  }
  results.push({ ...r, full, status, body });
  n++;
  if (n % 30 === 0) console.log(`  [${n}/${total}]`);
}

writeFileSync('.qa-full-sweep-results.json', JSON.stringify(results, null, 2));

const byStatus = {};
const fivexx = [];
for (const r of results) {
  const k = String(r.status);
  byStatus[k] = (byStatus[k] || 0) + 1;
  if (typeof r.status === 'number' && r.status >= 500) fivexx.push(r);
  if (r.status === 'ERR') fivexx.push(r);
}

console.log('\n=== SUMMARY ===');
console.log('Total :', results.length);
console.log('Status:', byStatus);
console.log('\n=== 5xx / ERR ===');
for (const r of fivexx) {
  console.log(`  ${r.status}  ${r.method.padEnd(7)} ${r.full}`);
  console.log(`        ${r.body}`);
}
console.log(`\n5xx/err count: ${fivexx.length}`);
