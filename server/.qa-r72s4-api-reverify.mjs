// Run 72 / s4-verify — re-verify the three API fixes committed this run.
//   86eb187  work-order PDF 500 on a null element inside line_items
//   81d0cab  work-order + invoice line_items accepted ANY shape into JSONB
//   629e073  invoice payment discarded method + reference
// DB COST RULE: every write targets a row that ALREADY holds the value we write
// back, or is snapshotted and restored. Net-zero new rows.
import { GET, POST, PATCH, snip, rows } from './.qa-r71-lib.mjs';
import pool from './src/db/pool.js';

const out = [];
const log = (s) => { out.push(s); console.log(s); };
let pass = 0, fail = 0;
const chk = (ok, label, detail = '') => {
  if (ok) { pass++; log(`  PASS  ${label}${detail ? '  ' + detail : ''}`); }
  else { fail++; log(`  FAIL  ${label}${detail ? '  ' + detail : ''}`); }
};

// ---------------------------------------------------------------- 86eb187
log('\n=== 86eb187  work-order PDF must not 500 on [null] line_items ===');
const woList = rows((await GET('/api/crm/work-orders?limit=200')).body);
log(`  ${woList.length} work orders`);
const pdfCodes = {};
const pdfFails = [];
for (const wo of woList) {
  const r = await GET(`/api/crm/work-orders/${wo.id}/pdf`);
  pdfCodes[r.status] = (pdfCodes[r.status] || 0) + 1;
  if (r.status >= 500) pdfFails.push(`${wo.id} ${wo.title || ''} -> ${r.status} ${snip(r.body, 80)}`);
}
log(`  PDF status histogram: ${JSON.stringify(pdfCodes)}`);
chk(pdfFails.length === 0, `0 5xx across ${woList.length} work-order PDFs`, pdfFails.join(' | '));

// the two rows the fix was written for must still hold their malformed shape
const { rows: badWo } = await pool.query(
  `SELECT id, title, line_items::text AS li FROM work_orders
   WHERE jsonb_typeof(line_items)='array' AND line_items @> '[null]'::jsonb`);
log(`  rows still holding a null element: ${badWo.length}`);
for (const b of badWo) {
  const r = await GET(`/api/crm/work-orders/${b.id}/pdf`);
  chk(r.status === 200, `malformed row ${b.title} PDF`, `${r.status}, li=${b.li}`);
}
chk(badWo.length > 0, 'guard is still exercised by real malformed data in the DB');

// ---------------------------------------------------------------- 81d0cab
log('\n=== 81d0cab  line_items JSONB container guard (work-orders + invoices) ===');
const BAD = [{ n: 'string', v: 'a string' }, { n: 'object', v: { a: 1 } }, { n: 'number', v: 12345 }, { n: 'bool', v: true }];

async function probeShapes(kind, path, table, id, label) {
  const before = (await pool.query(`SELECT line_items::text AS li FROM ${table} WHERE id=$1`, [id])).rows[0].li;
  for (const b of BAD) {
    const r = await PATCH(`${path}/${id}`, { line_items: b.v });
    const after = (await pool.query(`SELECT line_items::text AS li FROM ${table} WHERE id=$1`, [id])).rows[0].li;
    chk(r.status === 400 && after === before, `${label} PATCH line_items=${b.n}`,
      `${r.status} ${snip(r.body, 60)} stored=${after === before ? 'UNCHANGED' : 'MUTATED -> ' + after}`);
  }
  // half (b): the happy path must still write
  const good = [{ description: 'QA r72s4 verify', quantity: 3, unit_price: 125.5 }];
  const gr = await PATCH(`${path}/${id}`, { line_items: good });
  const stored = (await pool.query(`SELECT line_items::text AS li FROM ${table} WHERE id=$1`, [id])).rows[0].li;
  const ok = gr.status === 200 && stored.includes('QA r72s4 verify') && stored.includes('125.5');
  chk(ok, `${label} PATCH valid array still writes`, `${gr.status} stored=${snip(stored, 90)}`);
  // restore
  await pool.query(`UPDATE ${table} SET line_items=$2::jsonb WHERE id=$1`, [id, before]);
  const restored = (await pool.query(`SELECT line_items::text AS li FROM ${table} WHERE id=$1`, [id])).rows[0].li;
  chk(restored === before, `${label} row restored`, `${restored}`);
  // POST guard — bad shape must 400 so NO row is created (zero DB cost)
  for (const b of BAD) {
    const r = await POST(path, { lead_id: '00000000-0000-4000-8000-000000000000', line_items: b.v });
    chk(r.status === 400, `${label} POST line_items=${b.n} rejected`, `${r.status} ${snip(r.body, 60)}`);
  }
}

const woTarget = badWo[0]?.id || woList[0]?.id;
await probeShapes('wo', '/api/crm/work-orders', 'work_orders', woTarget, 'work-order');

const { rows: badInv } = await pool.query(
  `SELECT id, invoice_number FROM invoices
   WHERE jsonb_typeof(line_items)='array' AND line_items @> '[null]'::jsonb LIMIT 1`);
const invList = rows((await GET('/api/crm/invoices?limit=200')).body);
const invTarget = badInv[0]?.id || invList[0]?.id;
await probeShapes('inv', '/api/crm/invoices', 'invoices', invTarget, 'invoice');

// estimates control — the precedent guard must still hold
const estList = rows((await GET('/api/crm/estimates?limit=5')).body);
if (estList[0]) {
  const r = await PATCH(`/api/crm/estimates/${estList[0].id}`, { line_items: 'a string' });
  chk(r.status === 400, 'estimates control still 400s', `${r.status}`);
}

// ---------------------------------------------------------------- 629e073
log('\n=== 629e073  invoice payment stores method + reference ===');
const { rows: cols } = await pool.query(
  `SELECT column_name, data_type, is_nullable FROM information_schema.columns
   WHERE table_name='invoices' AND column_name IN ('payment_method','payment_reference')
   ORDER BY column_name`);
chk(cols.length === 2, 'both columns exist and are nullable',
  cols.map(c => `${c.column_name}:${c.data_type}/null=${c.is_nullable}`).join(' '));

const payTarget = invList.find(i => i.invoice_number === 'INV-0007') || invList[0];
const snap = (await pool.query(
  `SELECT amount_paid, status, paid_at, payment_method, payment_reference FROM invoices WHERE id=$1`,
  [payTarget.id])).rows[0];
log(`  target ${payTarget.invoice_number} before: ${JSON.stringify(snap)}`);

const REF = 'CHK-R72S4-9911';
const pr = await POST(`/api/crm/invoices/${payTarget.id}/payment`,
  { amount: 1, payment_method: 'check', reference: `  ${REF}  ` });
const afterPay = (await pool.query(
  `SELECT amount_paid, payment_method, payment_reference FROM invoices WHERE id=$1`, [payTarget.id])).rows[0];
chk(pr.status === 200 && afterPay.payment_method === 'check' && afterPay.payment_reference === REF,
  'payment persists method + trimmed reference', `${pr.status} ${JSON.stringify(afterPay)}`);
chk(Number(afterPay.amount_paid) === Number(snap.amount_paid) + 1,
  'amount_paid still increments', `${snap.amount_paid} -> ${afterPay.amount_paid}`);

// COALESCE: a later payment omitting the method must KEEP the previous one
const pr2 = await POST(`/api/crm/invoices/${payTarget.id}/payment`, { amount: 1 });
const afterPay2 = (await pool.query(
  `SELECT payment_method, payment_reference FROM invoices WHERE id=$1`, [payTarget.id])).rows[0];
chk(pr2.status === 200 && afterPay2.payment_method === 'check' && afterPay2.payment_reference === REF,
  'COALESCE keeps last method when omitted', JSON.stringify(afterPay2));

// whitelist
const badM = await POST(`/api/crm/invoices/${payTarget.id}/payment`, { amount: 1, payment_method: 'bitcoin' });
chk(badM.status === 400, 'unknown payment method rejected', `${badM.status} ${snip(badM.body, 60)}`);
const objM = await POST(`/api/crm/invoices/${payTarget.id}/payment`, { amount: 1, payment_method: { a: 1 } });
chk(objM.status === 400, 'object payment method rejected', `${objM.status} ${snip(objM.body, 60)}`);
const objR = await POST(`/api/crm/invoices/${payTarget.id}/payment`, { amount: 1, payment_method: 'cash', reference: { a: 1 } });
const afterObjR = (await pool.query(`SELECT payment_reference FROM invoices WHERE id=$1`, [payTarget.id])).rows[0];
chk(afterObjR.payment_reference === REF, 'object reference cannot poison the column',
  `${objR.status} stored=${afterObjR.payment_reference}`);
const longR = await POST(`/api/crm/invoices/${payTarget.id}/payment`, { amount: 1, payment_method: 'cash', reference: 'x'.repeat(500) });
const afterLong = (await pool.query(`SELECT payment_reference FROM invoices WHERE id=$1`, [payTarget.id])).rows[0];
chk(afterLong.payment_reference.length === 200, 'reference capped at 200 chars',
  `${longR.status} len=${afterLong.payment_reference.length}`);

// restore the invoice completely
await pool.query(
  `UPDATE invoices SET amount_paid=$2, status=$3, paid_at=$4, payment_method=$5, payment_reference=$6 WHERE id=$1`,
  [payTarget.id, snap.amount_paid, snap.status, snap.paid_at, snap.payment_method, snap.payment_reference]);
const restored = (await pool.query(
  `SELECT amount_paid, status, payment_method, payment_reference FROM invoices WHERE id=$1`, [payTarget.id])).rows[0];
chk(String(restored.amount_paid) === String(snap.amount_paid) && restored.payment_method === snap.payment_method,
  'invoice restored to snapshot', JSON.stringify(restored));

log(`\n===== ${pass} PASS / ${fail} FAIL =====`);
const fs = await import('fs');
fs.writeFileSync('C:/tmp/r72s4-api-reverify.txt', out.join('\n'));
await pool.end();
process.exit(fail ? 1 : 0);
