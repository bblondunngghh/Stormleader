// Run 77 s1 — GET sweep over every GET route in the inventory, substituting REAL ids.
//
// WHAT THIS SWEEP IS STRUCTURALLY UNABLE TO FIND (state it, per the Run 74 lesson):
//  - anything behind a write (POST/PATCH/PUT/DELETE bodies) — separate harness
//  - crashes that need a SPECIFIC stored row (this uses the FIRST row of each table only)
//  - wrong VALUES that are well-formed (a 200 with a wrong number looks identical to a right one)
//  - routes whose param has no resolvable id (declared as coverage holes at the end)
import fs from 'fs';
import { req, summarize } from './.qa-r77-lib.mjs';

const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const ids = JSON.parse(fs.readFileSync('C:/tmp/qa-r77-ids.json', 'utf8'));

// Map a route path to the id that belongs in each :param, based on the path prefix.
function fill(path) {
  const holes = [];
  let out = path;
  const segs = path.split('/');
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (!s.startsWith(':')) continue;
    const name = s.slice(1);
    const parent = segs[i - 1];
    let v = null;
    // resolve by the resource segment that precedes the param
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
      counties: ids.county, tenants: null, activities: null, payments: null, photos: null, items: ids.property,
    };
    if (parent in byParent) v = byParent[parent];
    // param-name fallbacks
    if (!v) {
      const byName = {
        leadId: ids.leadWithContact || ids.lead, estimateId: ids.estimate, invoiceId: ids.invoice,
        contractId: ids.contract, workOrderId: ids.workOrder, propertyId: ids.property,
        token: path.includes('contract') ? ids.contractToken : ids.estimateToken,
        shareToken: path.includes('contract') ? ids.contractToken : ids.estimateToken,
        eventId: ids.stormEventId || ids.storm, stormEventId: ids.stormEventId || ids.storm,
        stormId: ids.storm, userId: ids.user, countyId: ids.county,
        tenantId: null, taskId: ids.task, milestoneId: ids.milestone, contactId: ids.contact,
      };
      if (name in byName) v = byName[name];
    }
    if (!v) { holes.push(`${name}@${parent}`); v = null; }
    segs[i] = v ?? `__MISSING_${name}__`;
  }
  out = segs.join('/');
  return { path: out, holes };
}

// Query strings a handful of routes genuinely require (documented, not guessed silently).
const QS = {
  '/api/properties': '?bbox=-91.0,41.0,-90.0,42.0',
  '/api/map/properties': '?bbox=-91.0,41.0,-90.0,42.0',
  '/api/data/fema-housing': '?zip=52801',
  '/api/data/census-acs': '?zip=52801',
  '/api/storm-history/search': '?lat=41.5&lng=-90.5',
  '/api/roof-measurement/estimate': '?lat=41.5&lng=-90.5',
};

const gets = inv.filter((r) => r.method === 'GET');
const results = [];
const holes = [];

for (const r of gets) {
  const f = fill(r.path);
  if (f.path.includes('__MISSING_')) { holes.push({ ...r, missing: f.holes }); continue; }
  const qs = QS[r.path] || '';
  const res = await req('GET', f.path + qs);
  results.push({ ...r, url: f.path + qs, status: res.status, ms: res.ms, shape: summarize(res.body) });
}

const by = {};
results.forEach((r) => { by[r.status] = (by[r.status] || 0) + 1; });
console.log('=== GET SWEEP: ' + results.length + ' requested, ' + holes.length + ' skipped (no id) ===');
console.log('status counts:', JSON.stringify(by));

const bad = results.filter((r) => r.status >= 500 || r.status === 0);
console.log('\n=== 5xx / transport failures: ' + bad.length + ' ===');
bad.forEach((r) => console.log(`  ${r.status} ${r.method} ${r.url}   <- ${r.file}\n       ${r.shape}`));

const four = results.filter((r) => r.status >= 400 && r.status < 500);
console.log('\n=== 4xx: ' + four.length + ' ===');
four.forEach((r) => console.log(`  ${r.status} ${r.url}  (${r.file})  ${r.shape}`));

console.log('\n=== COVERAGE HOLES (param had no resolvable id): ' + holes.length + ' ===');
holes.forEach((h) => console.log(`  ${h.method} ${h.path}  missing=${h.missing.join(',')}  (${h.file})`));

const slow = results.filter((r) => r.ms > 2000).sort((a, b) => b.ms - a.ms);
console.log('\n=== SLOW (>2s): ' + slow.length + ' ===');
slow.forEach((r) => console.log(`  ${r.ms}ms ${r.url}`));

fs.writeFileSync('C:/tmp/qa-r77-getsweep.json', JSON.stringify({ results, holes }, null, 1));
