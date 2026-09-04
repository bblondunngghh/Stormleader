// Run 124-s4 — VERIFY the two server fixes committed tonight.
//
//  43e843e  23502 (not_null_violation) -> 400 instead of 500.
//           Its commit message verified 11 pairs; the fix's own code comment says 13
//           columns are reachable and names contract_templates, which the message's
//           list omits. This harness covers ALL 13, so the two unverified ones
//           (contract_templates.name / .type) get a live result.
//
//  824ae24  jsonb `null` no longer wipes a NOT NULL line_items behind a 200,
//           with estimates.deposit exempted because the UI sends null to clear it.
//
// WRITE SAFETY: every expected-400 case fails before the UPDATE, so it writes nothing.
// The three expected-200 cases are IDENTITY writes — the value sent is the value already
// stored (read back first), so the row's data is unchanged. Row values are re-read and
// compared byte-for-byte at the end.
import fs from 'fs';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 120) }; }
  return { status: res.status, json };
}

const pick = (o) => {
  if (!o) return null;
  if (Array.isArray(o)) return o[0] || null;
  for (const k of Object.keys(o)) if (Array.isArray(o[k]) && o[k].length) return o[k][0];
  return null;
};

// entity -> [list path, patch path builder]
const ENT = {
  tasks:            { list: '/api/crm/tasks?limit=1',            patch: (id) => `/api/crm/tasks/${id}` },
  expenses:         { list: '/api/crm/expenses?limit=1',         patch: (id) => `/api/crm/expenses/${id}` },
  invoices:         { list: '/api/crm/invoices?limit=1',         patch: (id) => `/api/crm/invoices/${id}` },
  subcontractors:   { list: '/api/crm/subcontractors?limit=1',   patch: (id) => `/api/crm/subcontractors/${id}` },
  work_orders:      { list: '/api/crm/work-orders?limit=1',      patch: (id) => `/api/crm/work-orders/${id}` },
  contract_templates:{ list: '/api/crm/contracts/templates',     patch: (id) => `/api/crm/contracts/templates/${id}` },
  estimates:        { list: '/api/estimates?limit=1',            patch: (id) => `/api/estimates/${id}` },
};

const ids = {};
console.log('=== resolving one REAL id per entity (a dead uuid 404s before handler logic) ===');
for (const [name, cfg] of Object.entries(ENT)) {
  const r = await req('GET', cfg.list);
  const row = pick(r.json);
  ids[name] = row ? row.id : null;
  console.log(`  ${name.padEnd(19)} ${r.status}  ${ids[name] ? 'id ' + String(ids[name]).slice(0, 8) : 'NO ROW -> cannot test'}`);
}

// ---------------------------------------------------------------- 43e843e
// all 13 NOT NULL columns reachable from a client PATCH body
const NOTNULL = [
  ['tasks', 'title'], ['tasks', 'status'],
  ['expenses', 'category'], ['expenses', 'amount'], ['expenses', 'date'],
  ['invoices', 'subtotal'], ['invoices', 'total'],
  ['subcontractors', 'name'], ['subcontractors', 'specialty'], ['subcontractors', 'status'],
  ['work_orders', 'title'],
  ['contract_templates', 'name'], ['contract_templates', 'type'],   // <- never live-verified
];

console.log('\n=== 43e843e: PATCH {field: null} on a NOT NULL column -> expect 400, never 500 ===');
let pass = 0, fail = 0, skip = 0;
const failures = [];
for (const [ent, field] of NOTNULL) {
  if (!ids[ent]) { console.log(`  SKIP  ${ent}.${field} (no row)`); skip++; continue; }
  const r = await req('PATCH', ENT[ent].patch(ids[ent]), { [field]: null });
  const ok = r.status === 400;
  if (ok) pass++; else { fail++; failures.push(`${ent}.${field} -> ${r.status}`); }
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${(ent + '.' + field).padEnd(28)} ${r.status}  ${JSON.stringify(r.json).slice(0, 78)}`);
}

// ---------------------------------------------------------------- 824ae24
console.log('\n=== 824ae24: jsonb null must 400 (was a 200 that wiped the column) ===');
const JSONB = [
  ['estimates', 'line_items'], ['estimates', 'insurance_details'],
  ['invoices', 'line_items'], ['work_orders', 'line_items'],
];
for (const [ent, field] of JSONB) {
  if (!ids[ent]) { console.log(`  SKIP  ${ent}.${field} (no row)`); skip++; continue; }
  const r = await req('PATCH', ENT[ent].patch(ids[ent]), { [field]: null });
  const ok = r.status === 400;
  if (ok) pass++; else { fail++; failures.push(`jsonb ${ent}.${field} -> ${r.status}`); }
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${(ent + '.' + field).padEnd(28)} ${r.status}  ${JSON.stringify(r.json).slice(0, 78)}`);
}

// ---------------------------------------------------------------- the exemption + happy path
console.log('\n=== 824ae24: the deposit exemption and the happy path must still work ===');
const before = ids.estimates ? await req('GET', `/api/estimates/${ids.estimates}`) : null;
const est = before && (before.json.estimate || before.json);
const snapshot = est ? JSON.stringify({ li: est.line_items, dep: est.deposit, ins: est.insurance_details }) : null;

if (est) {
  // deposit is the one nullable column of the seven; EstimatesView sends null to clear it
  const r1 = await req('PATCH', `/api/estimates/${ids.estimates}`, { deposit: est.deposit ?? null });
  const ok1 = r1.status === 200;
  if (ok1) pass++; else { fail++; failures.push(`deposit:null -> ${r1.status}`); }
  console.log(`  ${ok1 ? 'PASS' : 'FAIL'}  estimates.deposit = ${JSON.stringify(est.deposit ?? null)} (identity)  ${r1.status}`);

  // identity write of the CURRENT line_items — proves a valid array still passes
  const r2 = await req('PATCH', `/api/estimates/${ids.estimates}`, { line_items: est.line_items || [] });
  const ok2 = r2.status === 200;
  if (ok2) pass++; else { fail++; failures.push(`line_items identity -> ${r2.status}`); }
  console.log(`  ${ok2 ? 'PASS' : 'FAIL'}  estimates.line_items identity write        ${r2.status}`);
}

// ---------------------------------------------------------------- prove nothing changed
const after = ids.estimates ? await req('GET', `/api/estimates/${ids.estimates}`) : null;
const est2 = after && (after.json.estimate || after.json);
const snapshot2 = est2 ? JSON.stringify({ li: est2.line_items, dep: est2.deposit, ins: est2.insurance_details }) : null;
console.log('\n=== write safety ===');
console.log('  estimate row byte-identical after all writes:', snapshot === snapshot2 ? 'YES' : 'NO  <-- INVESTIGATE');

console.log(`\nRESULT  pass ${pass}  fail ${fail}  skip ${skip}`);
if (failures.length) console.log('FAILURES:', failures.join(' | '));
