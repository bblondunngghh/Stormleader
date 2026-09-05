// Run 123-s1: exhaustive READ-ONLY sweep of every GET route in the inventory,
// substituting a REAL id from the waterloo tenant wherever the path takes a param.
// Zero writes. Records status + response shape for each route.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { Authorization: `Bearer ${TOKEN}` };
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

const one = async (sql) => {
  try { const r = await pool.query(sql); return r.rows[0] ? Object.values(r.rows[0])[0] : null; }
  catch (e) { return `ERR:${e.code}`; }
};

const TENANT = await one(`SELECT id FROM tenants WHERE slug='waterloo'`);
const f = {};
f.tenant = TENANT;
f.lead = await one(`SELECT id FROM leads WHERE tenant_id='${TENANT}' LIMIT 1`);
f.estimate = await one(`SELECT id FROM estimates WHERE tenant_id='${TENANT}' LIMIT 1`);
f.invoice = await one(`SELECT id FROM invoices WHERE tenant_id='${TENANT}' LIMIT 1`);
f.contract = await one(`SELECT id FROM contracts WHERE tenant_id='${TENANT}' LIMIT 1`);
f.workOrder = await one(`SELECT id FROM work_orders WHERE tenant_id='${TENANT}' LIMIT 1`);
f.subcontractor = await one(`SELECT id FROM subcontractors WHERE tenant_id='${TENANT}' LIMIT 1`);
f.expenseLead = f.lead;
f.property = await one(`SELECT id FROM properties LIMIT 1`);
f.stormEvent = await one(`SELECT id FROM storm_events LIMIT 1`);
f.dripSeq = await one(`SELECT id FROM drip_sequences WHERE tenant_id='${TENANT}' LIMIT 1`);
f.finApp = await one(`SELECT id FROM financing_applications WHERE tenant_id='${TENANT}' LIMIT 1`);
f.prospectList = await one(`SELECT id FROM prospect_lists WHERE tenant_id='${TENANT}' LIMIT 1`);
f.materialOrder = await one(`SELECT id FROM material_orders WHERE tenant_id='${TENANT}' LIMIT 1`);
f.estToken = await one(`SELECT public_token FROM estimates WHERE tenant_id='${TENANT}' AND public_token IS NOT NULL LIMIT 1`);
f.statusToken = await one(`SELECT token FROM client_status_tokens LIMIT 1`);
f.task = await one(`SELECT id FROM tasks WHERE tenant_id='${TENANT}' LIMIT 1`);
console.log('FIXTURES', JSON.stringify(f, null, 1));

// path -> fixture value (exact inventory path string)
const M = {
  '/api/admin/tenants/:id': f.tenant,
  '/api/counties/:id/status': null,
  '/api/crm/contracts/:id': f.contract,
  '/api/crm/contracts/:id/pdf': f.contract,
  '/api/crm/contracts/public/:token': null,
  '/api/crm/drip-sequences/:id': f.dripSeq,
  '/api/crm/drip-sequences/:id/enrollments': f.dripSeq,
  '/api/crm/expenses/summary/:leadId': f.lead,
  '/api/crm/financing/applications/:id': f.finApp,
  '/api/crm/financing/public/:token/applications': f.estToken,
  '/api/crm/financing/public/:token/plans': f.estToken,
  '/api/crm/invoices/:id': f.invoice,
  '/api/crm/leads/:id': f.lead,
  '/api/crm/leads/:id/activities': f.lead,
  '/api/crm/prospect-lists/:id/items': f.prospectList,
  '/api/crm/subcontractors/:id': f.subcontractor,
  '/api/crm/subcontractors/work-order/:workOrderId': f.workOrder,
  '/api/crm/territories/:id': null,
  '/api/crm/territories/:id/pins': null,
  '/api/crm/work-orders/:id': f.workOrder,
  '/api/crm/work-orders/:id/milestones': f.workOrder,
  '/api/crm/work-orders/:id/pdf': f.workOrder,
  '/api/drift/:stormEventId': f.stormEvent,
  '/api/estimates/:id': f.estimate,
  '/api/estimates/:id/pdf': f.estimate,
  '/api/estimates/public/:token': f.estToken,
  '/api/leads/:id': f.lead,
  '/api/leads/status/public/:token': f.statusToken,
  '/api/materials/orders/:id': f.materialOrder,
  '/api/materials/products/:id': null,
  '/api/properties/:id': f.property,
  '/api/properties/:id/report/pdf': f.property,
  '/api/properties/:id/weather-history': f.property,
  '/api/properties/:id/weather-history/pdf': f.property,
  '/api/properties/in-swath/:stormEventId': f.stormEvent,
  '/api/properties/in-swath/:stormEventId/count': f.stormEvent,
  '/api/roof-measurement/segments/:propertyId': f.property,
  '/api/roof-measurement/solar/:propertyId': f.property,
  '/api/skip-trace/job/:jobId': null,
  '/api/storms/:id': f.stormEvent,
};

// required query params so a route is not tested purely for its 400
const Q = {
  '/api/data/directions': '?origin=42.49,-92.34&destination=42.51,-92.44',
  '/api/data/fema-housing': '?zip=50701',
  '/api/map/properties': '?bbox=-92.5,42.4,-92.2,42.6',
  '/api/map/affected-properties': '?bbox=-92.5,42.4,-92.2,42.6',
  '/api/map/swaths': '?bbox=-92.5,42.4,-92.2,42.6',
  '/api/search': '?q=a',
  '/api/properties/reverse-geocode': '?lat=42.49&lng=-92.34',
  '/api/storm-history': '?lat=42.49&lng=-92.34',
  '/api/storm-history/heatmap': '?bbox=-92.5,42.4,-92.2,42.6',
  '/api/properties/fema-live': '?bbox=-92.5,42.4,-92.2,42.6',
  '/api/disaster-declarations': '?state=IA',
};

const shape = (body, ct) => {
  if (/pdf/.test(ct)) return `pdf(${body.length}B)`;
  try {
    const j = JSON.parse(body);
    if (Array.isArray(j)) return `array[${j.length}] keys=${j[0] ? Object.keys(j[0]).slice(0, 6).join(',') : '-'}`;
    if (j && typeof j === 'object') {
      const ks = Object.keys(j);
      const arrK = ks.find((k) => Array.isArray(j[k]));
      return `obj{${ks.slice(0, 8).join(',')}}` + (arrK ? ` ${arrK}[${j[arrK].length}]` : '');
    }
    return typeof j;
  } catch { return `raw:${body.slice(0, 60).replace(/\s+/g, ' ')}`; }
};

const gets = inv.filter((r) => r.method === 'GET');
const out = [];
for (const r of gets) {
  let p = r.path;
  const hasParam = /:/.test(p);
  if (hasParam) {
    const v = M[p];
    if (!v) { out.push({ ...r, st: 'SKIP', note: 'no fixture (table/column absent)' }); continue; }
    p = p.replace(/:[A-Za-z_]+/, encodeURIComponent(v));
  }
  const url = BASE + p + (Q[r.path] || '');
  let res, body = '', ct = '';
  try {
    res = await fetch(url, { headers: H });
    ct = res.headers.get('content-type') || '';
    body = /pdf|octet/.test(ct) ? await res.arrayBuffer().then((b) => ({ length: b.byteLength, slice: () => '' })) : await res.text();
    if (typeof body !== 'string') body = 'x'.repeat(body.length);
  } catch (e) { out.push({ ...r, st: 'FETCHERR', note: e.message }); continue; }
  out.push({ ...r, st: res.status, ct: ct.split(';')[0], note: shape(body, ct) });
}

const bad = out.filter((o) => typeof o.st === 'number' && o.st >= 500);
const non2 = out.filter((o) => typeof o.st === 'number' && (o.st < 200 || o.st >= 300));
console.log('\n=== 5xx ===');
bad.forEach((o) => console.log(`${o.st} ${o.path} :: ${o.note}`));
console.log('\n=== non-2xx ===');
non2.forEach((o) => console.log(`${o.st} ${o.path} :: ${o.note}`));
console.log('\n=== ALL ===');
out.forEach((o) => console.log(`${String(o.st).padEnd(8)} ${o.path.padEnd(52)} ${o.ct || ''} ${o.note}`));
console.log(`\nTOTAL ${out.length}  2xx ${out.filter((o) => o.st >= 200 && o.st < 300).length}  non2xx ${non2.length}  5xx ${bad.length}  skipped ${out.filter((o) => o.st === 'SKIP').length}`);
fs.writeFileSync('C:/tmp/qa-r123-getsweep.json', JSON.stringify(out, null, 1));
await pool.end();
