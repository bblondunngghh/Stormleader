// Run 79 s1 — GET sweep over the full route inventory using REAL ids.
// Structural limits: this pass proves handlers execute on the rows that exist TODAY.
// It cannot find (a) crashes that need a specific stored shape absent from this tenant,
// (b) write-path bugs, (c) bugs on empty tables (drip_sequences/automations/documents = 0 rows).
import fs from 'node:fs';
const API = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const IDS = JSON.parse(fs.readFileSync('C:/tmp/qa-r79-ids.json', 'utf8')).ids;
const routes = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const DEAD = '00000000-0000-0000-0000-000000000000';

// param -> id, resolved by (param name, path context)
function idFor(param, path) {
  const p = path;
  switch (param) {
    case 'leadId': return IDS.lead;
    case 'estimateId': return IDS.estimate;
    case 'propertyId': return p.includes('prospect-lists') ? IDS.prospectItemProperty : IDS.property;
    case 'workOrderId': case 'woId': return IDS.workOrder;
    case 'milestoneId': return IDS.milestone;
    case 'subcontractorId': return IDS.subcontractor;
    case 'contactId': return IDS.leadContact;
    case 'jobId': return IDS.skipTraceJob;
    case 'stormEventId': return IDS.stormEvent;
    case 'userId': return IDS.teamUser;
    case 'token': return null; // handled per-route
    case 'id':
      if (p.startsWith('/api/admin/tenants')) return IDS.tenant;
      if (p.startsWith('/api/crm/automations')) return IDS.automation;
      if (p.startsWith('/api/crm/contracts/templates')) return IDS.contractTemplate;
      if (p.startsWith('/api/crm/contracts')) return IDS.contract;
      if (p.startsWith('/api/crm/custom-fields')) return IDS.customField;
      if (p.startsWith('/api/crm/drip-sequences')) return IDS.dripSequence;
      if (p.startsWith('/api/crm/expenses')) return IDS.expense;
      if (p.startsWith('/api/crm/financing/lenders')) return IDS.lender;
      if (p.startsWith('/api/crm/financing/plans')) return IDS.plan;
      if (p.startsWith('/api/crm/financing/applications')) return IDS.application;
      if (p.startsWith('/api/crm/invoices')) return IDS.invoice;
      if (p.startsWith('/api/crm/leads')) return IDS.lead;
      if (p.startsWith('/api/crm/prospect-lists')) return IDS.prospectList;
      if (p.startsWith('/api/crm/subcontractors')) return IDS.subcontractor;
      if (p.startsWith('/api/crm/tasks')) return IDS.task;
      if (p.startsWith('/api/crm/territories')) return IDS.territory;
      if (p.startsWith('/api/crm/work-orders')) return IDS.workOrder;
      if (p.startsWith('/api/crm/canvass-pins')) return IDS.canvassPin;
      if (p.startsWith('/api/counties')) return IDS.county;
      if (p.startsWith('/api/documents')) return IDS.document;
      if (p.startsWith('/api/estimates/templates')) return IDS.estimateTemplate;
      if (p.startsWith('/api/estimates')) return IDS.estimate;
      if (p.startsWith('/api/leads')) return IDS.lead;
      if (p.startsWith('/api/materials/orders')) return IDS.materialOrder;
      if (p.startsWith('/api/materials/products')) return IDS.materialProduct;
      if (p.startsWith('/api/notifications')) return IDS.notification;
      if (p.startsWith('/api/properties')) return IDS.property;
      if (p.startsWith('/api/storms')) return IDS.storm;
      return null;
    default: return null;
  }
}

// query strings that make the handler actually run (pass B)
const BBOX = 'bbox=-97.9,32.0,-96.2,33.4';
const QUERY = {
  '/api/properties': BBOX + '&limit=5',
  '/api/properties/fema-live': BBOX + '&limit=5',
  '/api/properties/reverse-geocode': 'lat=32.75&lng=-97.33',
  '/api/map/properties': BBOX,
  '/api/map/swaths': BBOX + '&timeRange=365',
  '/api/map/affected-properties': BBOX + '&timeRange=365',
  '/api/data/fema-housing': 'zip=77657',
  '/api/data/directions': 'fromLat=30.19&fromLng=-94.16&toLat=30.20&toLng=-94.15',
  '/api/search': 'q=roof',
  '/api/storms': 'limit=5',
  '/api/storm-history': 'lat=32.75&lng=-97.33&radius=25',
  '/api/storm-history/heatmap': BBOX + '&years=3',
  '/api/disaster-declarations': 'state=TX&limit=5',
  '/api/crm/calendar': 'start=2026-08-01&end=2026-08-31',
  '/api/crm/reports/revenue': 'period=90',
  '/api/crm/reports/conversion': 'period=90',
  '/api/crm/reports/pipeline': 'period=90',
  '/api/crm/reports/lead-sources': 'period=90',
  '/api/crm/reports/rep-performance': 'period=90',
  '/api/crm/reports/stage-duration': 'period=90',
  '/api/properties/in-swath/:stormEventId': 'limit=5',
  '/api/materials/products': 'limit=5',
  '/api/materials/branches': 'zip=76102',
  '/api/crm/dashboard/properties-affected/list': 'limit=5',
};
// paid / destructive / bulk — never call
const SKIP = [/trigger-import/i, /\/import/i, /roof-measurement\/measure/];

const results = [];
async function hit(method, url, label) {
  const t0 = Date.now();
  try {
    const r = await fetch(API + url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const ct = r.headers.get('content-type') || '';
    let body = '';
    if (ct.includes('json')) { const t = await r.text(); body = t.slice(0, 400); }
    else { const b = await r.arrayBuffer(); body = `<${ct} ${b.byteLength}b>`; }
    return { label, url, status: r.status, ms: Date.now() - t0, ct: ct.split(';')[0], body };
  } catch (e) {
    return { label, url, status: 0, ms: Date.now() - t0, ct: '', body: 'FETCH-ERR ' + e.message };
  }
}

const gets = routes.filter(r => r.method === 'GET');
for (const r of gets) {
  if (SKIP.some(rx => rx.test(r.path))) { results.push({ label: r.path, url: r.path, status: -1, body: 'SKIPPED (paid/bulk)', ms: 0 }); continue; }
  let url = r.path;
  let missing = null;
  const params = [...r.path.matchAll(/:([A-Za-z]+)/g)].map(m => m[1]);
  for (const p of params) {
    const v = idFor(p, r.path);
    if (v) url = url.replace(':' + p, encodeURIComponent(v));
    else { missing = p; url = url.replace(':' + p, p === 'token' ? 'qa-nonexistent-token' : DEAD); }
  }
  const q = QUERY[r.path];
  const res = await hit('GET', url + (q ? (url.includes('?') ? '&' : '?') + q : ''), r.path);
  res.realId = params.length ? (missing ? `NO-REAL-${missing}` : 'real') : 'n/a';
  res.file = r.file;
  results.push(res);
}
fs.writeFileSync('C:/tmp/qa-r79-get.json', JSON.stringify(results, null, 1));
const by = {};
for (const r of results) by[r.status] = (by[r.status] || 0) + 1;
console.log('GET routes swept:', gets.length, JSON.stringify(by));
console.log('\n--- 5xx / fetch errors ---');
for (const r of results.filter(x => x.status >= 500 || x.status === 0)) console.log(r.status, r.label, '|', r.body.slice(0, 200));
console.log('\n--- 4xx ---');
for (const r of results.filter(x => x.status >= 400 && x.status < 500)) console.log(r.status, r.label, '[' + r.realId + ']', r.body.slice(0, 120));
