// Run 76 s1 — full GET sweep with REAL ids.
// STRUCTURALLY UNABLE TO FIND: write-path bugs, tenant-isolation holes, and any
// handler branch that only runs for a row shape not present in this tenant's data.
import fs from 'fs';
import { req, summarize } from './.qa-r76-lib.mjs';

const ids = JSON.parse(fs.readFileSync('C:/tmp/qa-r76-ids.json', 'utf8'));

// property id: the viewport GeoJSON came back empty, so take it off a lead row.
if (!ids.property) {
  const L = await req('GET', '/api/crm/leads?limit=50');
  const leads = Array.isArray(L.body) ? L.body : (L.body?.leads ?? []);
  const withProp = leads.find((l) => l.property_id);
  if (withProp) ids.property = withProp.property_id;
  console.log('property id from lead.property_id ->', ids.property);
  fs.writeFileSync('C:/tmp/qa-r76-ids.json', JSON.stringify(ids, null, 1));
}

const routes = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

// Required/­sensible query strings so a route is not judged on a missing-param 400.
const QS = {
  '/api/properties': 'bbox=-96,40,-90,44&limit=10',
  '/api/map/properties': 'bbox=-96,40,-90,44&limit=10',
  '/api/map/affected-properties': 'bbox=-96,40,-90,44&limit=10',
  '/api/map/swaths': 'bbox=-96,40,-90,44',
  '/api/search': 'q=roof',
  '/api/data/fema-housing': 'zip=50701',
  '/api/data/directions': 'origin=42.49,-92.34&destination=42.51,-92.44',
  '/api/storm-history': 'lat=42.49&lng=-92.34',
  '/api/storm-history/heatmap': 'bbox=-96,40,-90,44',
  '/api/disaster-declarations': 'state=IA',
  '/api/counties': 'state=IA',
  '/api/crm/expenses': 'limit=10',
  '/api/roof-measurement/solar/:propertyId': '',
};

const paramMap = {
  '/api/admin/tenants/:id': { id: null }, // platform-admin only; leave unresolved
  '/api/crm/contracts/:id': { id: ids.contract },
  '/api/crm/contracts/:id/pdf': { id: ids.contract },
  '/api/crm/contracts/public/:token': { token: ids.contractToken },
  '/api/crm/contracts/templates/:id': { id: ids.contractTemplate },
  '/api/crm/drip-sequences/:id': { id: ids.drip },
  '/api/crm/drip-sequences/:id/enrollments': { id: ids.drip },
  '/api/crm/expenses/summary/:leadId': { leadId: ids.lead },
  '/api/crm/financing/applications/:id': { id: ids.finApplication },
  '/api/crm/financing/public/:token/applications': { token: ids.estimateToken },
  '/api/crm/financing/public/:token/plans': { token: ids.estimateToken },
  '/api/crm/invoices/:id': { id: ids.invoice },
  '/api/crm/leads/:id': { id: ids.lead },
  '/api/crm/leads/:id/activities': { id: ids.lead },
  '/api/crm/prospect-lists/:id/items': { id: ids.prospectList },
  '/api/crm/subcontractors/:id': { id: ids.subcontractor },
  '/api/crm/subcontractors/work-order/:workOrderId': { workOrderId: ids.workOrder },
  '/api/crm/territories/:id': { id: ids.territory },
  '/api/crm/territories/:id/pins': { id: ids.territory },
  '/api/crm/work-orders/:id': { id: ids.workOrder },
  '/api/crm/work-orders/:id/milestones': { id: ids.workOrder },
  '/api/crm/work-orders/:id/pdf': { id: ids.workOrder },
  '/api/drift/:stormEventId': { stormEventId: ids.stormEventId },
  '/api/estimates/:id': { id: ids.estimate },
  '/api/estimates/:id/pdf': { id: ids.estimate },
  '/api/estimates/public/:token': { token: ids.estimateToken },
  '/api/estimates/templates/:id': { id: ids.estTemplate },
  '/api/leads/:id': { id: ids.lead },
  '/api/leads/status/public/:token': { token: null },
  '/api/materials/orders/:id': { id: ids.matOrder },
  '/api/materials/products/:id': { id: ids.matProduct },
  '/api/properties/:id': { id: ids.property },
  '/api/properties/:id/report/pdf': { id: ids.property },
  '/api/properties/:id/weather-history': { id: ids.property },
  '/api/properties/:id/weather-history/pdf': { id: ids.property },
  '/api/properties/in-swath/:stormEventId': { stormEventId: ids.stormEventId },
  '/api/properties/in-swath/:stormEventId/count': { stormEventId: ids.stormEventId },
  '/api/roof-measurement/segments/:propertyId': { propertyId: ids.property },
  '/api/roof-measurement/solar/:propertyId': { propertyId: ids.property },
  '/api/skip-trace/job/:jobId': { jobId: ids.skipJob },
  '/api/storms/:id': { id: ids.storm },
  '/api/counties/:id/status': { id: null },
};

const gets = routes.filter((r) => r.method === 'GET');
const results = [];
let skipped = 0;

for (const r of gets) {
  let path = r.path;
  if (path.includes(':')) {
    const m = paramMap[r.path];
    if (!m) { results.push({ ...r, status: 'NO_MAP', note: 'no param mapping' }); skipped++; continue; }
    let unresolved = false;
    for (const [k, v] of Object.entries(m)) {
      if (!v) { unresolved = true; break; }
      path = path.replace(':' + k, encodeURIComponent(v));
    }
    if (unresolved) { results.push({ ...r, status: 'NO_ID', note: 'no real id available' }); skipped++; continue; }
  }
  const qs = QS[r.path];
  const url = qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path;
  const res = await req('GET', url);
  results.push({ ...r, url, status: res.status, ms: res.ms, summary: summarize(res.body) });
}

fs.writeFileSync('C:/tmp/qa-r76-getsweep.json', JSON.stringify(results, null, 1));

const byStatus = {};
for (const x of results) byStatus[x.status] = (byStatus[x.status] || 0) + 1;
console.log('GET routes:', gets.length, '| exercised:', gets.length - skipped, '| skipped:', skipped);
console.log('status tally:', JSON.stringify(byStatus));
console.log('\n=== NON-2xx (excluding skips) ===');
for (const x of results) {
  if (typeof x.status === 'number' && (x.status < 200 || x.status >= 300)) {
    console.log(String(x.status).padEnd(5), x.url.padEnd(70), String(x.summary).slice(0, 90));
  }
}
console.log('\n=== 5xx / FETCH ERRORS ===');
const bad = results.filter((x) => x.status === 0 || (typeof x.status === 'number' && x.status >= 500));
console.log(bad.length ? bad.map((x) => `${x.status} ${x.url}\n     ${JSON.stringify(x.summary)}`).join('\n') : 'none');
console.log('\n=== SKIPPED ===');
results.filter((x) => typeof x.status === 'string').forEach((x) => console.log(x.status, x.path));
