// Happy-path probes against a REAL lead. Round-trip create+cleanup where possible.
// Goal: catch 5xx in the create/update paths that negative probes can't reach.
import fs from 'node:fs';

const TOKEN = fs.readFileSync('.qa-token', 'utf8').trim();
const BASE = 'http://localhost:3001';
const LEAD = 'dc8135aa-b210-4f33-bbe1-ad8f0997d3dd';

const results = [];

async function probe(label, method, path, body, expectStatus = [200, 201]) {
  const headers = { 'Authorization': `Bearer ${TOKEN}` };
  let opts = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(BASE + path, opts);
  const text = await r.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  const bad = r.status >= 500 || (Array.isArray(expectStatus) && !expectStatus.includes(r.status));
  results.push({
    label, method, path, status: r.status, bad,
    body: text.length > 250 ? text.slice(0, 250) + '...' : text,
    parsed,
  });
  return parsed;
}

// ============ Happy paths against real lead ============

// 1. Read the lead (should 200)
await probe('GET real lead', 'GET', `/api/crm/leads/${LEAD}`, undefined, [200]);

// 2. PATCH with a valid stage
await probe('PATCH real lead stage', 'PATCH', `/api/crm/leads/${LEAD}`, { stage: 'contacted' }, [200]);
await probe('PATCH real lead priority', 'PATCH', `/api/crm/leads/${LEAD}`, { priority: 'warm' }, [200]);
await probe('PATCH real lead notes', 'PATCH', `/api/crm/leads/${LEAD}`, { notes: 'qa-test ' + Date.now() }, [200]);

// 3. PATCH with bad enum value
await probe('PATCH real lead bad-stage', 'PATCH', `/api/crm/leads/${LEAD}`, { stage: 'nonexistent_stage' }, [400, 422]);
await probe('PATCH real lead bad-priority', 'PATCH', `/api/crm/leads/${LEAD}`, { priority: 'lukewarm' }, [400, 422]);

// 4. PATCH with unknown field — should just ignore (or 400)
await probe('PATCH real lead unknown-field', 'PATCH', `/api/crm/leads/${LEAD}`, { random_garbage_field: 'qa' }, [200, 400]);

// 5. PATCH with null fields (clearing)
await probe('PATCH real lead null assignedTo', 'PATCH', `/api/crm/leads/${LEAD}`, { assigned_to: null }, [200]);

// 6. Create activity on real lead
const act = await probe('POST activity (real lead)', 'POST', '/api/crm/activities',
  { lead_id: LEAD, activity_type: 'note', notes: 'qa-roundtrip ' + Date.now() }, [200, 201]);

// 7. Create contact on real lead
const contact = await probe('POST contact (real lead)', 'POST', `/api/crm/leads/${LEAD}/contacts`,
  { first_name: 'qa-rt', last_name: 'test', phone: '555-0000' }, [200, 201]);

// 8. Delete the contact we created
if (contact?.id) {
  await probe('DELETE contact (cleanup)', 'DELETE', `/api/crm/leads/${LEAD}/contacts/${contact.id}`, undefined, [200, 204]);
}

// 9. Create expense (no lead)
const expense = await probe('POST expense (no lead)', 'POST', '/api/crm/expenses',
  { category: 'materials', amount: 12.34, date: '2026-05-26', description: 'qa-roundtrip' }, [200, 201]);
if (expense?.id) {
  await probe('PATCH expense', 'PATCH', `/api/crm/expenses/${expense.id}`, { description: 'qa-updated' }, [200]);
  await probe('DELETE expense (cleanup)', 'DELETE', `/api/crm/expenses/${expense.id}`, undefined, [200, 204]);
}

// 10. Create + cleanup subcontractor
const sub = await probe('POST subcontractor', 'POST', '/api/crm/subcontractors',
  { name: 'qa-rt-sub ' + Date.now(), trade: 'roofing' }, [200, 201]);
if (sub?.id) {
  await probe('PATCH subcontractor', 'PATCH', `/api/crm/subcontractors/${sub.id}`, { trade: 'gutters' }, [200]);
  await probe('DELETE subcontractor (cleanup)', 'DELETE', `/api/crm/subcontractors/${sub.id}`, undefined, [200, 204]);
}

// 11. Create + cleanup territory
const terr = await probe('POST territory', 'POST', '/api/crm/territories',
  { name: 'qa-rt-terr ' + Date.now(), polygon: { type: 'Polygon', coordinates: [[[-90,40],[-90,41],[-89,41],[-89,40],[-90,40]]] } }, [200, 201]);
if (terr?.id) {
  await probe('PATCH territory', 'PATCH', `/api/crm/territories/${terr.id}`, { name: 'qa-updated' }, [200]);
  await probe('DELETE territory (cleanup)', 'DELETE', `/api/crm/territories/${terr.id}`, undefined, [200, 204]);
}

// 12. Create + cleanup automation
const auto = await probe('POST automation', 'POST', '/api/crm/automations',
  { name: 'qa-rt-auto', trigger_type: 'lead_stage_change', action_type: 'send_email',
    trigger_config: { from_stage: 'new', to_stage: 'contacted' },
    action_config: { template_id: 'welcome' } }, [200, 201]);
if (auto?.id) {
  await probe('PATCH automation toggle', 'PATCH', `/api/crm/automations/${auto.id}/toggle`, {}, [200]);
  await probe('DELETE automation (cleanup)', 'DELETE', `/api/crm/automations/${auto.id}`, undefined, [200, 204]);
}

// 13. Create + cleanup drip sequence
const drip = await probe('POST drip sequence', 'POST', '/api/crm/drip-sequences',
  { name: 'qa-rt-drip ' + Date.now(), trigger_type: 'manual',
    steps: [{ delay_days: 1, channel: 'email', subject: 'hi', body: 'qa', step_order: 1 }] }, [200, 201]);
if (drip?.id) {
  await probe('PATCH drip', 'PATCH', `/api/crm/drip-sequences/${drip.id}`, { name: 'qa-updated' }, [200]);
  await probe('POST drip enroll real lead', 'POST', `/api/crm/drip-sequences/${drip.id}/enroll`, { leadId: LEAD }, [200, 201]);
  await probe('POST drip cancel real lead', 'POST', `/api/crm/drip-sequences/${drip.id}/cancel`, { leadId: LEAD }, [200, 404]);
  await probe('DELETE drip (cleanup)', 'DELETE', `/api/crm/drip-sequences/${drip.id}`, undefined, [200, 204]);
}

// 14. Create + cleanup canvass pin
const pin = await probe('POST canvass pin', 'POST', '/api/crm/canvass-pins',
  { lat: 40.5, lng: -90.5, note: 'qa-rt' }, [200, 201]);
if (pin?.id) {
  await probe('PATCH canvass pin', 'PATCH', `/api/crm/canvass-pins/${pin.id}`, { note: 'qa-updated' }, [200]);
  // Canvassing has no DELETE per route inventory — would leave a row; skip create-cleanup variant
}

// 15. Create + cleanup notification (read state)
const notifs = await probe('GET notifs', 'GET', '/api/notifications', undefined, [200]);
if (Array.isArray(notifs?.notifications) && notifs.notifications.length > 0) {
  await probe('PATCH notif mark read', 'PATCH', `/api/notifications/${notifs.notifications[0].id}/read`, {}, [200, 204]);
}

// 16. Estimates — create + cleanup
const est = await probe('POST estimate', 'POST', '/api/estimates',
  { lead_id: LEAD, line_items: [{ description: 'qa', quantity: 1, unit_price: 100 }] }, [200, 201]);
if (est?.id) {
  await probe('PATCH estimate', 'PATCH', `/api/estimates/${est.id}`, { status: 'draft' }, [200]);
  await probe('POST estimate duplicate', 'POST', `/api/estimates/${est.id}/duplicate`, {}, [200, 201]);
  await probe('DELETE estimate (cleanup)', 'DELETE', `/api/estimates/${est.id}`, undefined, [200, 204]);
}

// 17. Create + cleanup contract
const contract = await probe('POST contract', 'POST', '/api/crm/contracts',
  { lead_id: LEAD, title: 'qa-rt-contract', body: 'qa' }, [200, 201]);
if (contract?.id) {
  await probe('PATCH contract', 'PATCH', `/api/crm/contracts/${contract.id}`, { title: 'qa-updated' }, [200]);
  // No DELETE in route inventory
}

// 18. Create + cleanup task
const task = await probe('POST task', 'POST', '/api/crm/tasks',
  { lead_id: LEAD, title: 'qa-rt-task ' + Date.now(), priority: 'warm' }, [200, 201]);
if (task?.id) {
  await probe('PATCH task complete', 'PATCH', `/api/crm/tasks/${task.id}`, { status: 'completed' }, [200]);
  // No DELETE
}

// === Done ===
const bad = results.filter(r => r.bad);
console.log(`\n=== ${results.length} probes, ${bad.length} unexpected results ===\n`);
for (const r of bad) {
  console.log(`[${r.status}] ${r.method} ${r.path}`);
  console.log(`  label: ${r.label}`);
  console.log(`  body:  ${r.body}\n`);
}

const hist = {};
for (const r of results) hist[r.status] = (hist[r.status] || 0) + 1;
console.log('--- Status histogram ---');
console.log(hist);

fs.writeFileSync('.qa-probe3-results.json', JSON.stringify(results, null, 2));
