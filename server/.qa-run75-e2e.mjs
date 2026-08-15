// Run 75 s1 — end-to-end proof of the duplicate-number fix.
// Creates 1 invoice + 1 estimate through the real API, asserts the issued number does
// not collide, then DELETES both rows. Net 0 rows written (Neon free tier).
import pool from './src/db/pool.js';
import { req, mint } from './.qa-r73-lib.mjs';

const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
await mint(); // new server instance => new in-memory JWT secret

const dupes = async (tbl, col) => {
  const { rows } = await pool.query(
    `SELECT ${col} AS num, count(*) AS c FROM ${tbl} WHERE tenant_id=$1
     GROUP BY ${col} HAVING count(*)>1 ORDER BY ${col}`, [T]);
  return rows.map(r => `${r.num}x${r.c}`).join(',') || 'none';
};

console.log('BEFORE dupes invoices :', await dupes('invoices', 'invoice_number'));
console.log('BEFORE dupes estimates:', await dupes('estimates', 'estimate_number'));

const created = { invoices: [], estimates: [] };

const { rows: leadRows } = await pool.query(`SELECT id FROM leads WHERE tenant_id=$1 LIMIT 1`, [T]);
const LEAD = leadRows[0].id;
console.log('using lead_id', LEAD);

// ---- INVOICE ----
const invRes = await req('POST', '/api/crm/invoices', { lead_id: LEAD, notes: 'QA75 numbering probe', total: 0 });
console.log('\nPOST /api/crm/invoices ->', invRes.status);
if (invRes.status >= 200 && invRes.status < 300) {
  const inv = invRes.body;
  created.invoices.push(inv.id);
  console.log('  issued invoice_number =', inv.invoice_number, '(expected INV-0020, old logic would have given INV-0019)');
  const { rows } = await pool.query(
    `SELECT count(*) AS c FROM invoices WHERE tenant_id=$1 AND invoice_number=$2`, [T, inv.invoice_number]);
  console.log('  rows now holding that number:', rows[0].c, rows[0].c === '1' ? 'UNIQUE OK' : '*** COLLISION ***');
} else {
  console.log('  body:', JSON.stringify(invRes.body).slice(0, 300));
}

// ---- ESTIMATE ----
const estRes = await req('POST', '/api/estimates', { lead_id: LEAD, customer_name: 'QA75 numbering probe', line_items: [] });
console.log('\nPOST /api/estimates ->', estRes.status);
if (estRes.status >= 200 && estRes.status < 300) {
  const est = estRes.body;
  created.estimates.push(est.id);
  console.log('  issued estimate_number =', est.estimate_number, '(expected EST-084)');
  const { rows } = await pool.query(
    `SELECT count(*) AS c FROM estimates WHERE tenant_id=$1 AND estimate_number=$2`, [T, est.estimate_number]);
  console.log('  rows now holding that number:', rows[0].c, rows[0].c === '1' ? 'UNIQUE OK' : '*** COLLISION ***');
} else {
  console.log('  body:', JSON.stringify(estRes.body).slice(0, 300));
}

// ---- REGRESSION: the delete-then-create case that caused the original bug ----
// Delete the invoice we just made, then create another. Old logic would re-issue the
// number of a still-existing invoice; new logic must keep climbing.
if (created.invoices.length) {
  await pool.query(`DELETE FROM invoices WHERE id=$1`, [created.invoices[0]]);
  created.invoices.length = 0;
  console.log('\n[deleted the probe invoice — this is exactly the condition that broke COUNT(*)+1]');
  const r2 = await req('POST', '/api/crm/invoices', { notes: 'QA75 numbering probe 2', total: 0 });
  if (r2.status >= 200 && r2.status < 300) {
    created.invoices.push(r2.body.id);
    console.log('POST after delete -> issued', r2.body.invoice_number);
    const { rows } = await pool.query(
      `SELECT count(*) AS c FROM invoices WHERE tenant_id=$1 AND invoice_number=$2`, [T, r2.body.invoice_number]);
    console.log('  rows holding it:', rows[0].c, rows[0].c === '1' ? 'UNIQUE OK — regression case passes' : '*** COLLISION ***');
  } else {
    console.log('POST after delete ->', r2.status, JSON.stringify(r2.body).slice(0, 200));
  }
}

// ---- CLEANUP: remove every row this probe created ----
for (const id of created.invoices) await pool.query(`DELETE FROM invoices WHERE id=$1`, [id]);
for (const id of created.estimates) await pool.query(`DELETE FROM estimates WHERE id=$1`, [id]);
console.log('\ncleanup: deleted', created.invoices.length, 'invoice(s),', created.estimates.length, 'estimate(s)');

const { rows: ci } = await pool.query(`SELECT count(*) AS c FROM invoices WHERE tenant_id=$1`, [T]);
const { rows: ce } = await pool.query(`SELECT count(*) AS c FROM estimates WHERE tenant_id=$1`, [T]);
console.log('final counts — invoices:', ci[0].c, '(expected 18)  estimates:', ce[0].c, '(expected 83)');
console.log('AFTER dupes invoices :', await dupes('invoices', 'invoice_number'));
console.log('AFTER dupes estimates:', await dupes('estimates', 'estimate_number'));

await pool.end();
