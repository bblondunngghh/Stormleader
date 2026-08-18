// Run 78 s1 — QUERY PARAM TYPE-CONFUSION SWEEP (new class this run).
// Express's qs parser turns ?p=a&p=b into an ARRAY and ?p[k]=v into an OBJECT.
// Every handler that calls a string method on a query param without coercing it throws -> 500.
//
// WHAT THIS IS STRUCTURALLY UNABLE TO FIND:
//  - params only reachable on POST/PATCH bodies (different harness)
//  - handlers that 400 on a required param BEFORE touching the bad one (masked; noted per route)
//  - crashes needing two params to interact
import fs from 'fs';
import { req } from './.qa-r78-lib.mjs';

const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const ids = JSON.parse(fs.readFileSync('C:/tmp/qa-r78-ids.json', 'utf8'));
const qp = JSON.parse(fs.readFileSync('C:/tmp/qa-r78-qparams.json', 'utf8'));
const PARAMS = qp.all.filter(p => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(p));

// reuse the id filler from the get sweep
function fill(path) {
  const segs = path.split('/');
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]; if (!s.startsWith(':')) continue;
    const name = s.slice(1), parent = segs[i - 1];
    const byParent = {
      leads: ids.leadWithContact || ids.lead, estimates: ids.estimate, invoices: ids.invoice,
      contracts: ids.contract, 'work-orders': ids.workOrder, properties: ids.property,
      expenses: ids.expense, tasks: ids.task, subcontractors: ids.subcontractor,
      templates: path.includes('/contracts/') ? ids.contractTemplate : ids.estTemplate,
      'drip-sequences': ids.drip, applications: ids.finApplication, lenders: ids.finLender,
      plans: ids.finPlan, orders: ids.matOrder, products: ids.matProduct,
      notifications: ids.notification, 'canvass-pins': ids.canvassPin, automations: ids.automation,
      'custom-fields': ids.customField, 'prospect-lists': ids.prospectList, documents: ids.document,
      storms: ids.storm, team: ids.user, users: ids.user, jobs: ids.skipJob,
      territories: ids.territory, milestones: ids.milestone, contacts: ids.contact,
      counties: ids.county, items: ids.property, 'in-swath': ids.stormEventId,
      segments: ids.property, solar: ids.property, drift: ids.stormEventId,
    };
    let v = byParent[parent];
    if (!v) v = ({ leadId: ids.leadWithContact || ids.lead, estimateId: ids.estimate,
      invoiceId: ids.invoice, contractId: ids.contract, workOrderId: ids.workOrder,
      propertyId: ids.property, token: path.includes('contract') ? ids.contractToken : ids.estimateToken,
      shareToken: path.includes('contract') ? ids.contractToken : ids.estimateToken,
      eventId: ids.stormEventId, stormEventId: ids.stormEventId, stormId: ids.storm,
      userId: ids.user, countyId: ids.county, taskId: ids.task, milestoneId: ids.milestone,
      contactId: ids.contact })[name];
    if (!v) return null;
    segs[i] = v;
  }
  return segs.join('/');
}

// query strings some routes REQUIRE (so the handler reaches the code under test instead of 400ing)
const REQUIRED = {
  '/api/properties': 'bbox=-91.0,41.0,-90.0,42.0', '/api/map/properties': 'bbox=-91.0,41.0,-90.0,42.0',
  '/api/map/swaths': 'bbox=-91.0,41.0,-90.0,42.0', '/api/map/affected-properties': 'bbox=-91.0,41.0,-90.0,42.0',
  '/api/data/fema-housing': 'zip=52801', '/api/data/census-acs': 'zip=52801',
  '/api/storm-history/search': 'lat=41.5&lng=-90.5', '/api/roof-measurement/estimate': 'lat=41.5&lng=-90.5',
  '/api/storm-history': 'lat=41.5&lng=-90.5', '/api/storm-history/heatmap': 'bbox=-91.0,41.0,-90.0,42.0',
  '/api/crm/calendar': 'start=2026-01-01&end=2026-12-31',
};

const gets = inv.filter(r => r.method === 'GET');
const targets = [];
for (const r of gets) { const p = fill(r.path); if (p) targets.push({ ...r, filled: p }); }

const ARRAY = (p) => `${p}=a&${p}=b`;
const OBJECT = (p) => `${encodeURIComponent(p + '[k]')}=v`;

async function hit(t, qs) {
  const base = REQUIRED[t.path] ? REQUIRED[t.path] + '&' : '';
  return req('GET', `${t.filled}?${base}${qs}`);
}

console.log(`sweeping ${targets.length} GET routes x ${PARAMS.length} params, 2 shapes\n`);

// PASS 1 — baseline, then all params at once per shape. Cheap: 3 requests per route.
const suspects = [];
for (const t of targets) {
  const base = await hit(t, 'zzz=1');
  const arr = await hit(t, PARAMS.map(ARRAY).join('&'));
  const obj = await hit(t, PARAMS.map(OBJECT).join('&'));
  if (base.status >= 500) { console.log(`BASELINE 5xx (not param-related): ${base.status} ${t.path}`); continue; }
  if (arr.status >= 500 || obj.status >= 500)
    suspects.push({ ...t, base: base.status, arr: arr.status, obj: obj.status });
}

console.log(`\n=== ROUTES THAT 5xx ONLY WITH A BAD-TYPE PARAM: ${suspects.length} ===`);
suspects.forEach(s => console.log(`  ${s.path}   base=${s.base} array=${s.arr} object=${s.obj}   (${s.file})`));

// PASS 2 — narrow each suspect to the exact param(s)
const findings = [];
for (const s of suspects) {
  for (const p of PARAMS) {
    for (const [shape, mk] of [['array', ARRAY], ['object', OBJECT]]) {
      const r = await hit(s, mk(p));
      if (r.status >= 500) findings.push({ route: s.path, file: s.file, param: p, shape, status: r.status, body: JSON.stringify(r.body).slice(0, 90) });
    }
  }
}

console.log(`\n=== *** CONFIRMED 500s, ATTRIBUTED TO A SINGLE PARAM: ${findings.length} *** ===`);
for (const f of findings) console.log(`  500  ${f.route}   ?${f.param}  [${f.shape}]   (${f.file})`);
fs.writeFileSync('C:/tmp/qa-r78-qfuzz.json', JSON.stringify({ suspects, findings }, null, 1));
