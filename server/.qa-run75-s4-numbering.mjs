// Run 75 s4 — RE-VERIFY 7c373fc (invoice/estimate number derived from MAX(suffix)+1,
// not COUNT(*)+1). Single-create probe: with 18 invoices whose max issued suffix is 19,
// COUNT(*)+1 => INV-0019 (collision with a LIVE invoice) while MAX+1 => INV-0020.
// One create distinguishes the two definitively. The probe row is deleted afterwards.
import pool from './src/db/pool.js';
import fs from 'fs';

const TENANT = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const API = 'http://localhost:3001';

const q = async (sql, params = []) => (await pool.query(sql, params)).rows;
const log = (...a) => console.log(...a);

// ---- 1. Pre-state -----------------------------------------------------------
const invState = (await q(
  `SELECT count(*)::int AS row_count,
          COALESCE(MAX(substring(invoice_number from '[0-9]+$')::int),0) AS max_seq
   FROM invoices WHERE tenant_id=$1`, [TENANT]))[0];
const estState = (await q(
  `SELECT count(*)::int AS row_count,
          COALESCE(MAX(substring(estimate_number from '[0-9]+$')::int),0) AS max_seq
   FROM estimates WHERE tenant_id=$1`, [TENANT]))[0];
log('PRE  invoices :', JSON.stringify(invState));
log('PRE  estimates:', JSON.stringify(estState));

const dupes = await q(
  `SELECT 'estimate' AS kind, estimate_number AS num, count(*)::int AS copies
     FROM estimates WHERE tenant_id=$1 GROUP BY 1,2 HAVING count(*)>1
   UNION ALL
   SELECT 'invoice', invoice_number, count(*)::int
     FROM invoices WHERE tenant_id=$1 GROUP BY 1,2 HAVING count(*)>1
   ORDER BY 1,2`, [TENANT]);
log('PRE  pre-existing duplicates:', JSON.stringify(dupes));

// ---- 2. Token (mint ONCE — login is rate limited) ---------------------------
const lr = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' })
});
const lj = await lr.json();
if (!lj.accessToken) { log('LOGIN FAILED', lr.status, JSON.stringify(lj).slice(0, 300)); process.exit(1); }
const T = lj.accessToken;
fs.writeFileSync('C:/tmp/qa-token.txt', T);
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${T}` };
log('token ok');

// ---- 3. Create ONE invoice, assert number, delete ---------------------------
const lead = (await q(`SELECT id FROM leads WHERE tenant_id=$1 LIMIT 1`, [TENANT]))[0];
const created = [];
let verdict = { invoice: 'NOT RUN', estimate: 'NOT RUN' };

const ir = await fetch(`${API}/api/crm/invoices`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ lead_id: lead.id, line_items: [], subtotal: 0, total: 0 })
});
const ij = await ir.json();
const invNum = ij?.invoice_number || ij?.data?.invoice_number;
const invId = ij?.id || ij?.data?.id;
log(`CREATE invoice -> ${ir.status} number=${invNum} id=${invId}`);
if (invNum) {
  const got = parseInt(invNum.match(/(\d+)$/)?.[1], 10);
  const expectFixed = invState.max_seq + 1;
  const expectBuggy = invState.row_count + 1;
  verdict.invoice = got === expectFixed
    ? `PASS (MAX+1 = ${expectFixed})`
    : (got === expectBuggy ? `FAIL — still COUNT(*)+1 (${expectBuggy})` : `UNEXPECTED ${got}, wanted ${expectFixed}`);
  log(`   expect MAX+1=${expectFixed}  buggy COUNT+1=${expectBuggy}  => ${verdict.invoice}`);
  if (invId) created.push(['invoices', invId]);
}

// ---- 4. Same for estimate ---------------------------------------------------
const er = await fetch(`${API}/api/crm/estimates`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ lead_id: lead.id, line_items: [], subtotal: 0, total: 0 })
});
const ej = await er.json();
const estNum = ej?.estimate_number || ej?.data?.estimate_number;
const estId = ej?.id || ej?.data?.id;
log(`CREATE estimate -> ${er.status} number=${estNum} id=${estId}`);
if (estNum) {
  const got = parseInt(estNum.match(/(\d+)$/)?.[1], 10);
  const expectFixed = estState.max_seq + 1;
  const expectBuggy = estState.row_count + 1;
  verdict.estimate = got === expectFixed
    ? `PASS (MAX+1 = ${expectFixed})`
    : (got === expectBuggy ? `FAIL — still COUNT(*)+1 (${expectBuggy})` : `UNEXPECTED ${got}, wanted ${expectFixed}`);
  log(`   expect MAX+1=${expectFixed}  buggy COUNT+1=${expectBuggy}  => ${verdict.estimate}`);
  if (estId) created.push(['estimates', estId]);
}

// ---- 5. Delete probe rows ---------------------------------------------------
for (const [tbl, id] of created) {
  await pool.query(`DELETE FROM ${tbl} WHERE id=$1 AND tenant_id=$2`, [id, TENANT]);
  log(`deleted ${tbl} ${id}`);
}

// ---- 6. Post-state must equal pre-state -------------------------------------
const invPost = (await q(`SELECT count(*)::int AS c FROM invoices WHERE tenant_id=$1`, [TENANT]))[0].c;
const estPost = (await q(`SELECT count(*)::int AS c FROM estimates WHERE tenant_id=$1`, [TENANT]))[0].c;
log(`POST invoices=${invPost} (pre ${invState.row_count})  estimates=${estPost} (pre ${estState.row_count})`);
log('NET DB DELTA:', invPost === invState.row_count && estPost === estState.row_count ? 'ZERO' : '*** NON-ZERO ***');
log('VERDICT:', JSON.stringify(verdict));
await pool.end();
