// Run 75 s1 — the DELETE-THEN-CREATE regression case, the exact condition that made
// COUNT(*)+1 re-issue a live invoice number. Net 0 rows: every row created is deleted.
import pool from './src/db/pool.js';
import { req, mint } from './.qa-r73-lib.mjs';

const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
await mint();
const { rows: leadRows } = await pool.query(`SELECT id FROM leads WHERE tenant_id=$1 LIMIT 1`, [T]);
const LEAD = leadRows[0].id;

const mk = (n) => req('POST', '/api/crm/invoices', { lead_id: LEAD, notes: `QA75 regress ${n}`, total: 0 });
const numOf = async (num) => (await pool.query(
  `SELECT count(*) AS c FROM invoices WHERE tenant_id=$1 AND invoice_number=$2`, [T, num])).rows[0].c;

const made = [];
console.log('start count:', (await pool.query(`SELECT count(*) AS c FROM invoices WHERE tenant_id=$1`, [T])).rows[0].c);

// 1. create A
const a = await mk('A');
made.push(a.body.id);
console.log('created A ->', a.body.invoice_number);

// 2. create B
const b = await mk('B');
made.push(b.body.id);
console.log('created B ->', b.body.invoice_number);

// 3. delete A  (count drops; COUNT(*)+1 now points back at B's number)
await pool.query(`DELETE FROM invoices WHERE id=$1`, [a.body.id]);
made.splice(made.indexOf(a.body.id), 1);
console.log(`deleted A (${a.body.invoice_number}) — COUNT(*)+1 would now re-issue ${b.body.invoice_number}, which is LIVE`);

// 4. create C — must NOT collide with B
const c = await mk('C');
made.push(c.body.id);
console.log('created C ->', c.body.invoice_number);
const collide = c.body.invoice_number === b.body.invoice_number;
console.log('  C vs live B:', collide ? '*** COLLISION — FIX FAILED ***' : 'distinct — FIX HOLDS');
console.log('  rows holding C number:', await numOf(c.body.invoice_number));

// cleanup
for (const id of made) await pool.query(`DELETE FROM invoices WHERE id=$1`, [id]);
console.log('\ncleanup: deleted', made.length, 'invoice(s)');
console.log('end count:', (await pool.query(`SELECT count(*) AS c FROM invoices WHERE tenant_id=$1`, [T])).rows[0].c, '(expected 18)');
const { rows: d } = await pool.query(
  `SELECT invoice_number, count(*) FROM invoices WHERE tenant_id=$1 GROUP BY 1 HAVING count(*)>1`, [T]);
console.log('duplicate invoice numbers remaining:', d.length ? JSON.stringify(d) : 'none');
await pool.end();
