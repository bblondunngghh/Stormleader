// Run 79 s1 — resolve REAL ids from list endpoints so the sweep exercises handler logic,
// not just the 404-before-handler path (Run 74 lesson).
import fs from 'node:fs';
const API = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { Authorization: `Bearer ${TOKEN}` };

async function get(path) {
  try {
    const r = await fetch(API + path, { headers: H });
    const txt = await r.text();
    let body; try { body = JSON.parse(txt); } catch { body = txt.slice(0, 200); }
    return { status: r.status, body };
  } catch (e) { return { status: 0, body: String(e.message) }; }
}
function arr(b) {
  if (Array.isArray(b)) return b;
  if (!b || typeof b !== 'object') return [];
  for (const k of ['data', 'items', 'rows', 'results', 'leads', 'estimates', 'invoices',
    'workOrders', 'work_orders', 'contracts', 'expenses', 'subcontractors', 'sequences',
    'automations', 'properties', 'storms', 'counties', 'documents', 'notifications',
    'products', 'orders', 'lenders', 'plans', 'applications', 'tasks', 'team', 'users',
    'pins', 'templates', 'fields', 'lists', 'jobs', 'tenants', 'milestones']) {
    if (Array.isArray(b[k])) return b[k];
  }
  return [];
}

const SOURCES = {
  lead:            '/api/crm/leads?limit=5',
  estimate:        '/api/estimates?limit=5',
  invoice:         '/api/crm/invoices?limit=5',
  workOrder:       '/api/crm/work-orders?limit=5',
  contract:        '/api/crm/contracts?limit=5',
  contractTemplate:'/api/crm/contracts/templates',
  estimateTemplate:'/api/estimates/templates',
  expense:         '/api/crm/expenses?limit=5',
  subcontractor:   '/api/crm/subcontractors',
  dripSequence:    '/api/crm/drip-sequences',
  automation:      '/api/crm/automations',
  customField:     '/api/crm/custom-fields',
  prospectList:    '/api/crm/prospect-lists',
  property:        '/api/properties?limit=5',
  storm:           '/api/storms?limit=5',
  county:          '/api/counties',
  document:        '/api/documents',
  notification:    '/api/notifications',
  materialProduct: '/api/materials/products',
  materialOrder:   '/api/materials/orders',
  lender:          '/api/crm/financing/lenders',
  plan:            '/api/crm/financing/plans',
  application:     '/api/crm/financing/applications',
  task:            '/api/crm/tasks',
  teamUser:        '/api/crm/team',
  canvassPin:      '/api/crm/canvass-pins',
  skipTraceJob:    '/api/skip-trace/jobs',
  tenant:          '/api/admin/tenants',
  territory:       '/api/crm/territories',
  milestoneTpl:    '/api/crm/work-orders/milestone-templates',
};

const out = { ids: {}, meta: {} };
for (const [k, path] of Object.entries(SOURCES)) {
  const r = await get(path);
  const list = arr(r.body);
  const first = list[0] || null;
  out.ids[k] = first ? (first.id || first.user_id || first.uuid || null) : null;
  out.meta[k] = { path, status: r.status, count: list.length,
    sampleKeys: first ? Object.keys(first).slice(0, 14) : (r.status >= 400 ? r.body : null) };
}

// tokens + nested ids
const est = await get('/api/estimates?limit=50');
const estList = arr(est.body);
out.meta.estimateStatuses = [...new Set(estList.map(e => e.status))];
out.ids.estimateWithToken = (estList.find(e => e.public_token || e.token) || {}).id || null;
out.tokens = {};
const tokEst = estList.find(e => e.public_token || e.share_token || e.token);
out.tokens.estimate = tokEst ? (tokEst.public_token || tokEst.share_token || tokEst.token) : null;
out.meta.estimateKeys = estList[0] ? Object.keys(estList[0]) : [];

const con = await get('/api/crm/contracts?limit=50');
const conList = arr(con.body);
const tokCon = conList.find(c => c.public_token || c.token || c.share_token);
out.tokens.contract = tokCon ? (tokCon.public_token || tokCon.token || tokCon.share_token) : null;
out.meta.contractKeys = conList[0] ? Object.keys(conList[0]) : [];
out.meta.contractStatuses = [...new Set(conList.map(c => c.status))];

if (out.ids.workOrder) {
  const ms = await get(`/api/crm/work-orders/${out.ids.workOrder}/milestones`);
  const msList = arr(ms.body);
  out.ids.milestone = msList[0] ? msList[0].id : null;
  out.meta.milestone = { status: ms.status, count: msList.length };
}
if (out.ids.prospectList) {
  const it = await get(`/api/crm/prospect-lists/${out.ids.prospectList}/items`);
  const itList = arr(it.body);
  out.ids.prospectItemProperty = itList[0] ? (itList[0].property_id || itList[0].id) : null;
  out.meta.prospectItems = { status: it.status, count: itList.length };
}
if (out.ids.lead) {
  const c = await get(`/api/crm/leads/${out.ids.lead}`);
  const lead = c.body && (c.body.lead || c.body.data || c.body);
  const contacts = lead && Array.isArray(lead.contacts) ? lead.contacts : [];
  out.ids.leadContact = contacts[0] ? contacts[0].id : null;
  out.meta.leadDetailKeys = lead ? Object.keys(lead).slice(0, 40) : [];
}
// a storm event id for in-swath / drift
const swaths = await get('/api/map/swaths');
const sw = arr(swaths.body);
out.ids.stormEvent = sw[0] ? (sw[0].storm_event_id || sw[0].id) : null;
out.meta.swaths = { status: swaths.status, count: sw.length, keys: sw[0] ? Object.keys(sw[0]).slice(0,12) : [] };

fs.writeFileSync('C:/tmp/qa-r79-ids.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
