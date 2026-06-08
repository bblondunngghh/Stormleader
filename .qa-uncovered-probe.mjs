// Run 44 — probe remaining uncovered routes after Run 41/42/43 sweeps.
// Adds positive GET coverage on list-collection endpoints + empty-body POSTs
// for resources whose root POST hadn't been hit, plus a few public-token routes.
// Skips heavy-work and FEMA endpoints per project constraints.

import { readFileSync, writeFileSync } from 'node:fs';

const API = 'http://localhost:3001';
const ZERO = '00000000-0000-0000-0000-000000000000';
const BAD_TOKEN = 'invalidtoken123';

const token = readFileSync('/tmp/qa-token.txt', 'utf8').trim();
const auth = { Authorization: `Bearer ${token}` };
const jsonAuth = { ...auth, 'Content-Type': 'application/json' };
const jsonOnly = { 'Content-Type': 'application/json' };

const results = [];

async function probe(label, method, path, opts = {}) {
  const url = path.startsWith('http') ? path : API + path;
  const headers = opts.public ? (opts.body ? jsonOnly : {}) : (opts.body ? jsonAuth : auth);
  try {
    const r = await fetch(url, {
      method,
      headers,
      body: opts.body || undefined,
    });
    const text = (await r.text()).slice(0, 300);
    results.push({ label, method, path, status: r.status, body: text });
  } catch (e) {
    results.push({ label, method, path, status: 'ERR', body: String(e) });
  }
}

// ===== LIST collections (authenticated GET, expect 200) =====
await probe('LIST:automations', 'GET', '/api/crm/automations');
await probe('LIST:canvass-pins', 'GET', '/api/crm/canvass-pins');
await probe('LIST:contracts', 'GET', '/api/crm/contracts');
await probe('LIST:drip-sequences', 'GET', '/api/crm/drip-sequences');
await probe('LIST:expenses', 'GET', '/api/crm/expenses');
await probe('LIST:invoices', 'GET', '/api/crm/invoices');
await probe('LIST:subcontractors', 'GET', '/api/crm/subcontractors');
await probe('LIST:territories', 'GET', '/api/crm/territories');
await probe('LIST:work-orders', 'GET', '/api/crm/work-orders');
await probe('LIST:counties', 'GET', '/api/counties');
await probe('LIST:estimates', 'GET', '/api/estimates');
await probe('LIST:leads', 'GET', '/api/leads');
await probe('LIST:notifications', 'GET', '/api/notifications');
await probe('LIST:documents', 'GET', '/api/documents');
await probe('LIST:disaster-declarations', 'GET', '/api/disaster-declarations');
await probe('LIST:storm-history', 'GET', '/api/storm-history');
await probe('LIST:storms', 'GET', '/api/storms');

// ===== Empty-body POSTs on resource root (expect 400, not 500) =====
await probe('POST:automations-empty', 'POST', '/api/crm/automations', { body: '{}' });
await probe('POST:canvass-empty', 'POST', '/api/crm/canvass-pins', { body: '{}' });
await probe('POST:contracts-empty', 'POST', '/api/crm/contracts', { body: '{}' });
await probe('POST:drip-empty', 'POST', '/api/crm/drip-sequences', { body: '{}' });
await probe('POST:expenses-empty', 'POST', '/api/crm/expenses', { body: '{}' });
await probe('POST:invoices-empty', 'POST', '/api/crm/invoices', { body: '{}' });
await probe('POST:subcontractors-empty', 'POST', '/api/crm/subcontractors', { body: '{}' });
await probe('POST:territories-empty', 'POST', '/api/crm/territories', { body: '{}' });
await probe('POST:work-orders-empty', 'POST', '/api/crm/work-orders', { body: '{}' });
await probe('POST:estimates-empty', 'POST', '/api/estimates', { body: '{}' });
await probe('POST:properties-empty', 'POST', '/api/properties', { body: '{}' });

// ===== Empty-body sub-resource POSTs =====
await probe('POST:lead-contacts-empty', 'POST', `/api/crm/leads/${ZERO}/contacts`, { body: '{}' });
await probe('POST:lead-contacts-bad-uuid', 'POST', '/api/crm/leads/notauuid/contacts', { body: '{}' });
await probe('POST:wo-milestones-empty', 'POST', `/api/crm/work-orders/${ZERO}/milestones`, { body: '{}' });
await probe('POST:drip-enroll-empty', 'POST', `/api/crm/drip-sequences/${ZERO}/enroll`, { body: '{}' });
await probe('POST:fin-apps-empty', 'POST', '/api/crm/financing/applications', { body: '{}' });
await probe('POST:fin-plans-sync-empty', 'POST', '/api/crm/financing/plans/sync', { body: '{}' });
await probe('POST:payments-connect-onboard', 'POST', '/api/payments/connect/onboard', { body: '{}' });

// ===== Bad-uuid PATCH on custom-fields =====
await probe('PATCH:custom-fields-bad-uuid', 'PATCH', '/api/crm/custom-fields/notauuid', { body: '{}' });
await probe('PATCH:custom-fields-zero', 'PATCH', `/api/crm/custom-fields/${ZERO}`, { body: '{}' });

// ===== prospect-lists items lookup =====
await probe('GET:prospect-items-zero', 'GET', `/api/crm/prospect-lists/${ZERO}/items`);
await probe('GET:prospect-items-bad-uuid', 'GET', '/api/crm/prospect-lists/notauuid/items');

// ===== Public-token GETs (expect 404 for invalid tokens, NOT 500) =====
await probe('PUB:contract-bad-token', 'GET', '/api/crm/contracts/public/notatoken', { public: true });
await probe('PUB:estimate-bad-token', 'GET', '/api/estimates/public/notatoken', { public: true });
await probe('PUB:lead-status-bad-token', 'GET', '/api/leads/status/public/notatoken', { public: true });
await probe('PUB:fin-plans-bad-token', 'GET', '/api/crm/financing/public/notatoken/plans', { public: true });
await probe('PUB:fin-apps-bad-token', 'GET', '/api/crm/financing/public/notatoken/applications', { public: true });
await probe('PUB:fin-apply-bad-token', 'POST', '/api/crm/financing/public/notatoken/apply', { body: '{}', public: true });

// ===== Remaining specific GET/POST routes =====
await probe('INV:payment-zero', 'POST', `/api/crm/invoices/${ZERO}/payment`, { body: '{}' });
await probe('INV:payment-bad-uuid', 'POST', '/api/crm/invoices/notauuid/payment', { body: '{}' });
await probe('INV:payment-bad-amount', 'POST', `/api/crm/invoices/${ZERO}/payment`, { body: JSON.stringify({ amount: 'abc' }) });
await probe('PROP:list-no-bbox', 'GET', '/api/properties');
await probe('PROP:list-bad-bbox', 'GET', '/api/properties?bbox=garbage');
await probe('PROP:list-partial-bbox', 'GET', '/api/properties?bbox=1,2');
await probe('PROP:list-good-bbox', 'GET', '/api/properties?bbox=-180,-90,180,90&limit=1');
await probe('ONB:complete-empty', 'POST', '/api/onboarding/complete', { body: '{}' });
await probe('PAY:webhook-empty', 'POST', '/api/payments/webhook', { body: '{}', public: true });
await probe('PAY:webhook-bad-sig', 'POST', '/api/payments/webhook', { body: JSON.stringify({ id: 'evt_1' }), public: true });

// ===== Wide bad input — test that bad JSON in POST collection endpoints stays 400 =====
await probe('BAD-JSON:expenses', 'POST', '/api/crm/expenses', { body: '{ bad' });
await probe('BAD-JSON:invoices', 'POST', '/api/crm/invoices', { body: '{ bad' });
await probe('BAD-JSON:contracts', 'POST', '/api/crm/contracts', { body: '{ bad' });
await probe('BAD-JSON:work-orders', 'POST', '/api/crm/work-orders', { body: '{ bad' });
await probe('BAD-JSON:territories', 'POST', '/api/crm/territories', { body: '{ bad' });
await probe('BAD-JSON:subcontractors', 'POST', '/api/crm/subcontractors', { body: '{ bad' });
await probe('BAD-JSON:automations', 'POST', '/api/crm/automations', { body: '{ bad' });
await probe('BAD-JSON:drip-sequences', 'POST', '/api/crm/drip-sequences', { body: '{ bad' });
await probe('BAD-JSON:estimates', 'POST', '/api/estimates', { body: '{ bad' });

console.log('=== SUMMARY ===');
console.log('Total probes:', results.length);
const fiveXX = results.filter(r => typeof r.status === 'number' && r.status >= 500);
const errs = results.filter(r => r.status === 'ERR');
console.log('5xx:', fiveXX.length);
console.log('ERR:', errs.length);
console.log();
for (const r of results) {
  const tag = (typeof r.status === 'number' && r.status >= 500) ? '!!' : (r.status === 'ERR' ? 'ER' : '  ');
  console.log(`${tag} ${String(r.status).padEnd(5)} ${r.label.padEnd(35)} ${r.body.slice(0, 100)}`);
}
console.log();
console.log('=== 5xx ===');
for (const r of fiveXX) console.log(`  ${r.status} ${r.method} ${r.path}\n    ${r.body}`);
console.log('=== ERR ===');
for (const r of errs) console.log(`  ${r.method} ${r.path}\n    ${r.body}`);

writeFileSync('.qa-uncovered-results.json', JSON.stringify(results, null, 2));
