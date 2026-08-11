// Run 73 s1 — resolve one real id per entity type, using the CORRECT mount prefixes
// (most entities live under /api/crm/, which the first sweep got wrong).
// Read-only. Writes C:/tmp/qa-r73-ids.json
import fs from 'fs';
import { req, mint } from './.qa-r73-lib.mjs';

await mint();

// Generically find the first object carrying an `id` anywhere in the response.
function firstId(body) {
  if (!body || typeof body !== 'object') return null;
  const arrays = Array.isArray(body) ? [body] : Object.values(body).filter(Array.isArray);
  for (const arr of arrays) {
    for (const el of arr) {
      if (el && typeof el === 'object' && el.id) return el.id;
    }
  }
  return null;
}

const sources = {
  lead: '/api/crm/leads?limit=1',
  estimate: '/api/estimates?limit=1',
  invoice: '/api/crm/invoices?limit=1',
  workOrder: '/api/crm/work-orders?limit=1',
  contract: '/api/crm/contracts?limit=1',
  contractTemplate: '/api/crm/contracts/templates',
  expense: '/api/crm/expenses?limit=1',
  task: '/api/crm/tasks?limit=1',
  subcontractor: '/api/crm/subcontractors?limit=1',
  territory: '/api/crm/territories?limit=1',
  document: '/api/documents?limit=1',
  customField: '/api/crm/custom-fields',
  automation: '/api/crm/automations',
  drip: '/api/crm/drip-sequences',
  storm: '/api/storms?limit=1',
  notification: '/api/notifications?limit=1',
  prospectList: '/api/crm/prospect-lists',
  county: '/api/counties',
  financingPlan: '/api/crm/financing/plans',
  financingApp: '/api/crm/financing/applications',
  financingLender: '/api/crm/financing/lenders',
  milestoneTemplate: '/api/crm/work-orders/milestone-templates',
  estimateTemplate: '/api/estimates/templates',
  property: '/api/properties?limit=1&bounds=-98.0,29.0,-97.0,31.0',
};

const ids = {};
const diag = {};
for (const [name, path] of Object.entries(sources)) {
  const r = await req('GET', path);
  ids[name] = firstId(r.body);
  diag[name] = { path, status: r.status, keys: r.body && typeof r.body === 'object' ? Object.keys(r.body).slice(0, 6) : String(r.body).slice(0, 80) };
  console.log(`${ids[name] ? 'OK  ' : '--  '} ${name.padEnd(18)} ${String(r.status).padEnd(4)} ${ids[name] || ''}`);
  if (!ids[name]) console.log(`      keys/body: ${JSON.stringify(diag[name].keys)}`);
}

fs.writeFileSync('C:/tmp/qa-r73-ids.json', JSON.stringify(ids, null, 1));
const got = Object.values(ids).filter(Boolean).length;
console.log(`\nRESOLVED ${got} of ${Object.keys(ids).length} entity ids`);
