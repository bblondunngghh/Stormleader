// Targeted probe for service-layer `throw new Error` paths reachable from routes.
import fs from 'node:fs';

const TOKEN = fs.readFileSync('.qa-token', 'utf8').trim();
const BASE = 'http://localhost:3001';
const BOGUS = '00000000-0000-0000-0000-000000000000';

const results = [];

async function probe(label, method, path, body) {
  const headers = { 'Authorization': `Bearer ${TOKEN}` };
  let opts = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(BASE + path, opts);
  const text = await r.text();
  const bad = r.status >= 500;
  results.push({
    label, method, path, status: r.status, bad,
    body: text.length > 200 ? text.slice(0, 200) + '...' : text,
  });
}

// Reachable `throw new Error` paths from services
await probe('from-storm bogus', 'POST', '/api/leads/from-storm', { stormEventId: BOGUS, propertyIds: [BOGUS] });
await probe('from-storm empty', 'POST', '/api/leads/from-storm', {});

await probe('roof-measure bogus prop', 'POST', '/api/roof-measurement/measure', { propertyId: BOGUS });
await probe('roof-measure empty', 'POST', '/api/roof-measurement/measure', {});

await probe('roof-manual bogus prop', 'POST', '/api/roof-measurement/manual', { propertyId: BOGUS, squares: 30 });
await probe('roof-manual empty', 'POST', '/api/roof-measurement/manual', {});
await probe('roof-manual no-fields', 'POST', '/api/roof-measurement/manual', { propertyId: BOGUS });

await probe('sub post no-name', 'POST', '/api/crm/subcontractors', {});
await probe('sub post empty-name', 'POST', '/api/crm/subcontractors', { name: '' });

await probe('financing lender bad-provider', 'POST', '/api/crm/financing/lenders', { provider: 'bogus_provider', name: 'qa' });
await probe('financing lender missing', 'POST', '/api/crm/financing/lenders', {});

await probe('financing app bogus-plan', 'POST', '/api/crm/financing/applications', { planId: BOGUS, estimateId: BOGUS, applicant: { firstName: 'qa', lastName: 'test', email: 'a@b.c' } });

await probe('drift correct bogus', 'POST', `/api/drift/${BOGUS}/correct`, {});

await probe('census skip-trace submit empty', 'POST', '/api/skip-trace/submit', { propertyIds: [BOGUS] });

await probe('estimate post no-lead', 'POST', '/api/estimates', { title: 'qa' });
await probe('estimate post empty', 'POST', '/api/estimates', {});

await probe('invoice post no-lead', 'POST', '/api/crm/invoices', { amount: 100 });
await probe('invoice post empty', 'POST', '/api/crm/invoices', {});

await probe('contract post empty', 'POST', '/api/crm/contracts', {});
await probe('contract post no-lead', 'POST', '/api/crm/contracts', { title: 'qa' });

await probe('work-order post empty', 'POST', '/api/crm/work-orders', {});
await probe('work-order post no-lead', 'POST', '/api/crm/work-orders', { title: 'qa' });

await probe('automation post empty', 'POST', '/api/crm/automations', {});
await probe('automation post bad-trigger', 'POST', '/api/crm/automations', { name: 'qa', trigger_type: 'never', steps: [] });

await probe('property post empty', 'POST', '/api/properties', {});
await probe('property put-location bad-coords', 'PUT', `/api/properties/${BOGUS}/location`, { lat: 'abc', lng: 'xyz' });
await probe('property post bad-lat', 'POST', '/api/properties', { lat: 999, lng: 999, address: 'qa' });

await probe('drift simulate empty', 'POST', '/api/drift/simulate', {});
await probe('drift calibrate empty', 'POST', '/api/drift/calibrate', {});

await probe('counties post empty', 'POST', '/api/counties', {});
await probe('counties import bogus', 'POST', `/api/counties/${BOGUS}/import`, {});

await probe('dataapis optimize empty', 'POST', '/api/data/optimize-route', {});
await probe('dataapis optimize bad', 'POST', '/api/data/optimize-route', { stops: 'not-an-array' });

await probe('drip post empty', 'POST', '/api/crm/drip-sequences', {});
await probe('drip post missing-steps', 'POST', '/api/crm/drip-sequences', { name: 'qa', trigger_type: 'manual' });

await probe('expense post bad-amount', 'POST', '/api/crm/expenses', { amount: 'not-a-number', description: 'qa' });
await probe('expense post negative-amount', 'POST', '/api/crm/expenses', { amount: -50, description: 'qa' });

await probe('canvass post bad-coords', 'POST', '/api/crm/canvass-pins', { lat: 'abc', lng: 'xyz', note: 'qa' });
await probe('canvass post missing', 'POST', '/api/crm/canvass-pins', {});

await probe('territory post bad-geo', 'POST', '/api/crm/territories', { name: 'qa', polygon: 'not-geojson' });

await probe('alerts config put bad', 'PUT', '/api/alerts/config', { hail_min_size: 'not-a-num' });
await probe('alerts config put empty', 'PUT', '/api/alerts/config', {});

await probe('crm bulk-assign empty', 'POST', '/api/crm/leads/bulk-assign', {});
await probe('crm bulk-status empty', 'POST', '/api/crm/leads/bulk-status', {});
await probe('crm bulk-assign bad-array', 'POST', '/api/crm/leads/bulk-assign', { leadIds: 'not-an-array' });

await probe('crm team invite empty', 'POST', '/api/crm/team/invite', {});
await probe('crm team invite bad-email', 'POST', '/api/crm/team/invite', { email: 'not-an-email', role: 'agent' });

await probe('crm test-email empty', 'POST', '/api/crm/test-email', {});

await probe('crm tenant-settings empty', 'PUT', '/api/crm/tenant-settings', {});

await probe('crm activity empty', 'POST', '/api/crm/activities', {});
await probe('crm activity bogus-lead', 'POST', '/api/crm/activities', { leadId: BOGUS, activityType: 'call', direction: 'outbound' });

await probe('crm prospect-list post empty', 'POST', '/api/crm/prospect-lists', {});

await probe('crm contact add empty', 'POST', `/api/crm/leads/${BOGUS}/contacts`, {});

await probe('materials orders empty', 'POST', '/api/materials/orders', {});
await probe('materials credentials put empty', 'PUT', '/api/materials/credentials', {});
await probe('materials auto-order bogus', 'POST', `/api/materials/estimate/${BOGUS}/auto-order`, {});

// === Done — print failures ===
const bad = results.filter(r => r.bad);
console.log(`\n=== ${results.length} probes, ${bad.length} returned 5xx ===\n`);
for (const r of bad) {
  console.log(`[${r.status}] ${r.method} ${r.path}`);
  console.log(`  label: ${r.label}`);
  console.log(`  body:  ${r.body}\n`);
}

// Status histogram
const hist = {};
for (const r of results) hist[r.status] = (hist[r.status] || 0) + 1;
console.log('--- Status histogram ---');
console.log(hist);

fs.writeFileSync('.qa-probe2-results.json', JSON.stringify(results, null, 2));
