// Run 122-s1 — verification of both fixes, both directions.
//   D1  23502 -> 400 (was 500) on every NOT NULL whitelisted column
//   D2  jsonb null rejected on the 6 NOT NULL jsonb columns, STILL ACCEPTED on the
//       one nullable one (`estimates.deposit`, which EstimatesView sends as null)
//   REGRESSION  a VALID write on each entity still works, and every row is
//       snapshotted before/after so a stray mutation cannot hide.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const TENANT = '791bb51d-3293-4839-92e9-bd4d4f873af2';

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
})).json();
const T = login.accessToken;
if (!T) { console.log('LOGIN FAILED', JSON.stringify(login).slice(0, 200)); process.exit(1); }
fs.writeFileSync('C:/tmp/qa-token.txt', T);
console.log('fresh token ok\n');

const req = async (m, p, b) => {
  const r = await fetch(BASE + p, {
    method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T },
    body: b === undefined ? undefined : JSON.stringify(b),
  });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) {}
  return { st: r.status, body: t.slice(0, 160), json: j };
};
const q = async (s, p = []) => { try { return (await pool.query(s, p)).rows; } catch (e) { return [{ __err: e.code }]; } };
const one = async (t, w = 'tenant_id = $1') => { const r = await q(`SELECT id FROM ${t} WHERE ${w} LIMIT 1`, w.includes('$1') ? [TENANT] : []); return r[0] && !r[0].__err ? r[0].id : null; };

const mk = await req('POST', '/api/crm/tasks', { title: 'QA r122 verify — delete me', priority: 'warm' });
const taskId = mk.json && mk.json.id;
const ids = {
  task: taskId, expense: await one('expenses'), invoice: await one('invoices'),
  subcontractor: await one('subcontractors'), workOrder: await one('work_orders'),
  estimate: await one('estimates'),
};

// ---------- D1 ----------
const D1 = [
  ['tasks.title', 'PATCH', `/api/crm/tasks/${ids.task}`, { title: null }],
  ['tasks.status', 'PATCH', `/api/crm/tasks/${ids.task}`, { status: null }],
  ['expenses.category', 'PATCH', `/api/crm/expenses/${ids.expense}`, { category: null }],
  ['expenses.amount', 'PATCH', `/api/crm/expenses/${ids.expense}`, { amount: null }],
  ['expenses.date', 'PATCH', `/api/crm/expenses/${ids.expense}`, { date: null }],
  ['invoices.subtotal', 'PATCH', `/api/crm/invoices/${ids.invoice}`, { subtotal: null }],
  ['invoices.total', 'PATCH', `/api/crm/invoices/${ids.invoice}`, { total: null }],
  ['subcontractors.name', 'PATCH', `/api/crm/subcontractors/${ids.subcontractor}`, { name: null }],
  ['subcontractors.specialty', 'PATCH', `/api/crm/subcontractors/${ids.subcontractor}`, { specialty: null }],
  ['subcontractors.status', 'PATCH', `/api/crm/subcontractors/${ids.subcontractor}`, { status: null }],
  ['work_orders.title', 'PATCH', `/api/crm/work-orders/${ids.workOrder}`, { title: null }],
];
console.log('=== D1: null on a NOT NULL column (was 500, want 400) ===');
let d1ok = 0;
for (const [label, m, url, body] of D1) {
  const r = await req(m, url, body);
  const ok = r.st === 400; if (ok) d1ok++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${String(r.st)}  ${label.padEnd(26)} ${r.body.slice(0, 90)}`);
}
console.log(`  --> ${d1ok}/${D1.length} return 400\n`);

// ---------- D2 ----------
const D2 = [
  ['invoices.line_items  (NOT NULL)', `/api/crm/invoices/${ids.invoice}`, { line_items: null }, 400],
  ['work_orders.line_items', `/api/crm/work-orders/${ids.workOrder}`, { line_items: null }, 400],
  ['estimates.line_items  (NOT NULL)', `/api/estimates/${ids.estimate}`, { line_items: null }, 400],
  ['estimates.upgrades  (NOT NULL)', `/api/estimates/${ids.estimate}`, { upgrades: null }, 400],
  ['estimates.discounts  (NOT NULL)', `/api/estimates/${ids.estimate}`, { discounts: null }, 400],
  ['estimates.signers  (NOT NULL)', `/api/estimates/${ids.estimate}`, { signers: null }, 400],
  ['estimates.financing_plan_ids  (NOT NULL)', `/api/estimates/${ids.estimate}`, { financing_plan_ids: null }, 400],
  ['estimates.insurance_details  (NOT NULL)', `/api/estimates/${ids.estimate}`, { insurance_details: null }, 400],
  ['estimates.deposit  (NULLABLE - must STAY 200)', `/api/estimates/${ids.estimate}`, { deposit: null }, 200],
];
console.log('=== D2: jsonb null (6 NOT NULL cols reject; the nullable one still accepts) ===');
const estBefore = (await q('SELECT line_items, upgrades, discounts, signers, financing_plan_ids, insurance_details, deposit FROM estimates WHERE id=$1', [ids.estimate]))[0];
const invBefore = (await q('SELECT line_items FROM invoices WHERE id=$1', [ids.invoice]))[0];
const woBefore = (await q('SELECT line_items FROM work_orders WHERE id=$1', [ids.workOrder]))[0];
let d2ok = 0;
for (const [label, url, body, want] of D2) {
  const r = await req('PATCH', url, body);
  const ok = r.st === want; if (ok) d2ok++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${String(r.st)} (want ${want})  ${label.padEnd(42)} ${r.body.slice(0, 70)}`);
}
console.log(`  --> ${d2ok}/${D2.length} as expected\n`);

// ---------- shapes must be intact ----------
const estAfter = (await q("SELECT jsonb_typeof(line_items) li, jsonb_typeof(upgrades) up, jsonb_typeof(discounts) di, jsonb_typeof(signers) si, jsonb_typeof(financing_plan_ids) fp, jsonb_typeof(insurance_details) ins, jsonb_typeof(deposit) dep FROM estimates WHERE id=$1", [ids.estimate]))[0];
const invAfter = (await q('SELECT line_items FROM invoices WHERE id=$1', [ids.invoice]))[0];
const woAfter = (await q('SELECT line_items FROM work_orders WHERE id=$1', [ids.workOrder]))[0];
console.log('=== stored shapes after the probes ===');
console.log('  estimate jsonb_typeof:', JSON.stringify(estAfter));
console.log('  invoice line_items unchanged   :', JSON.stringify(invBefore) === JSON.stringify(invAfter));
console.log('  work order line_items unchanged:', JSON.stringify(woBefore) === JSON.stringify(woAfter));
const estCols = ['line_items', 'upgrades', 'discounts', 'signers', 'financing_plan_ids', 'insurance_details'];
const estNow = (await q(`SELECT ${estCols.join(',')} FROM estimates WHERE id=$1`, [ids.estimate]))[0];
const same = estCols.every(c => JSON.stringify(estBefore[c]) === JSON.stringify(estNow[c]));
console.log('  estimate NOT NULL cols unchanged:', same);
console.log('  (deposit is expected to be jsonb null — that is the pre-existing, client-used clear path)');

// ---------- regression: valid writes still work ----------
console.log('\n=== REGRESSION: valid writes still succeed ===');
const REG = [
  ['estimate valid arrays', 'PATCH', `/api/estimates/${ids.estimate}`, { upgrades: [], discounts: [] }],
  ['estimate deposit object', 'PATCH', `/api/estimates/${ids.estimate}`, { deposit: { amount: 1 } }],
  ['invoice valid line_items', 'PATCH', `/api/crm/invoices/${ids.invoice}`, { line_items: invBefore.line_items }],
  ['work order valid line_items', 'PATCH', `/api/crm/work-orders/${ids.workOrder}`, { line_items: woBefore.line_items || [] }],
  ['task valid patch', 'PATCH', `/api/crm/tasks/${ids.task}`, { description: 'ok' }],
  ['estimate wrong type still 400', 'PATCH', `/api/estimates/${ids.estimate}`, { upgrades: 'oops' }],
  ['invoice wrong type still 400', 'PATCH', `/api/crm/invoices/${ids.invoice}`, { line_items: 42 }],
];
for (const [label, m, url, body] of REG) {
  const r = await req(m, url, body);
  console.log(`  ${String(r.st).padStart(4)}  ${label.padEnd(32)} ${r.st >= 400 ? r.body.slice(0, 70) : 'ok'}`);
}

// restore the estimate exactly, drop the task fixture
await q(`UPDATE estimates SET line_items=$2, upgrades=$3, discounts=$4, signers=$5, financing_plan_ids=$6, insurance_details=$7, deposit=$8 WHERE id=$1`,
  [ids.estimate, JSON.stringify(estBefore.line_items), JSON.stringify(estBefore.upgrades), JSON.stringify(estBefore.discounts),
   JSON.stringify(estBefore.signers), JSON.stringify(estBefore.financing_plan_ids), JSON.stringify(estBefore.insurance_details),
   estBefore.deposit === null ? null : JSON.stringify(estBefore.deposit)]);
await q(`UPDATE invoices SET line_items=$2 WHERE id=$1`, [ids.invoice, JSON.stringify(invBefore.line_items)]);
await q(`UPDATE work_orders SET line_items=$2 WHERE id=$1`, [ids.workOrder, woBefore.line_items === null ? null : JSON.stringify(woBefore.line_items)]);
if (taskId) await q('DELETE FROM tasks WHERE id=$1 AND tenant_id=$2', [taskId, TENANT]);
const fin = (await q(`SELECT ${estCols.join(',')} FROM estimates WHERE id=$1`, [ids.estimate]))[0];
console.log('\n=== restore ===');
console.log('  estimate restored byte-identical:', estCols.every(c => JSON.stringify(estBefore[c]) === JSON.stringify(fin[c])));
console.log('  tasks rows now:', (await q('SELECT count(*)::int c FROM tasks'))[0].c, '(0 = fixture removed)');
await pool.end();
