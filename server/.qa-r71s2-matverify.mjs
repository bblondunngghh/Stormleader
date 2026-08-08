// Verify s1's uncommitted materials.js JSONB guards, live. REJECTION PATH ONLY —
// every probe below must 400, so no material_orders row is ever created.
import fs from 'fs';
const token = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const BASE = 'http://localhost:3001';

const shapes = [
  ['[null]', [null]],
  ['[null,{}]', [null, { quantity: 1, unit_price: 2 }]],
  ['["str"]', ['str']],
  ['[123]', [123]],
  ['[[1,2]]', [[1, 2]]],
  ['[true]', [true]],
  ['[undefined-as-null]', [null, null]],
];

let out = [];
for (const [label, items] of shapes) {
  const r = await fetch(`${BASE}/api/materials/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ items, branch_id: 'b1', branch_name: 'QA' }),
  });
  const body = await r.text();
  out.push(`POST /materials/orders items=${label.padEnd(20)} -> ${r.status} ${body.slice(0, 80)}`);
}

// auto-order path: read-back guard. Uses EST-082/EST-083 (known [null] line_items).
const est = await fetch(`${BASE}/api/estimates?limit=100`, { headers: { Authorization: `Bearer ${token}` } });
const ej = await est.json();
const list = ej.estimates || ej.data || ej || [];
const junk = (Array.isArray(list) ? list : []).filter(
  (e) => e.estimate_number === 'EST-082' || e.estimate_number === 'EST-083'
);
out.push(`\nfound ${junk.length} junk estimates for auto-order read-back test`);
for (const e of junk) {
  const r = await fetch(`${BASE}/api/materials/estimate/${e.id}/auto-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  const body = await r.text();
  out.push(`POST auto-order ${e.estimate_number} -> ${r.status} ${body.slice(0, 120)}`);
}

console.log(out.join('\n'));
