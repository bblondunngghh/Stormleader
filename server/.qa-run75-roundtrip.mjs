// Run 75 s1 — IDEMPOTENT ROUND-TRIP PATCH sweep.
// Premise: PATCHing a row with the values GET just returned must always succeed.
// If it 400s/500s, the read shape and the write contract disagree — that is exactly
// the "create coerces / update does not" family (8a45209, ea15a50), and it is
// user-facing because every edit form does GET -> edit one field -> PATCH the rest back.
//
// STRUCTURALLY UNABLE TO FIND: bugs needing >1 row, races, browser-only flows,
// and fields the client sends that GET never returns.
import fs from 'fs';
import pool from './src/db/pool.js';
import { req } from './.qa-r73-lib.mjs';

const SKIP = new Set(['id', 'tenant_id', 'created_at', 'updated_at', 'deleted_at', 'created_by']);

// [label, listPath, itemPath(id), patchPath(id), dbTable]
const ENTITIES = [
  ['leads', '/api/crm/leads', (i) => `/api/crm/leads/${i}`, (i) => `/api/crm/leads/${i}`, 'leads'],
  ['estimates', '/api/estimates', (i) => `/api/estimates/${i}`, (i) => `/api/estimates/${i}`, 'estimates'],
  ['invoices', '/api/crm/invoices', (i) => `/api/crm/invoices/${i}`, (i) => `/api/crm/invoices/${i}`, 'invoices'],
  ['work-orders', '/api/crm/work-orders', (i) => `/api/crm/work-orders/${i}`, (i) => `/api/crm/work-orders/${i}`, 'work_orders'],
  ['contracts', '/api/crm/contracts', (i) => `/api/crm/contracts/${i}`, (i) => `/api/crm/contracts/${i}`, 'contracts'],
  ['tasks', '/api/crm/tasks', (i) => `/api/crm/tasks/${i}`, (i) => `/api/crm/tasks/${i}`, 'tasks'],
  ['expenses', '/api/crm/expenses', (i) => `/api/crm/expenses/${i}`, (i) => `/api/crm/expenses/${i}`, 'expenses'],
  ['subcontractors', '/api/crm/subcontractors', (i) => `/api/crm/subcontractors/${i}`, (i) => `/api/crm/subcontractors/${i}`, 'subcontractors'],
  ['canvass-pins', '/api/crm/canvass-pins', (i) => null, (i) => `/api/crm/canvass-pins/${i}`, 'canvass_pins'],
  ['automations', '/api/crm/automations', (i) => null, (i) => `/api/crm/automations/${i}`, 'automations'],
  ['custom-fields', '/api/crm/custom-fields', (i) => null, (i) => `/api/crm/custom-fields/${i}`, 'custom_field_definitions'],
  ['financing-lenders', '/api/crm/financing/lenders', (i) => null, (i) => `/api/crm/financing/lenders/${i}`, 'financing_lenders'],
  ['financing-plans', '/api/crm/financing/plans', (i) => null, (i) => `/api/crm/financing/plans/${i}`, 'financing_plans'],
  ['contract-templates', '/api/crm/contracts/templates', (i) => null, (i) => `/api/crm/contracts/templates/${i}`, 'contract_templates'],
  ['estimate-templates', '/api/estimates/templates', (i) => null, (i) => `/api/estimates/templates/${i}`, 'estimate_templates'],
];

function firstItem(body) {
  if (!body || typeof body !== 'object') return null;
  const arrays = Array.isArray(body) ? [body] : Object.values(body).filter(Array.isArray);
  for (const arr of arrays) for (const el of arr) if (el && typeof el === 'object' && el.id) return el;
  return null;
}

const findings = [];
for (const [label, listPath, itemPath, patchPath, table] of ENTITIES) {
  const list = await req('GET', listPath);
  const item = firstItem(list.body);
  if (!item) { console.log(`${label.padEnd(20)} list=${list.status} NO ROWS — handler never exercised`); continue; }

  // prefer the detail view (richer shape) when the route exists
  let row = item;
  const ip = itemPath(item.id);
  if (ip) {
    const det = await req('GET', ip);
    if (det.status === 200 && det.body && typeof det.body === 'object') row = det.body.id ? det.body : (Object.values(det.body).find((v) => v && v.id) || row);
  }

  const before = await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [item.id]).then((r) => r.rows[0]).catch(() => null);

  // echo back every scalar/JSON field GET returned
  const payload = {};
  for (const [k, v] of Object.entries(row)) {
    if (SKIP.has(k)) continue;
    if (typeof v === 'function') continue;
    payload[k] = v;
  }

  const out = await req('PATCH', patchPath(item.id), payload);
  const ok = out.status >= 200 && out.status < 300;
  const bodyStr = typeof out.body === 'object' ? JSON.stringify(out.body) : String(out.body);
  console.log(`${label.padEnd(20)} PATCH ${out.status} ${ok ? 'OK' : '<<< ' + bodyStr.slice(0, 160)}  (${Object.keys(payload).length} fields)`);

  if (!ok) {
    findings.push({ label, id: item.id, status: out.status, body: bodyStr.slice(0, 300), fields: Object.keys(payload) });
  }

  // prove no data damage
  const after = await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [item.id]).then((r) => r.rows[0]).catch(() => null);
  if (before && after) {
    const changed = Object.keys(before).filter((k) => k !== 'updated_at' && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    if (changed.length) console.log(`    !! MUTATED: ${changed.join(',')}`);
  }
}

console.log('\n=== ROUND-TRIP FAILURES ===');
if (!findings.length) console.log('none');
findings.forEach((f) => console.log(JSON.stringify(f, null, 1)));
fs.writeFileSync('C:/tmp/roundtrip.json', JSON.stringify(findings, null, 1));
await pool.end();
