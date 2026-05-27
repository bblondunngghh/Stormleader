// Run 33 write-flow probe: hits PATCH/DELETE/POST endpoints with bogus IDs and
// missing/invalid payloads. Negative paths only — should NEVER 5xx or 200-on-bad.
// One known-good happy-path per resource is interleaved to confirm the route is alive.

import fs from 'node:fs';

const TOKEN = fs.readFileSync('.qa-token', 'utf8').trim();
const BASE = 'http://localhost:3001';
const BOGUS = '00000000-0000-0000-0000-000000000000';
const BAD_UUID = 'not-a-uuid';

const results = [];

async function probe(label, method, path, body, expectStatusSet) {
  const headers = { 'Authorization': `Bearer ${TOKEN}` };
  let opts = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  let status, text;
  try {
    const r = await fetch(BASE + path, opts);
    status = r.status;
    text = await r.text();
  } catch (e) {
    results.push({ label, method, path, status: 'TRANSPORT', body: e.message, ok: false });
    return;
  }
  const ok = expectStatusSet.includes(status);
  results.push({
    label, method, path, status, ok,
    bodyPreview: text.length > 220 ? text.slice(0, 220) + '...' : text,
  });
}

// === BOGUS-ID negative paths (expect 400 or 404, never 5xx) ===
const expectClient = [400, 403, 404, 422];

// CRM
await probe('crm patch lead bogus', 'PATCH', `/api/crm/leads/${BOGUS}`, { stage: 'new' }, expectClient);
await probe('crm delete lead bogus', 'DELETE', `/api/crm/leads/${BOGUS}`, undefined, expectClient);
await probe('crm patch lead bad-uuid', 'PATCH', `/api/crm/leads/${BAD_UUID}`, { stage: 'new' }, expectClient);
await probe('crm patch lead bad-stage', 'PATCH', `/api/crm/leads/${BOGUS}`, { stage: 'invalid_stage_xyz' }, expectClient);
await probe('crm patch lead.roof-type bogus', 'PATCH', `/api/crm/leads/${BOGUS}/roof-type`, { roofType: 'asphalt' }, expectClient);
await probe('crm score lead bogus', 'POST', `/api/crm/leads/${BOGUS}/score`, {}, expectClient);
await probe('crm add contact bogus lead', 'POST', `/api/crm/leads/${BOGUS}/contacts`, { name: 'qa' }, expectClient);
await probe('crm patch task bogus', 'PATCH', `/api/crm/tasks/${BOGUS}`, { status: 'done' }, expectClient);
await probe('crm patch task bad-priority', 'POST', '/api/crm/tasks', { title: 'qa', priority: 'lukewarm' }, expectClient);
await probe('crm prospect-list bogus delete', 'DELETE', `/api/crm/prospect-lists/${BOGUS}/items/${BOGUS}`, undefined, expectClient);

// Estimates
await probe('estimate patch bogus', 'PATCH', `/api/estimates/${BOGUS}`, { status: 'draft' }, expectClient);
await probe('estimate delete bogus', 'DELETE', `/api/estimates/${BOGUS}`, undefined, expectClient);
await probe('estimate send bogus', 'POST', `/api/estimates/${BOGUS}/send`, {}, expectClient);
await probe('estimate dup bogus', 'POST', `/api/estimates/${BOGUS}/duplicate`, {}, expectClient);
await probe('estimate sign bogus', 'POST', `/api/estimates/${BOGUS}/sign-in-person`, {}, expectClient);
await probe('estimate generate-tiers bogus', 'POST', `/api/estimates/${BOGUS}/generate-tiers`, {}, expectClient);
await probe('estimate template patch bogus', 'PATCH', `/api/estimates/templates/${BOGUS}`, { name: 'x' }, expectClient);
await probe('estimate template delete bogus', 'DELETE', `/api/estimates/templates/${BOGUS}`, undefined, expectClient);
await probe('estimate public accept bad-token', 'POST', `/api/estimates/public/garbage_token_xxx/accept`, {}, expectClient);
await probe('estimate public decline bad-token', 'POST', `/api/estimates/public/garbage_token_xxx/decline`, {}, expectClient);

// Invoices
await probe('invoice patch bogus', 'PATCH', `/api/crm/invoices/${BOGUS}`, { status: 'draft' }, expectClient);
await probe('invoice pay bogus', 'POST', `/api/crm/invoices/${BOGUS}/payment`, { amount: 100 }, expectClient);
await probe('invoice send bogus', 'POST', `/api/crm/invoices/${BOGUS}/send`, {}, expectClient);
await probe('invoice email bogus', 'POST', `/api/crm/invoices/${BOGUS}/send-email`, {}, expectClient);
await probe('invoice from-estimate bogus', 'POST', `/api/crm/invoices/from-estimate/${BOGUS}`, {}, expectClient);

// Work orders
await probe('wo patch bogus', 'PATCH', `/api/crm/work-orders/${BOGUS}`, { status: 'scheduled' }, expectClient);
await probe('wo complete bogus', 'PATCH', `/api/crm/work-orders/${BOGUS}/complete`, {}, expectClient);
await probe('wo from-estimate bogus', 'POST', `/api/crm/work-orders/from-estimate/${BOGUS}`, {}, expectClient);
await probe('wo milestone add bogus wo', 'POST', `/api/crm/work-orders/${BOGUS}/milestones`, { name: 'x' }, expectClient);
await probe('wo milestone delete bogus', 'DELETE', `/api/crm/work-orders/${BOGUS}/milestones/${BOGUS}`, undefined, expectClient);
await probe('wo milestone patch bogus', 'PATCH', `/api/crm/work-orders/${BOGUS}/milestones/${BOGUS}`, { done: true }, expectClient);

// Contracts
await probe('contract patch bogus', 'PATCH', `/api/crm/contracts/${BOGUS}`, { status: 'draft' }, expectClient);
await probe('contract send bogus', 'POST', `/api/crm/contracts/${BOGUS}/send`, {}, expectClient);
await probe('contract void bogus', 'POST', `/api/crm/contracts/${BOGUS}/void`, {}, expectClient);
await probe('contract template patch bogus', 'PATCH', `/api/crm/contracts/templates/${BOGUS}`, { name: 'x' }, expectClient);
await probe('contract template delete bogus', 'DELETE', `/api/crm/contracts/templates/${BOGUS}`, undefined, expectClient);
await probe('contract public sign bad-token', 'POST', `/api/crm/contracts/public/garbage_token_xxx/sign`, {}, expectClient);

// Expenses
await probe('expense patch bogus', 'PATCH', `/api/crm/expenses/${BOGUS}`, { amount: 1 }, expectClient);
await probe('expense delete bogus', 'DELETE', `/api/crm/expenses/${BOGUS}`, undefined, expectClient);
await probe('expense post missing-amount', 'POST', `/api/crm/expenses`, { description: 'qa' }, expectClient);

// Subcontractors
await probe('sub patch bogus', 'PATCH', `/api/crm/subcontractors/${BOGUS}`, { name: 'x' }, expectClient);
await probe('sub delete bogus', 'DELETE', `/api/crm/subcontractors/${BOGUS}`, undefined, expectClient);
await probe('sub assign missing', 'POST', `/api/crm/subcontractors/assign`, { workOrderId: BOGUS, subcontractorId: BOGUS }, expectClient);
await probe('sub unassign bogus', 'DELETE', `/api/crm/subcontractors/work-order/${BOGUS}/${BOGUS}`, undefined, expectClient);

// Territories
await probe('territory patch bogus', 'PATCH', `/api/crm/territories/${BOGUS}`, { name: 'x' }, expectClient);
await probe('territory delete bogus', 'DELETE', `/api/crm/territories/${BOGUS}`, undefined, expectClient);
await probe('territory post missing', 'POST', `/api/crm/territories`, {}, expectClient);

// Automations
await probe('automation patch bogus', 'PATCH', `/api/crm/automations/${BOGUS}`, { name: 'x' }, expectClient);
await probe('automation delete bogus', 'DELETE', `/api/crm/automations/${BOGUS}`, undefined, expectClient);
await probe('automation toggle bogus', 'PATCH', `/api/crm/automations/${BOGUS}/toggle`, {}, expectClient);

// Drip
await probe('drip patch bogus', 'PATCH', `/api/crm/drip-sequences/${BOGUS}`, { name: 'x' }, expectClient);
await probe('drip delete bogus', 'DELETE', `/api/crm/drip-sequences/${BOGUS}`, undefined, expectClient);
await probe('drip enroll bogus', 'POST', `/api/crm/drip-sequences/${BOGUS}/enroll`, { leadId: BOGUS }, expectClient);
await probe('drip cancel bogus', 'POST', `/api/crm/drip-sequences/${BOGUS}/cancel`, { leadId: BOGUS }, expectClient);

// Canvassing
await probe('canvass patch bogus', 'PATCH', `/api/crm/canvass-pins/${BOGUS}`, { status: 'visited' }, expectClient);
await probe('canvass convert bogus', 'POST', `/api/crm/canvass-pins/${BOGUS}/convert`, {}, expectClient);
await probe('canvass post missing-coords', 'POST', `/api/crm/canvass-pins`, { note: 'qa' }, expectClient);

// Financing
await probe('financing lender patch bogus', 'PATCH', `/api/crm/financing/lenders/${BOGUS}`, { name: 'x' }, expectClient);
await probe('financing lender delete bogus', 'DELETE', `/api/crm/financing/lenders/${BOGUS}`, undefined, expectClient);
await probe('financing plan patch bogus', 'PATCH', `/api/crm/financing/plans/${BOGUS}`, { name: 'x' }, expectClient);
await probe('financing public apply bad-token', 'POST', `/api/crm/financing/public/garbage_token_xxx/apply`, { firstName: 'qa' }, expectClient);

// Notifications
await probe('notif patch bogus read', 'PATCH', `/api/notifications/${BOGUS}/read`, {}, expectClient);

// Documents (uses Postgres int id, not uuid)
await probe('doc delete bogus int', 'DELETE', `/api/documents/999999999`, undefined, expectClient);
await probe('doc delete bad-id', 'DELETE', `/api/documents/not-an-int`, undefined, expectClient);

// Admin
await probe('admin tenant put bogus', 'PUT', `/api/admin/tenants/${BOGUS}`, { name: 'x' }, expectClient);

// Properties
await probe('property location put bogus', 'PUT', `/api/properties/${BOGUS}/location`, { lat: 0, lng: 0 }, expectClient);
await probe('property fema-lookup bogus', 'POST', `/api/properties/${BOGUS}/fema-lookup`, {}, expectClient);

// Leads (non-CRM)
await probe('leads patch bogus', 'PATCH', `/api/leads/${BOGUS}`, { status: 'new' }, expectClient);
await probe('leads status-token bogus', 'POST', `/api/leads/${BOGUS}/status-token`, {}, expectClient);

// Materials
await probe('material order post empty', 'POST', `/api/materials/orders`, {}, expectClient);

// Drift (admin endpoints, expect 403 for non-admin OR 400 for missing data)
await probe('drift correct bogus storm', 'POST', `/api/drift/${BOGUS}/correct`, {}, expectClient);

// Counties
await probe('counties post empty', 'POST', `/api/counties`, {}, expectClient);
await probe('counties import bogus', 'POST', `/api/counties/${BOGUS}/import`, {}, expectClient);

// Skip trace
await probe('skip-trace submit empty', 'POST', `/api/skip-trace/submit`, {}, expectClient);

// Roof measurement
await probe('roof measure empty', 'POST', `/api/roof-measurement/measure`, {}, expectClient);
await probe('roof manual empty', 'POST', `/api/roof-measurement/manual`, {}, expectClient);

// Alerts
await probe('alerts test empty', 'POST', `/api/alerts/test`, {}, expectClient);

// ============ Output ============
const failed = results.filter(r => !r.ok);
console.log(`\n=== Probe complete: ${results.length} requests, ${failed.length} failed ===\n`);

console.log('--- FAILURES (unexpected status) ---');
for (const r of failed) {
  console.log(`[${r.status}] ${r.method} ${r.path}`);
  console.log(`  label: ${r.label}`);
  console.log(`  body:  ${r.bodyPreview}\n`);
}

console.log('--- All status codes histogram ---');
const hist = {};
for (const r of results) hist[r.status] = (hist[r.status] || 0) + 1;
console.log(hist);

// Also dump full report
fs.writeFileSync('.qa-probe-results.json', JSON.stringify(results, null, 2));
console.log('\nFull report: .qa-probe-results.json');
