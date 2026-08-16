// Run 76 s1 — resolve REAL ids from live list endpoints (black-box; no DB dependency).
// Lesson from Run 74: a dead-uuid sweep 404s BEFORE handler logic and is structurally
// incapable of finding stored-shape crashes. Every param route must get a real id.
import fs from 'fs';
import { req, mint, summarize } from './.qa-r76-lib.mjs';

await mint();
console.log('token minted OK');

const ids = {};
const notes = [];

async function firstFrom(path, pick = (r) => r.id, key) {
  const r = await req('GET', path);
  if (r.status !== 200) { notes.push(`${key}: list ${path} -> ${r.status}`); return null; }
  let rows = r.body;
  if (!Array.isArray(rows)) {
    for (const k of ['data', 'rows', 'items', 'results', 'leads', 'estimates', 'invoices',
      'contracts', 'workOrders', 'work_orders', 'properties', 'expenses', 'tasks',
      'subcontractors', 'templates', 'sequences', 'applications', 'lenders', 'plans',
      'orders', 'products', 'notifications', 'pins', 'territories', 'automations',
      'customFields', 'custom_fields', 'prospectLists', 'lists', 'team', 'users',
      'storms', 'documents', 'jobs', 'milestones']) {
      if (Array.isArray(rows?.[k])) { rows = rows[k]; break; }
    }
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    notes.push(`${key}: list ${path} -> 200 but no array rows (${summarize(r.body)})`);
    return null;
  }
  for (const row of rows) {
    const v = pick(row);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  notes.push(`${key}: rows present but pick() found nothing (keys: ${Object.keys(rows[0]).slice(0, 12)})`);
  return null;
}

ids.lead = await firstFrom('/api/crm/leads?limit=50', (r) => r.id, 'lead');
ids.estimate = await firstFrom('/api/estimates?limit=50', (r) => r.id, 'estimate');
ids.invoice = await firstFrom('/api/crm/invoices?limit=50', (r) => r.id, 'invoice');
ids.contract = await firstFrom('/api/crm/contracts?limit=50', (r) => r.id, 'contract');
ids.workOrder = await firstFrom('/api/crm/work-orders?limit=50', (r) => r.id, 'workOrder');
ids.property = await firstFrom('/api/properties?limit=50', (r) => r.id, 'property');
ids.expense = await firstFrom('/api/crm/expenses?limit=50', (r) => r.id, 'expense');
ids.task = await firstFrom('/api/crm/tasks?limit=50', (r) => r.id, 'task');
ids.subcontractor = await firstFrom('/api/crm/subcontractors', (r) => r.id, 'subcontractor');
ids.estTemplate = await firstFrom('/api/estimates/templates', (r) => r.id, 'estTemplate');
ids.contractTemplate = await firstFrom('/api/crm/contracts/templates', (r) => r.id, 'contractTemplate');
ids.drip = await firstFrom('/api/crm/drip-sequences', (r) => r.id, 'drip');
ids.finApplication = await firstFrom('/api/crm/financing/applications', (r) => r.id, 'finApplication');
ids.finLender = await firstFrom('/api/crm/financing/lenders', (r) => r.id, 'finLender');
ids.finPlan = await firstFrom('/api/crm/financing/plans', (r) => r.id, 'finPlan');
ids.matOrder = await firstFrom('/api/materials/orders', (r) => r.id, 'matOrder');
ids.matProduct = await firstFrom('/api/materials/products?limit=20', (r) => r.id, 'matProduct');
ids.notification = await firstFrom('/api/notifications', (r) => r.id, 'notification');
ids.canvassPin = await firstFrom('/api/crm/canvass-pins', (r) => r.id, 'canvassPin');
ids.automation = await firstFrom('/api/crm/automations', (r) => r.id, 'automation');
ids.customField = await firstFrom('/api/crm/custom-fields', (r) => r.id, 'customField');
ids.prospectList = await firstFrom('/api/crm/prospect-lists', (r) => r.id, 'prospectList');
ids.document = await firstFrom('/api/documents', (r) => r.id, 'document');
ids.storm = await firstFrom('/api/storms?limit=20', (r) => r.id ?? r.event_id ?? r.storm_event_id, 'storm');
ids.stormEventId = await firstFrom('/api/storms?limit=20', (r) => r.event_id ?? r.storm_event_id ?? r.id, 'stormEventId');
ids.user = await firstFrom('/api/crm/team', (r) => r.id ?? r.user_id, 'user');
ids.skipJob = await firstFrom('/api/skip-trace/jobs', (r) => r.id ?? r.job_id, 'skipJob');
ids.territory = await firstFrom('/api/crm/territories', (r) => r.id, 'territory');

// nested: milestone under a work order
if (ids.workOrder) {
  const m = await req('GET', `/api/crm/work-orders/${ids.workOrder}/milestones`);
  const arr = Array.isArray(m.body) ? m.body : m.body?.milestones;
  if (Array.isArray(arr) && arr.length) ids.milestone = arr[0].id;
  else notes.push(`milestone: ${m.status} ${summarize(m.body)}`);
}
// nested: contact under a lead
if (ids.lead) {
  const l = await req('GET', `/api/crm/leads/${ids.lead}`);
  const c = l.body?.contacts ?? l.body?.lead?.contacts;
  if (Array.isArray(c) && c.length) ids.contact = c[0].id;
  else notes.push(`contact: lead ${ids.lead} has no contacts array (${summarize(l.body)})`);
}
// prospect-list item propertyId
if (ids.prospectList) {
  const p = await req('GET', `/api/crm/prospect-lists/${ids.prospectList}/items`);
  const arr = Array.isArray(p.body) ? p.body : p.body?.items;
  if (Array.isArray(arr) && arr.length) ids.listPropertyId = arr[0].property_id ?? arr[0].id;
}
// public share tokens — read straight off the detail records
if (ids.estimate) {
  const e = await req('GET', `/api/estimates/${ids.estimate}`);
  ids.estimateToken = e.body?.share_token ?? e.body?.public_token ?? e.body?.token ?? e.body?.estimate?.share_token ?? null;
  if (!ids.estimateToken) notes.push(`estimateToken: not on detail (keys ${Object.keys(e.body || {}).slice(0, 20)})`);
}
if (ids.contract) {
  const c = await req('GET', `/api/crm/contracts/${ids.contract}`);
  ids.contractToken = c.body?.share_token ?? c.body?.public_token ?? c.body?.token ?? c.body?.contract?.share_token ?? null;
  if (!ids.contractToken) notes.push(`contractToken: not on detail (keys ${Object.keys(c.body || {}).slice(0, 20)})`);
}

fs.writeFileSync('C:/tmp/qa-r76-ids.json', JSON.stringify(ids, null, 1));
console.log('\n=== RESOLVED IDS ===');
for (const [k, v] of Object.entries(ids)) console.log(`${(v ? 'OK  ' : 'MISS')} ${k.padEnd(18)} ${v ?? ''}`);
console.log('\nresolved:', Object.values(ids).filter(Boolean).length, 'of', Object.keys(ids).length);
console.log('\n=== NOTES ===');
notes.forEach((n) => console.log(' -', n));
