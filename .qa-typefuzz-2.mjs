// Wider type-fuzz probe — POST/PATCH endpoints with malformed array/object fields
// that might crash internal helper code (similar to the estimates line_items bug).

import { readFileSync } from 'node:fs';

const API = 'http://localhost:3001';
const ZERO = '00000000-0000-0000-0000-000000000000';
const token = readFileSync('/tmp/qa-token.txt', 'utf8').trim();
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const tests = [
  // Estimates again with valid lead_id-less paths
  ['POST', '/api/estimates', { lead_id: ZERO, line_items: [{ quantity: 'x', unit_price: 'y' }], tax_rate: 'abc' }],
  ['POST', '/api/estimates', { lead_id: ZERO, line_items: [{ quantity: Infinity }] }],
  // PATCH estimates - line_items malformed
  ['PATCH', `/api/estimates/${ZERO}`, { line_items: [null, '', 1] }],
  ['PATCH', `/api/estimates/${ZERO}`, { line_items: 'notanarray' }],
  ['PATCH', `/api/estimates/${ZERO}`, { line_items: { not: 'an array' } }],

  // Invoices - line_items?
  ['POST', '/api/crm/invoices', { lead_id: ZERO, line_items: [null, '', 1] }],
  ['POST', '/api/crm/invoices', { lead_id: ZERO, line_items: 'string' }],
  ['POST', '/api/crm/invoices', { lead_id: ZERO, line_items: [{ quantity: null }] }],

  // Contracts - array body?
  ['POST', '/api/crm/contracts', { lead_id: ZERO, title: 'X', content: 'X', recipients: 'notanarray' }],
  ['POST', '/api/crm/contracts', { lead_id: ZERO, title: 'X', content: 'X', recipients: [null] }],

  // Activities
  ['POST', '/api/crm/activities', { lead_id: ZERO, type: null, direction: null }],
  ['POST', '/api/crm/activities', { lead_id: ZERO, follow_up_date: '{}' }],

  // Drip - bad arrays
  ['POST', '/api/crm/drip-sequences', { name: 'X', steps: 'notanarray' }],
  ['POST', '/api/crm/drip-sequences', { name: 'X', steps: [null, '', 1] }],
  ['POST', '/api/crm/drip-sequences', { name: 'X', steps: [{ delay_days: 'x' }] }],

  // Automations
  ['POST', '/api/crm/automations', { name: 'X', trigger: null, actions: 'notanarray' }],
  ['POST', '/api/crm/automations', { name: 'X', trigger: { type: 'invalid' }, actions: [null] }],

  // Work orders
  ['POST', '/api/crm/work-orders', { lead_id: ZERO, milestones: 'notanarray' }],
  ['POST', '/api/crm/work-orders', { lead_id: ZERO, milestones: [null, '', 1] }],

  // Materials estimate generate-tiers or auto-order
  ['POST', `/api/estimates/${ZERO}/generate-tiers`, { tiers: 'notanarray' }],
  ['POST', `/api/estimates/${ZERO}/generate-tiers`, { tiers: [null] }],

  // Properties weird stuff (avoid FEMA, avoid bulk)
  ['POST', '/api/data/optimize-route', { origin: { lat: 'abc', lng: 'def' }, stops: [{ lat: 1 }, { lat: 2 }] }],
  ['POST', '/api/data/optimize-route', { origin: null, stops: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }] }],
  ['POST', '/api/data/optimize-route', { origin: { lat: 40, lng: -95 }, stops: [null, null] }],
  ['POST', '/api/data/optimize-route', { origin: { lat: 40, lng: -95 }, stops: [{ lat: 'x', lng: 'y' }] }],

  // Tax stuff in estimates - mixing values
  ['POST', '/api/estimates', { lead_id: ZERO, line_items: [{ quantity: 1, unit_price: 1 }], discount_type: { junk: 1 }, discount_value: { junk: 1 } }],

  // Lead create with junk arrays
  ['POST', '/api/crm/leads', { propertyId: ZERO, tags: 'notanarray', stage: { junk: 1 } }],
  ['POST', '/api/crm/leads', { propertyId: ZERO, tags: [null] }],

  // CSV-like - search query with junk
  ['GET', '/api/search?q=' + encodeURIComponent('a'.repeat(10000))],
];

const results = [];
for (const [m, p, b] of tests) {
  const opts = { method: m, headers: b !== undefined ? auth : { Authorization: `Bearer ${token}` } };
  if (b !== undefined) opts.body = JSON.stringify(b);
  try {
    const r = await fetch(API + p, opts);
    const t = (await r.text()).slice(0, 150);
    results.push({ status: r.status, method: m, path: p, body: t });
  } catch (e) {
    results.push({ status: 'ERR', method: m, path: p, body: String(e) });
  }
}

const crashes = results.filter(r => typeof r.status === 'number' && r.status >= 500);
console.log('Total:', results.length, '5xx:', crashes.length);
console.log();
for (const r of results) {
  const tag = (typeof r.status === 'number' && r.status >= 500) ? '!!' : '  ';
  console.log(`${tag} ${String(r.status).padEnd(5)} ${r.method.padEnd(6)} ${r.path.slice(0, 60).padEnd(60)} ${r.body.slice(0, 80)}`);
}
console.log();
console.log('=== 5xx ===');
for (const r of crashes) console.log(`  ${r.status} ${r.method} ${r.path}\n    ${r.body}`);
