import fs from 'fs';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const IDS = JSON.parse(fs.readFileSync('C:/tmp/qa-r82-ids.json','utf8'));
const INV = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json','utf8'));
const BASE = 'http://localhost:3001';
const DEAD = '00000000-0000-4000-8000-000000000000';

// param-name -> real id
const P = {
  id: null, leadId: IDS.lead, estimateId: IDS.estimate, invoiceId: IDS.invoice,
  contractId: IDS.contract, workOrderId: IDS.workOrder, taskId: IDS.task,
  propertyId: IDS.property, stormId: IDS.stormEvent, eventId: IDS.stormEvent,
  userId: IDS.user, tenantId: IDS.tenantId, sequenceId: DEAD, stepId: DEAD,
  pinId: IDS.canvassPin, orderId: IDS.materialOrder, token: IDS.estimateToken,
  documentId: DEAD, ruleId: DEAD, applicationId: DEAD, planId: DEAD, lenderId: DEAD,
  subcontractorId: IDS.subcontractor, expenseId: IDS.expense, milestoneId: DEAD,
  activityId: IDS.activity, contactId: IDS.contact, fieldId: IDS.customField,
  templateId: DEAD, memberId: IDS.user, noteId: DEAD, alertId: DEAD, listId: DEAD,
};
// :id by route family
function idFor(path) {
  const p = path;
  if (p.startsWith('/api/crm/leads')) return IDS.lead;
  if (p.startsWith('/api/leads')) return IDS.lead;
  if (p.startsWith('/api/estimates')) return IDS.estimate;
  if (p.startsWith('/api/crm/invoices')) return IDS.invoice;
  if (p.startsWith('/api/crm/contracts')) return IDS.contract;
  if (p.startsWith('/api/crm/work-orders')) return IDS.workOrder;
  if (p.startsWith('/api/crm/tasks')) return IDS.task;
  if (p.startsWith('/api/crm/expenses')) return IDS.expense;
  if (p.startsWith('/api/crm/subcontractors')) return IDS.subcontractor;
  if (p.startsWith('/api/crm/canvass-pins')) return IDS.canvassPin;
  if (p.startsWith('/api/crm/activities')) return IDS.activity;
  if (p.startsWith('/api/crm/contacts')) return IDS.contact;
  if (p.startsWith('/api/crm/custom-fields')) return IDS.customField;
  if (p.startsWith('/api/crm/team')) return IDS.user;
  if (p.startsWith('/api/properties')) return IDS.property;
  if (p.startsWith('/api/storms')) return IDS.stormEvent;
  if (p.startsWith('/api/materials')) return IDS.materialOrder;
  if (p.startsWith('/api/admin/tenants')) return IDS.tenantId;
  return DEAD;
}
// query defaults for routes that require params
const QUERY = {
  '/api/data/fema-housing': 'zip=75001',
  '/api/data/census-demographics': 'zip=75001',
  '/api/map/storm-swaths': 'bbox=-97.5,32.5,-96.5,33.5',
  '/api/map/properties': 'bbox=-97.5,32.5,-96.5,33.5',
  '/api/search': 'q=roof',
  '/api/storm-history': 'lat=32.9&lon=-96.9',
};
const SKIP = [/import/i, /skip-trace/i, /geocode/i, /\/export/i];

const results = [];
let done = 0;
for (const r of INV) {
  if (r.method !== 'GET') continue;
  if (SKIP.some(rx => rx.test(r.path))) { results.push({...r, status:'SKIP', note:'charter-prohibited'}); continue; }
  let url = r.path;
  const usedIds = [];
  url = url.replace(/:([A-Za-z0-9_]+)\??/g, (m, name) => {
    const v = name === 'id' ? idFor(r.path) : (P[name] !== undefined && P[name] !== null ? P[name] : DEAD);
    usedIds.push(`${name}=${v===DEAD?'DEAD':'real'}`);
    return v;
  });
  const qs = Object.entries(QUERY).find(([k]) => r.path === k || r.path.startsWith(k+'/'));
  if (qs) url += '?' + qs[1];
  try {
    const t0 = Date.now();
    const res = await fetch(BASE + url, { headers: { Authorization: 'Bearer ' + TOKEN } });
    const ms = Date.now() - t0;
    const ct = res.headers.get('content-type') || '';
    let body = '';
    if (ct.includes('json')) { const j = await res.json().catch(()=>null); body = JSON.stringify(j); }
    else body = (await res.text().catch(()=>'')).slice(0, 200);
    results.push({ ...r, url, status: res.status, ms, ids: usedIds.join(','), ct: ct.split(';')[0], len: body.length, snip: body.slice(0, 260) });
  } catch (e) {
    results.push({ ...r, url, status: 'FETCH_ERR', snip: e.message });
  }
  done++;
}
fs.writeFileSync('C:/tmp/qa-r82-get-results.json', JSON.stringify(results, null, 1));
const by = {};
for (const r of results) by[r.status] = (by[r.status]||0)+1;
console.log('GET swept:', done, 'status counts:', JSON.stringify(by));
console.log('\n=== NON-2xx ===');
for (const r of results.filter(r => typeof r.status === 'number' ? r.status >= 300 : r.status !== 'SKIP'))
  console.log(`${String(r.status).padEnd(6)} ${r.path.padEnd(52)} [${r.ids}] ${String(r.snip).slice(0,150)}`);
