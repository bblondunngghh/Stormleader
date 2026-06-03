// Tenant isolation probe.
// Logs in as waterloo tenant user, then tries to access/mutate a resource
// belonging to the stormleads-test tenant. Any 2xx is a tenant-isolation bug.
//
// Also tests tenant_id injection vectors: query param, body param, header.

const BASE = 'http://localhost:3001';
const LOGIN = {
  email: 'waterlooconstruction1@gmail.com',
  password: '2Wealth&health',
  tenantSlug: 'waterloo',
};

// Foreign resource (in stormleads-test tenant 84d2b23c-...):
// estimates router is mounted at /api/estimates, not /api/crm/estimates.
const FOREIGN_ESTIMATE = '1a6d63d8-ed9c-4fb9-967b-0ad58fda76d4';
const FOREIGN_TENANT_ID = '84d2b23c-2408-4cfb-a9d6-5a00c8f2f4b2';
const FOREIGN_TENANT_SLUG = 'stormleads-test';

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(LOGIN),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error('login failed: ' + JSON.stringify(j));
  return j.accessToken;
}

async function probe(method, path, body, token, extraHeaders = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  };
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 120); }
  return { status: r.status, body: parsed };
}

const results = [];

function record(label, method, path, expect, result) {
  const ok =
    typeof expect === 'function'
      ? expect(result)
      : Array.isArray(expect)
      ? expect.includes(result.status)
      : result.status === expect;
  results.push({ label, method, path, status: result.status, ok, body: result.body });
  const flag = ok ? 'OK ' : 'BAD';
  console.log(`[${flag}] ${result.status}  ${method.padEnd(6)} ${path}  -- ${label}`);
  if (!ok) console.log('         body:', JSON.stringify(result.body).slice(0, 240));
}

const token = await login();
console.log('token ok\n');

// 1) Direct UUID access on foreign estimate (should 404)
record(
  'GET foreign estimate by id',
  'GET',
  `/api/estimates/${FOREIGN_ESTIMATE}`,
  404,
  await probe('GET', `/api/estimates/${FOREIGN_ESTIMATE}`, null, token)
);

record(
  'PATCH foreign estimate (forbidden)',
  'PATCH',
  `/api/estimates/${FOREIGN_ESTIMATE}`,
  [400, 403, 404],
  await probe('PATCH', `/api/estimates/${FOREIGN_ESTIMATE}`, { status: 'sent' }, token)
);

record(
  'PUT foreign estimate (forbidden)',
  'PUT',
  `/api/estimates/${FOREIGN_ESTIMATE}`,
  [400, 403, 404],
  await probe('PUT', `/api/estimates/${FOREIGN_ESTIMATE}`, { status: 'sent' }, token)
);

record(
  'DELETE foreign estimate (forbidden)',
  'DELETE',
  `/api/estimates/${FOREIGN_ESTIMATE}`,
  [403, 404, 405],
  await probe('DELETE', `/api/estimates/${FOREIGN_ESTIMATE}`, null, token)
);

// 2) tenant_id injection via query param on list endpoints
const listEndpoints = [
  '/api/crm/leads',
  '/api/crm/tasks',
  '/api/estimates',
  '/api/documents',
  '/api/notifications',
  '/api/crm/financing/applications',
  '/api/crm/invoices',
  '/api/crm/automations',
  '/api/crm/contracts',
  '/api/crm/expenses',
  '/api/crm/subcontractors',
  '/api/crm/territories',
  '/api/crm/work-orders',
  '/api/crm/drip-sequences',
  '/api/crm/canvass-pins',
];

for (const ep of listEndpoints) {
  // We can't easily detect "is this leaking" because the response would still
  // be 200, but it would contain foreign data. Compare lengths with/without
  // injected tenant_id; if injection works, length differs.
  const baseline = await probe('GET', ep, null, token);
  const injected = await probe('GET', `${ep}?tenant_id=${FOREIGN_TENANT_ID}`, null, token);
  const baselineCount = countItems(baseline.body);
  const injectedCount = countItems(injected.body);
  const ok =
    baseline.status === injected.status &&
    baselineCount === injectedCount; // same data → tenant_id ignored, good
  results.push({
    label: 'tenant_id query injection',
    method: 'GET',
    path: ep,
    status: injected.status,
    ok,
    body: { baselineCount, injectedCount },
  });
  console.log(
    `[${ok ? 'OK ' : 'BAD'}] ${injected.status}  GET    ${ep}?tenant_id=...  baseline=${baselineCount} injected=${injectedCount}`
  );
}

// 3) tenant_id injection via body on POST endpoints
const createTask = await probe(
  'POST',
  '/api/crm/tasks',
  {
    title: 'tenant isolation probe task — DELETE ME',
    tenant_id: FOREIGN_TENANT_ID,
    tenantId: FOREIGN_TENANT_ID,
  },
  token
);

if (createTask.status === 200 || createTask.status === 201) {
  const task = createTask.body.task || createTask.body;
  const actualTenant = task && (task.tenant_id || task.tenantId);
  const ok = actualTenant && actualTenant !== FOREIGN_TENANT_ID;
  results.push({
    label: 'POST /tasks ignores tenant_id in body',
    method: 'POST',
    path: '/api/crm/tasks',
    status: createTask.status,
    ok,
    body: { actualTenant, attemptedTenant: FOREIGN_TENANT_ID },
  });
  console.log(
    `[${ok ? 'OK ' : 'BAD'}] ${createTask.status}  POST   /api/crm/tasks  body.tenant_id ignored? actual=${actualTenant}`
  );
  // Cleanup
  if (task && task.id) {
    // PATCH it to mark completed (no DELETE endpoint exists) and tag it
    await probe('PATCH', `/api/crm/tasks/${task.id}`, { is_completed: true, title: 'qa probe — safe to delete' }, token);
  }
} else {
  console.log(`[?? ] ${createTask.status}  POST   /api/crm/tasks  body=${JSON.stringify(createTask.body).slice(0,200)}`);
}

// 4) Tenant header spoofing
record(
  'GET leads with X-Tenant-Id header spoof',
  'GET',
  '/api/crm/leads?limit=1',
  [200],
  await probe('GET', '/api/crm/leads?limit=1', null, token, {
    'X-Tenant-Id': FOREIGN_TENANT_ID,
    'X-Tenant-Slug': FOREIGN_TENANT_SLUG,
  })
);

// 5) Try accessing super_admin / platform-level endpoints
record(
  'GET /api/admin/tenants (non-platform-admin)',
  'GET',
  '/api/admin/tenants',
  [401, 403, 404],
  await probe('GET', '/api/admin/tenants', null, token)
);

function countItems(body) {
  if (!body || typeof body !== 'object') return -1;
  if (Array.isArray(body)) return body.length;
  // common shapes
  for (const k of ['leads', 'contacts', 'estimates', 'tasks', 'activities', 'documents', 'notifications', 'applications', 'items', 'data', 'rows']) {
    if (Array.isArray(body[k])) return body[k].length;
  }
  if (typeof body.total === 'number') return body.total;
  return -1;
}

console.log('\n=== SUMMARY ===');
const total = results.length;
const bad = results.filter((r) => !r.ok);
console.log(`Total probes: ${total}`);
console.log(`OK:           ${total - bad.length}`);
console.log(`BAD:          ${bad.length}`);

if (bad.length) {
  console.log('\n=== BAD ===');
  for (const r of bad) {
    console.log(`  ${r.method.padEnd(6)} ${r.path}`);
    console.log(`    status=${r.status} body=${JSON.stringify(r.body).slice(0, 240)}`);
  }
}

import { writeFileSync } from 'node:fs';
writeFileSync('.qa-api-tenant-isolation-results.json', JSON.stringify(results, null, 2));
