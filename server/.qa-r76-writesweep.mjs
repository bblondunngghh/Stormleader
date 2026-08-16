// Run 76 s1 — write-route sweep, phase A: empty body + real ids.
//
// WHAT THIS IS STRUCTURALLY UNABLE TO FIND (stating it up front, per Run 74's lesson):
// nothing about handler logic past validation. A 400 here only proves the guard fires.
// Phase B (.qa-r76-noop.mjs) is the pass that actually reaches stored rows.
import fs from 'fs';
import { req, summarize } from './.qa-r76-lib.mjs';

const ids = JSON.parse(fs.readFileSync('C:/tmp/qa-r76-ids.json', 'utf8'));
const routes = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

// ---- EXCLUSIONS: real money, real email, bulk writes, destructive ----------
const EXCLUDE = [
  /import/i,                       // trigger-import (hyphen! a /\/import/ pattern MISSES it), import-csv, counties/:id/import
  /geocode/i,                      // Google geocoding costs money
  /fema-lookup/i,
  /\/send$/, /send-email/, /test-email/,   // sends real email
  /score-all/, /bulk-/,            // bulk writes
  /correct-all/, /calibrate/, /simulate/,  // drift bulk ops
  /^\/api\/payments\//,            // Stripe
  /skip-trace\/(submit|setup-payment)/,
  /roof-measurement\/(measure|manual)/,     // paid API
  /auth\/(register|refresh|login)/,
  /onboarding\/(create-tenant|select-plan|setup-payment|complete|enable-addons)/,
  /webhooks/,
  /auto-order/,                    // places a real supplier order
  /generate-leads/, /fema-live-polygon/,
];
const isExcluded = (p) => EXCLUDE.some((re) => re.test(p));

const PARAMS = {
  id: null, leadId: ids.lead, estimateId: ids.estimate, workOrderId: ids.workOrder,
  woId: ids.workOrder, milestoneId: ids.milestone, propertyId: ids.property,
  contactId: ids.contact, subcontractorId: ids.subcontractor, token: ids.estimateToken,
  stormEventId: ids.stormEventId, jobId: ids.skipJob, userId: ids.user,
};
// per-route :id resolution by path prefix
function resolveId(p) {
  if (p.startsWith('/api/crm/contracts/templates')) return ids.contractTemplate;
  if (p.startsWith('/api/crm/contracts')) return ids.contract;
  if (p.startsWith('/api/estimates/templates')) return ids.estTemplate;
  if (p.startsWith('/api/estimates')) return ids.estimate;
  if (p.startsWith('/api/crm/invoices')) return ids.invoice;
  if (p.startsWith('/api/crm/work-orders')) return ids.workOrder;
  if (p.startsWith('/api/crm/leads')) return ids.lead;
  if (p.startsWith('/api/leads')) return ids.lead;
  if (p.startsWith('/api/crm/expenses')) return ids.expense;
  if (p.startsWith('/api/crm/tasks')) return ids.task;
  if (p.startsWith('/api/crm/subcontractors')) return ids.subcontractor;
  if (p.startsWith('/api/crm/canvass-pins')) return ids.canvassPin;
  if (p.startsWith('/api/crm/custom-fields')) return ids.customField;
  if (p.startsWith('/api/crm/prospect-lists')) return ids.prospectList;
  if (p.startsWith('/api/crm/automations')) return ids.automation;
  if (p.startsWith('/api/crm/drip-sequences')) return ids.drip;
  if (p.startsWith('/api/crm/financing/lenders')) return ids.finLender;
  if (p.startsWith('/api/crm/financing/plans')) return ids.finPlan;
  if (p.startsWith('/api/crm/financing/applications')) return ids.finApplication;
  if (p.startsWith('/api/crm/territories')) return ids.territory;
  if (p.startsWith('/api/materials/orders')) return ids.matOrder;
  if (p.startsWith('/api/notifications')) return ids.notification;
  if (p.startsWith('/api/properties')) return ids.property;
  if (p.startsWith('/api/documents')) return ids.document;
  if (p.startsWith('/api/storms')) return ids.storm;
  return null;
}

const writes = routes.filter((r) => r.method !== 'GET');
const results = [];
let excluded = 0, noid = 0;

for (const r of writes) {
  if (isExcluded(r.path)) { results.push({ ...r, status: 'EXCLUDED' }); excluded++; continue; }
  if (r.method === 'DELETE') { results.push({ ...r, status: 'SKIP_DELETE' }); continue; }
  let path = r.path;
  let missing = false;
  for (const seg of r.path.split('/')) {
    if (!seg.startsWith(':')) continue;
    const key = seg.slice(1);
    const val = key === 'id' ? resolveId(r.path) : PARAMS[key];
    if (!val) { missing = true; break; }
    path = path.replace(seg, encodeURIComponent(val));
  }
  if (missing) { results.push({ ...r, status: 'NO_ID' }); noid++; continue; }

  const res = await req(r.method, path, {});
  results.push({ ...r, url: path, status: res.status, summary: summarize(res.body) });
}

fs.writeFileSync('C:/tmp/qa-r76-writesweep.json', JSON.stringify(results, null, 1));
const tally = {};
for (const x of results) tally[x.status] = (tally[x.status] || 0) + 1;
console.log('write routes:', writes.length);
console.log('tally:', JSON.stringify(tally, null, 0));
console.log('\n=== 5xx / FETCH ERROR (the only thing that matters here) ===');
const bad = results.filter((x) => x.status === 0 || (typeof x.status === 'number' && x.status >= 500));
console.log(bad.length ? bad.map((x) => `${x.status} ${x.method} ${x.url}\n     ${JSON.stringify(x.summary)}`).join('\n') : 'NONE');
console.log('\n=== 2xx on an EMPTY body (accepted-but-empty writes worth a look) ===');
results.filter((x) => typeof x.status === 'number' && x.status >= 200 && x.status < 300)
  .forEach((x) => console.log(String(x.status).padEnd(4), x.method.padEnd(6), x.url));
console.log('\n=== NO_ID (never exercised) ===');
results.filter((x) => x.status === 'NO_ID').forEach((x) => console.log('    ', x.method, x.path));
