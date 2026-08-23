import fs from 'fs';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const IDS = JSON.parse(fs.readFileSync('C:/tmp/qa-r85-ids.json','utf8'));
const INV = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json','utf8'));
const BASE = 'http://localhost:3001';
const DEAD = '00000000-0000-4000-8000-000000000000';
const R = k => IDS[k] || DEAD;

const P = {
  leadId: R('lead'), estimateId: R('estimate'), invoiceId: R('invoice'),
  contractId: R('contract'), workOrderId: R('workOrder'), taskId: R('task'),
  propertyId: R('property'), stormId: R('stormEvent'), eventId: R('stormEvent'),
  userId: R('user'), tenantId: IDS.tenantId, sequenceId: R('dripSequence'),
  stepId: R('dripStep'), pinId: R('canvassPin'), orderId: R('materialOrder'),
  token: R('estimateToken'), documentId: R('document'), ruleId: R('automation'),
  applicationId: R('financingApp'), planId: R('financingPlan'), lenderId: R('financingLender'),
  subcontractorId: R('subcontractor'), expenseId: R('expense'), milestoneId: DEAD,
  activityId: R('activity'), contactId: R('contact'), fieldId: R('customField'),
  templateId: R('contractTemplate'), memberId: R('user'), noteId: DEAD,
  alertId: R('alertConfig'), listId: R('prospectList'), territoryId: R('territory'),
};
function idFor(p) {
  const m = [
    ['/api/crm/leads', 'lead'], ['/api/leads', 'lead'], ['/api/estimates', 'estimate'],
    ['/api/crm/estimates', 'estimate'], ['/api/crm/invoices', 'invoice'],
    ['/api/crm/contracts/templates', 'contractTemplate'], ['/api/crm/contracts', 'contract'],
    ['/api/crm/work-orders', 'workOrder'], ['/api/crm/tasks', 'task'],
    ['/api/crm/expenses', 'expense'], ['/api/crm/subcontractors', 'subcontractor'],
    ['/api/crm/canvass-pins', 'canvassPin'], ['/api/crm/territories', 'territory'],
    ['/api/crm/activities', 'activity'], ['/api/crm/contacts', 'contact'],
    ['/api/crm/custom-fields', 'customField'], ['/api/crm/team', 'user'],
    ['/api/crm/financing/plans', 'financingPlan'], ['/api/crm/financing/lenders', 'financingLender'],
    ['/api/crm/financing/applications', 'financingApp'], ['/api/crm/drip', 'dripSequence'],
    ['/api/crm/automations', 'automation'], ['/api/crm/prospect-lists', 'prospectList'],
    ['/api/properties', 'property'], ['/api/storms', 'stormEvent'],
    ['/api/materials', 'materialOrder'], ['/api/admin/tenants', 'tenantId'],
    ['/api/alerts', 'alertConfig'], ['/api/documents', 'document'],
  ].sort((a,b) => b[0].length - a[0].length);   // longest prefix wins
  for (const [pre, key] of m) if (p.startsWith(pre)) return key === 'tenantId' ? IDS.tenantId : R(key);
  return DEAD;
}
const QUERY = {
  '/api/data/fema-housing': 'zip=75001', '/api/data/census-demographics': 'zip=75001',
  '/api/map/storm-swaths': 'bbox=-97.5,32.5,-96.5,33.5', '/api/map/properties': 'bbox=-97.5,32.5,-96.5,33.5',
  '/api/search': 'q=roof', '/api/storm-history': 'lat=32.9&lon=-96.9',
};
// charter: no billed vendor APIs, no bulk writes. 'trigger-import' is hyphenated - /import/i not /\/import/
const SKIP = [/import/i, /skip-trace/i, /geocode/i, /\/export/i, /generate-leads/i,
              /roof-measurement/i, /fema-live-polygon/i, /counties\/.*\/import/i];

const results = [];
for (const r of INV) {
  if (r.method !== 'GET') continue;
  if (SKIP.some(rx => rx.test(r.path))) { results.push({ ...r, status: 'SKIP', note: 'charter-prohibited' }); continue; }
  const usedIds = [];
  let url = r.path.replace(/:([A-Za-z0-9_]+)\??/g, (m, name) => {
    const v = name === 'id' ? idFor(r.path) : (P[name] || DEAD);
    usedIds.push(`${name}=${v === DEAD ? 'DEAD' : 'real'}`);
    return v;
  });
  const qs = Object.entries(QUERY).find(([k]) => r.path === k || r.path.startsWith(k + '/'));
  if (qs) url += '?' + qs[1];
  try {
    const t0 = Date.now();
    const res = await fetch(BASE + url, { headers: { Authorization: 'Bearer ' + TOKEN } });
    const ms = Date.now() - t0;
    const ct = res.headers.get('content-type') || '';
    let body = ct.includes('json')
      ? JSON.stringify(await res.json().catch(() => null))
      : (await res.text().catch(() => '')).slice(0, 200);
    results.push({ ...r, url, status: res.status, ms, ids: usedIds.join(','), ct: ct.split(';')[0], len: body.length, snip: body.slice(0, 300) });
  } catch (e) { results.push({ ...r, url, status: 'FETCH_ERR', snip: e.message }); }
}
fs.writeFileSync('C:/tmp/qa-r85-get-results.json', JSON.stringify(results, null, 1));
const by = {};
for (const r of results) by[r.status] = (by[r.status] || 0) + 1;
console.log('GET swept:', results.filter(r => r.status !== 'SKIP').length, '| status:', JSON.stringify(by));
const realIdCount = results.filter(r => r.ids && r.ids.includes('real')).length;
console.log('routes given at least one REAL id:', realIdCount);
console.log('\n=== NON-2xx (excluding SKIP) ===');
for (const r of results.filter(r => typeof r.status === 'number' && r.status >= 300))
  console.log(`${String(r.status).padEnd(5)} ${r.path.padEnd(50)} [${r.ids}] ${String(r.snip).slice(0,120)}`);
