import fs from 'fs';

const mounts = {
  'auth.js': '/api/auth', 'storms.js': '/api/storms', 'map.js': '/api/map',
  'dashboard.js': '/api/dashboard', 'properties.js': '/api/properties', 'leads.js': '/api/leads',
  'skipTrace.js': '/api/skip-trace', 'webhook.js': '/api/webhooks', 'alerts.js': '/api/alerts',
  'drift.js': '/api/drift', 'counties.js': '/api/counties', 'financing.js': '/api/crm/financing',
  'contracts.js': '/api/crm/contracts', 'crm.js': '/api/crm', 'automations.js': '/api/crm/automations',
  'invoices.js': '/api/crm/invoices', 'canvassing.js': '/api/crm/canvass-pins',
  'reports.js': '/api/crm/reports', 'workOrders.js': '/api/crm/work-orders',
  'drip.js': '/api/crm/drip-sequences', 'estimates.js': '/api/estimates',
  'notifications.js': '/api/notifications', 'search.js': '/api/search', 'documents.js': '/api/documents',
  'roofMeasurement.js': '/api/roof-measurement', 'onboarding.js': '/api/onboarding',
  'admin.js': '/api/admin', 'payments.js': '/api/payments', 'materials.js': '/api/materials',
  'expenses.js': '/api/crm/expenses', 'subcontractors.js': '/api/crm/subcontractors',
  'territories.js': '/api/crm/territories', 'hearthWebhook.js': '/api/webhooks/hearth',
  'disasterDeclarations.js': '/api/disaster-declarations', 'stormHistory.js': '/api/storm-history',
  'dataApis.js': '/api/data',
};

const QUOTE = "['\"" + String.fromCharCode(96) + ']';
const re = new RegExp('router\\.(get|post|put|patch|delete)\\(\\s*' + QUOTE + '([^\'"' + String.fromCharCode(96) + ']*)' + QUOTE, 'g');

const out = [];
const tally = {};
for (const [f, prefix] of Object.entries(mounts)) {
  const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(src))) {
    const method = m[1].toUpperCase();
    const p = m[2];
    const full = p === '/' ? prefix : prefix + p;
    out.push({ file: f, method, path: full });
    tally[method] = (tally[method] || 0) + 1;
  }
}

out.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
fs.writeFileSync('C:/tmp/route-inventory.json', JSON.stringify(out, null, 1));

const lines = out.map((r) => `${r.method.padEnd(6)} ${r.path.padEnd(58)} ${r.file}`);
fs.writeFileSync('C:/tmp/route-inventory.txt', lines.join('\n') + '\n');

console.log('TOTAL routes:', out.length);
console.log('by method:', JSON.stringify(tally));
console.log('writes:', out.filter((r) => r.method !== 'GET').length);
console.log('files:', Object.keys(mounts).length);
console.log('--- paths with params (need a real id) ---');
console.log(out.filter((r) => r.path.includes(':')).length, 'of', out.length);
