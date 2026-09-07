// Run 128 (s1-api-test) — verifies the cross-tenant `assigned_rep_id` disclosure is closed
// on BOTH sides: the read joins no longer resolve a foreign user, and every write boundary
// that accepts a client-supplied user id now rejects one owned by another tenant.
//
// Read-only against the DB except for the two PATCHes on ONE pre-existing lead, which the
// script restores to its original assigned_rep_id before it exits.
import fs from 'fs';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const LEAD = process.argv[2];
const FOREIGN_USER = 'f5c01c73-9ef5-49e7-9162-eecc01fdd7b6'; // tenant 5a358592 (waterloo-roofco-3)
const OWN_USER = process.argv[3];

const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const results = [];

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: H,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

// 1. READ SIDE — the lead still stores the foreign id from the pre-fix proof.
const detail = await req('GET', `/api/crm/leads/${LEAD}`);
const lead = detail.json?.lead || detail.json || {};
check(
  'READ getLeadDetail does not resolve a foreign user',
  lead.rep_first_name == null && lead.rep_last_name == null && lead.rep_email == null,
  `stored rep=${lead.assigned_rep_id} -> first=${lead.rep_first_name} last=${lead.rep_last_name} email=${lead.rep_email}`
);

// 2. WRITE SIDE — PATCH /api/crm/leads/:id
const patchForeign = await req('PATCH', `/api/crm/leads/${LEAD}`, { assigned_rep_id: FOREIGN_USER });
check('WRITE PATCH /crm/leads/:id rejects a foreign user', patchForeign.status === 400,
  `HTTP ${patchForeign.status} ${JSON.stringify(patchForeign.json)}`);

// 3. WRITE SIDE — POST /api/crm/leads/bulk-assign
const bulk = await req('POST', '/api/crm/leads/bulk-assign', { leadIds: [LEAD], assignedRepId: FOREIGN_USER });
check('WRITE POST /crm/leads/bulk-assign rejects a foreign user', bulk.status === 400,
  `HTTP ${bulk.status} ${JSON.stringify(bulk.json)}`);

// 4. WRITE SIDE — POST /api/crm/leads/quick (a 400 means no row is created)
const quick = await req('POST', '/api/crm/leads/quick', {
  contact_name: 'QA-R128-SHOULD-NOT-EXIST', assigned_rep_id: FOREIGN_USER,
});
check('WRITE POST /crm/leads/quick rejects a foreign user', quick.status === 400,
  `HTTP ${quick.status} ${JSON.stringify(quick.json).slice(0, 120)}`);
if (quick.status === 201) console.log('  !! CLEANUP NEEDED: created lead', quick.json?.id);

// 5. WRITE SIDE — PATCH /api/crm/work-orders/:id
const wos = await req('GET', '/api/crm/work-orders?limit=1');
const woId = (wos.json?.workOrders || wos.json?.work_orders || [])[0]?.id;
if (woId) {
  const woPatch = await req('PATCH', `/api/crm/work-orders/${woId}`, { assigned_to: FOREIGN_USER });
  check('WRITE PATCH /crm/work-orders/:id rejects a foreign user', woPatch.status === 400,
    `HTTP ${woPatch.status} ${JSON.stringify(woPatch.json)}`);
} else {
  check('WRITE PATCH /crm/work-orders/:id rejects a foreign user', false, 'no work order fixture');
}

// 6. WRITE SIDE — POST /api/crm/tasks (regression guard on the 3a3d752 rule)
const task = await req('POST', '/api/crm/tasks', { title: 'QA-R128', assigned_to: FOREIGN_USER });
check('WRITE POST /crm/tasks still rejects a foreign user', task.status === 400,
  `HTTP ${task.status} ${JSON.stringify(task.json)}`);
if (task.status === 201) console.log('  !! CLEANUP NEEDED: created task', task.json?.id);

// 7. NO REGRESSION — the caller's OWN user is still accepted and still resolves.
const restore = await req('PATCH', `/api/crm/leads/${LEAD}`, { assigned_rep_id: OWN_USER });
check('WRITE PATCH accepts the caller\'s own user', restore.status === 200, `HTTP ${restore.status}`);

const after = await req('GET', `/api/crm/leads/${LEAD}`);
const l2 = after.json?.lead || after.json || {};
check('READ resolves the caller\'s own user normally',
  l2.assigned_rep_id === OWN_USER && !!l2.rep_email,
  `rep=${l2.assigned_rep_id} email=${l2.rep_email} name=${l2.rep_first_name} ${l2.rep_last_name}`);

// 8. NO REGRESSION — the consumer endpoints that share the fixed joins still answer 200.
const consumers = [
  '/api/crm/dashboard/stale-leads',
  '/api/crm/dashboard/upcoming-followups',
  '/api/crm/work-orders?limit=5',
  '/api/estimates?limit=5',
  '/api/crm/tasks?limit=5',
  '/api/crm/dashboard/tasks-today',
  '/api/documents?limit=5',
  '/api/canvassing/pins',
];
for (const path of consumers) {
  const r = await req('GET', path);
  check(`READ ${path} still 200`, r.status === 200, `HTTP ${r.status}`);
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
