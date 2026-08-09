// Run 71 — GET sweep across all 132 GET routes.
// v2: resource-AWARE id resolution. v1 substituted a lead id into every bare ":id",
// which 404'd 29 routes and left them effectively untested (tester error, not a bug).
import fs from 'fs';
import { GET, rows, snip } from './.qa-r71-lib.mjs';

const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const routes = (Array.isArray(inv) ? inv : inv.routes || []).filter(r => r.method === 'GET');

// Map a LIST endpoint -> the route prefix whose :id it satisfies.
const seeds = [
  ['lead',          '/api/crm/leads',            ['/api/crm/leads', '/api/leads']],
  ['estimate',      '/api/estimates',            ['/api/estimates']],
  ['invoice',       '/api/crm/invoices',         ['/api/crm/invoices']],
  ['contract',      '/api/crm/contracts',        ['/api/crm/contracts']],
  ['workOrder',     '/api/crm/work-orders',      ['/api/crm/work-orders']],
  ['expense',       '/api/crm/expenses',         ['/api/crm/expenses']],
  ['subcontractor', '/api/crm/subcontractors',   ['/api/crm/subcontractors']],
  ['territory',     '/api/crm/territories',      ['/api/crm/territories']],
  ['task',          '/api/crm/tasks',            ['/api/crm/tasks']],
  ['customField',   '/api/crm/custom-fields',    ['/api/crm/custom-fields']],
  ['document',      '/api/crm/documents',        ['/api/crm/documents', '/api/documents']],
  ['dripSequence',  '/api/crm/drip-sequences',   ['/api/crm/drip-sequences']],
  ['prospectList',  '/api/crm/prospect-lists',   ['/api/crm/prospect-lists']],
  ['financingApp',  '/api/crm/financing/applications', ['/api/crm/financing/applications']],
  ['storm',         '/api/storms',               ['/api/storms', '/api/drift']],
  ['county',        '/api/counties',             ['/api/counties']],
  ['notification',  '/api/notifications',        ['/api/notifications']],
  ['materialOrder', '/api/materials/orders',     ['/api/materials/orders']],
  ['product',       '/api/materials/products',   ['/api/materials/products']],
  ['automation',    '/api/crm/automations',      ['/api/crm/automations']],
];

const ids = {};
const prefixToId = [];
for (const [key, listPath, prefixes] of seeds) {
  const r = await GET(listPath);
  const first = rows(r.body)[0];
  const id = first && (first.id || first.uuid || first.event_id || first.fips);
  ids[key] = { listPath, listStatus: r.status, count: rows(r.body).length, id: id || null };
  if (id) prefixes.forEach(p => prefixToId.push([p, String(id)]));
}
// longest prefix wins
prefixToId.sort((a, b) => b[0].length - a[0].length);

fs.writeFileSync('C:/tmp/qa-r71-ids.json', JSON.stringify(ids, null, 1));
console.log('=== id resolution ===');
for (const [k, v] of Object.entries(ids)) {
  console.log(`  ${k.padEnd(15)} ${String(v.listStatus).padEnd(4)} n=${String(v.count).padEnd(4)} ${v.id || '-- NONE --'}   (${v.listPath})`);
}

const FAKE = '00000000-0000-4000-8000-000000000000';
const named = {
  leadId: 'lead', estimateId: 'estimate', invoiceId: 'invoice', contractId: 'contract',
  workOrderId: 'workOrder', expenseId: 'expense', subcontractorId: 'subcontractor',
  territoryId: 'territory', taskId: 'task', documentId: 'document',
  notificationId: 'notification', stormEventId: 'storm', sequenceId: 'dripSequence',
  listId: 'prospectList', productId: 'product', orderId: 'materialOrder',
};

function fill(path) {
  let p = path;
  for (const [param, key] of Object.entries(named)) {
    if (p.includes(':' + param)) {
      p = p.replace(new RegExp(':' + param + '\\b', 'g'), (ids[key] && ids[key].id) || FAKE);
    }
  }
  // bare :id / :xxx -> pick by route prefix
  if (/:[A-Za-z_]+/.test(p)) {
    const match = prefixToId.find(([pre]) => path.startsWith(pre));
    p = p.replace(/:[A-Za-z_]+/g, match ? match[1] : FAKE);
  }
  return p;
}

const results = [];
for (const r of routes) {
  const tested = fill(r.path);
  const unresolved = tested.includes(FAKE);
  const out = await GET(tested);
  results.push({ file: r.file, route: r.path, tested, unresolved, status: out.status, snippet: snip(out.body) });
}

const byStatus = {};
results.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
console.log('\nGET sweep:', results.length, 'routes');
console.log('by status:', JSON.stringify(byStatus));
console.log('routes tested with a REAL id:', results.filter(r => !r.unresolved).length);
console.log('routes that had NO resolvable id (fake uuid used):', results.filter(r => r.unresolved).length);

const bad = results.filter(r => r.status >= 500 || r.status === 0);
console.log('\n=== 5xx / connection failures:', bad.length, '===');
bad.forEach(r => console.log(`  ${r.status}  ${r.route}\n        ${r.tested}\n        ${r.snippet}`));

console.log('\n=== 404s WITH a real id (these are the interesting ones) ===');
results.filter(r => r.status === 404 && !r.unresolved)
  .forEach(r => console.log(`  ${r.route}\n        -> ${r.tested}\n        ${r.snippet.slice(0, 120)}`));

console.log('\n=== 400s ===');
results.filter(r => r.status === 400)
  .forEach(r => console.log(`  ${r.route}  :: ${r.snippet.slice(0, 110)}`));

fs.writeFileSync('C:/tmp/qa-r71-getsweep.json', JSON.stringify(results, null, 1));
