// Broad negative-case probe across modules that previously had 500s.
// Goal: confirm SQLSTATE handler catches bad-UUID/FK errors, and find any
// remaining plain Error() throws.

const BASE = 'http://localhost:3001/api';
const EMAIL = 'brandon@accessvaletparking.com';
const PASS = '1234';
const TENANT = 'waterloo';

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';
const NOT_UUID = 'not-a-uuid';

async function login() {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS, tenantSlug: TENANT }),
  });
  return (await r.json()).accessToken;
}

async function call(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const r = await fetch(`${BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let bodyParsed;
  try { bodyParsed = await r.json(); } catch { bodyParsed = await r.text(); }
  return { status: r.status, body: bodyParsed };
}

// Each test: [method, path, body, description]
const tests = [
  // Historical 500: POST /crm/subcontractors/assign with non-UUID
  ['POST', '/crm/subcontractors/assign', { workOrderId: NOT_UUID, subcontractorId: NOT_UUID }, 'subcontractor assign non-uuid'],
  ['POST', '/crm/subcontractors/assign', { workOrderId: FAKE_UUID, subcontractorId: FAKE_UUID }, 'subcontractor assign bogus uuid (FK)'],

  // Historical 500: POST /crm/invoices with bogus lead
  ['POST', '/crm/invoices', { lead_id: FAKE_UUID, total: 100 }, 'invoice bogus lead FK'],
  ['POST', '/crm/invoices', { lead_id: NOT_UUID, total: 100 }, 'invoice non-uuid lead'],

  // Historical 500: POST /estimates with bogus lead
  ['POST', '/estimates', { lead_id: FAKE_UUID, total: 100 }, 'estimate bogus lead FK'],

  // Historical 500: POST /crm/tasks with non-UUID lead_id
  ['POST', '/crm/tasks', { lead_id: NOT_UUID, title: 'x' }, 'task non-uuid lead'],
  ['POST', '/crm/tasks', { lead_id: FAKE_UUID, title: 'x' }, 'task bogus lead'],

  // Historical 500: POST /crm/canvass-pins non-numeric coords
  ['POST', '/crm/canvass-pins', { lat: 'not-a-num', lng: 'not-a-num' }, 'canvass non-numeric coords'],

  // Historical 500: POST /drift/:id/correct with bogus stormEventId
  ['POST', `/drift/${FAKE_UUID}/correct`, { drift_x: 0, drift_y: 0 }, 'drift bogus storm event'],

  // GET admin/tenants/:id with bogus
  ['GET', `/admin/tenants/${FAKE_UUID}`, null, 'admin tenant bogus'],
  ['GET', `/admin/tenants/${NOT_UUID}`, null, 'admin tenant non-uuid'],

  // Activity creation with bogus lead
  ['POST', '/crm/activities', { lead_id: FAKE_UUID, type: 'note' }, 'activity bogus lead FK'],
  ['POST', '/crm/activities', { lead_id: NOT_UUID, type: 'note' }, 'activity non-uuid lead'],

  // PATCH on bogus lead
  ['PATCH', `/crm/leads/${FAKE_UUID}`, { stage: 'new' }, 'patch lead bogus'],
  ['PATCH', `/crm/leads/${NOT_UUID}`, { stage: 'new' }, 'patch lead non-uuid'],

  // Bulk operations with bogus IDs
  ['POST', '/crm/leads/bulk-assign', { leadIds: [FAKE_UUID], userId: FAKE_UUID }, 'bulk-assign bogus'],
  ['POST', '/crm/leads/bulk-status', { leadIds: [FAKE_UUID], stage: 'new' }, 'bulk-status bogus'],
  ['POST', '/crm/leads/bulk-assign', { leadIds: [NOT_UUID], userId: NOT_UUID }, 'bulk-assign non-uuid'],

  // Estimate operations on bogus estimates
  ['POST', `/estimates/${FAKE_UUID}/duplicate`, {}, 'estimate duplicate bogus'],
  ['POST', `/estimates/${FAKE_UUID}/send`, {}, 'estimate send bogus'],
  ['POST', `/estimates/${FAKE_UUID}/sign-in-person`, { signatureData: 'x' }, 'sign in person bogus'],
  ['POST', `/estimates/${FAKE_UUID}/generate-tiers`, {}, 'generate tiers bogus'],

  // Invoice operations on bogus
  ['POST', `/crm/invoices/from-estimate/${FAKE_UUID}`, {}, 'invoice from-estimate bogus'],
  ['POST', `/crm/invoices/${FAKE_UUID}/payment`, { amount: 100 }, 'invoice payment bogus'],
  ['POST', `/crm/invoices/${FAKE_UUID}/send`, {}, 'invoice send bogus'],

  // Work order operations
  ['POST', `/crm/work-orders/from-estimate/${FAKE_UUID}`, {}, 'wo from-estimate bogus'],
  ['PATCH', `/crm/work-orders/${FAKE_UUID}/complete`, {}, 'wo complete bogus'],

  // Drip enroll/cancel with bogus
  ['POST', `/crm/drip-sequences/${FAKE_UUID}/enroll`, { leadId: FAKE_UUID }, 'drip enroll bogus seq'],
  ['POST', `/crm/drip-sequences/${FAKE_UUID}/cancel`, { leadId: FAKE_UUID }, 'drip cancel bogus seq'],

  // Property generate-leads / FEMA  — SKIP (FEMA off-limits) but test the safe ones
  // ['POST', '/properties/generate-leads', { bbox: 'x' }, 'gen-leads bad bbox'],

  // Storm lookup
  ['GET', `/storms/${FAKE_UUID}`, null, 'storm bogus id'],
  ['GET', `/storms/${NOT_UUID}`, null, 'storm non-uuid'],

  // Notifications
  ['PATCH', `/notifications/${FAKE_UUID}/read`, {}, 'notif read bogus'],

  // Documents
  ['DELETE', `/documents/${FAKE_UUID}`, null, 'document delete bogus'],

  // Roof measurement segments
  ['GET', `/roof-measurement/segments/${FAKE_UUID}`, null, 'roof segments bogus'],

  // Skip trace job
  ['GET', `/skip-trace/job/${FAKE_UUID}`, null, 'skip-trace job bogus'],

  // Custom fields PATCH/DELETE bogus
  ['PATCH', `/crm/custom-fields/${FAKE_UUID}`, { label: 'x' }, 'custom-field PATCH bogus'],
  ['DELETE', `/crm/custom-fields/${FAKE_UUID}`, null, 'custom-field DELETE bogus'],

  // Territories with bogus
  ['GET', `/crm/territories/${FAKE_UUID}`, null, 'territory bogus'],
  ['GET', `/crm/territories/${FAKE_UUID}/pins`, null, 'territory pins bogus'],

  // Contract bogus
  ['GET', `/crm/contracts/${FAKE_UUID}`, null, 'contract bogus'],
  ['POST', `/crm/contracts/${FAKE_UUID}/send`, {}, 'contract send bogus'],
  ['POST', `/crm/contracts/${FAKE_UUID}/void`, {}, 'contract void bogus'],
];

(async () => {
  const token = await login();
  const fives = [];
  const otherUnusual = [];

  for (const [method, path, body, desc] of tests) {
    const r = await call(method, path, token, body);
    const tag = r.status === 500 ? '🔴' : r.status >= 200 && r.status < 300 ? '⚪' : '✅';
    const summary = typeof r.body === 'object' ? (r.body.error || r.body.message || JSON.stringify(r.body).slice(0, 80)) : String(r.body).slice(0, 80);
    console.log(`${tag} ${String(r.status).padEnd(5)} ${method.padEnd(6)} ${path}`);
    console.log(`        ↳ ${desc}  :: ${summary}`);
    if (r.status === 500) fives.push({ method, path, desc, body: r.body });
    if (r.status >= 200 && r.status < 300) otherUnusual.push({ method, path, desc, body: r.body });
  }

  console.log('\n=== SUMMARY ===');
  console.log('Tests:', tests.length);
  console.log('5xx:', fives.length);
  console.log('Unexpected 2xx (negative case unexpectedly succeeded):', otherUnusual.length);
  if (fives.length) {
    console.log('\n--- 500s ---');
    fives.forEach(f => console.log(`  ${f.method} ${f.path}  -- ${f.desc}`));
  }
  if (otherUnusual.length) {
    console.log('\n--- 2XXs to investigate ---');
    otherUnusual.forEach(f => console.log(`  ${f.method} ${f.path}  -- ${f.desc}`));
  }
})();
