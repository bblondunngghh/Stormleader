// Run 73 s1 — full GET sweep with REAL id substitution.
// Read-only: performs no writes. Usage: node server/.qa-r73-getsweep.mjs
import fs from 'fs';
import { req, mint, summarize } from './.qa-r73-lib.mjs';

await mint();
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const routes = (Array.isArray(inv) ? inv : inv.routes || []).filter(r => r.method === 'GET');
const ids = JSON.parse(fs.readFileSync('C:/tmp/qa-r73-ids.json', 'utf8'));

const UUID_FAKE = '00000000-0000-4000-8000-000000000000';

// Longest-prefix match so /api/crm/work-orders wins over a bare /work-orders test.
const MAP = [
  ['/api/crm/work-orders/milestone-templates', 'milestoneTemplate'],
  ['/api/crm/contracts/templates', 'contractTemplate'],
  ['/api/crm/financing/applications', 'financingApp'],
  ['/api/crm/financing/lenders', 'financingLender'],
  ['/api/crm/financing/plans', 'financingPlan'],
  ['/api/crm/work-orders', 'workOrder'],
  ['/api/crm/subcontractors', 'subcontractor'],
  ['/api/crm/territories', 'territory'],
  ['/api/crm/custom-fields', 'customField'],
  ['/api/crm/drip-sequences', 'drip'],
  ['/api/crm/automations', 'automation'],
  ['/api/crm/prospect-lists', 'prospectList'],
  ['/api/crm/contracts', 'contract'],
  ['/api/crm/invoices', 'invoice'],
  ['/api/crm/expenses', 'expense'],
  ['/api/crm/leads', 'lead'],
  ['/api/crm/tasks', 'task'],
  ['/api/estimates/templates', 'estimateTemplate'],
  ['/api/estimates', 'estimate'],
  ['/api/invoices', 'invoice'],
  ['/api/leads', 'lead'],
  ['/api/documents', 'document'],
  ['/api/notifications', 'notification'],
  ['/api/counties', 'county'],
  ['/api/storms', 'storm'],
  ['/api/properties', 'property'],
  ['/api/drift', 'storm'],
  ['/api/roof-measurement', 'property'],
];

function fill(path) {
  if (!path.includes(':')) return path;
  const hit = MAP.find(([prefix]) => path.startsWith(prefix));
  const real = hit ? ids[hit[1]] : null;
  return path.replace(/:(\w+)/g, real || UUID_FAKE);
}

const results = [];
for (const r of routes) {
  const path = fill(r.path);
  const usedReal = path !== r.path && !path.includes(UUID_FAKE);
  const out = await req('GET', path);
  results.push({
    file: r.file, method: 'GET', route: r.path, path,
    status: out.status, ms: out.ms, usedReal,
    shape: summarize(out.body),
    err: out.status >= 400 ? String(JSON.stringify(out.body)).slice(0, 200) : undefined,
  });
  const flag = out.status >= 500 || out.status === 0 ? '  <<<<< SERVER ERROR' : '';
  console.log(`${String(out.status).padEnd(4)} ${String(out.ms).padStart(5)}ms ${usedReal ? 'R' : ' '} ${r.path}${flag}`);
}

fs.writeFileSync('C:/tmp/qa-r73-getsweep.json', JSON.stringify({ ids, results }, null, 1));

const by = {};
results.forEach(r => { by[r.status] = (by[r.status] || 0) + 1; });
console.log('\n=== GET SWEEP SUMMARY ===');
console.log('total:', results.length, 'by status:', JSON.stringify(by));
console.log('exercised against a REAL id:', results.filter(r => r.usedReal).length);
const bad = results.filter(r => r.status >= 500 || r.status === 0);
console.log('5xx / fetch errors:', bad.length);
bad.forEach(b => console.log('  !!', b.status, b.route, '->', b.path, '|', b.err));
console.log('\n--- 400s (verify each is real validation, not a crash) ---');
results.filter(r => r.status === 400).forEach(r => console.log('  400', r.route, '|', r.err));
console.log('\n--- 404s remaining ---');
results.filter(r => r.status === 404).forEach(r => console.log('  404', r.route, '| real id used:', r.usedReal));
