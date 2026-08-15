import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';

const { rows: inv } = await pool.query(
  `SELECT COUNT(*) AS old_count_plus1_src,
          COALESCE(MAX(substring(invoice_number from '[0-9]+$')::int), 0) AS new_max_seq
   FROM invoices WHERE tenant_id = $1`, [T]);
console.log('INVOICES  old COUNT(*)+1 =>', parseInt(inv[0].old_count_plus1_src) + 1,
            ' | new MAX+1 =>', parseInt(inv[0].new_max_seq) + 1);

const { rows: est } = await pool.query(
  `SELECT COUNT(*) AS old_count_plus1_src,
          COALESCE(MAX(substring(estimate_number from '[0-9]+$')::int), 0) AS new_max_seq
   FROM estimates WHERE tenant_id = $1`, [T]);
console.log('ESTIMATES old COUNT(*)+1 =>', parseInt(est[0].old_count_plus1_src) + 1,
            ' | new MAX+1 =>', parseInt(est[0].new_max_seq) + 1);

// Does the proposed number already exist? That is the whole point.
const check = async (tbl, col, val) => {
  const { rows } = await pool.query(
    `SELECT count(*) AS hits FROM ${tbl} WHERE tenant_id=$1 AND ${col}=$2`, [T, val]);
  console.log(`  collision check ${tbl}.${col}='${val}' -> existing rows: ${rows[0].hits}`);
};
await check('invoices', 'invoice_number', `INV-${String(parseInt(inv[0].old_count_plus1_src) + 1).padStart(4, '0')}`);
await check('invoices', 'invoice_number', `INV-${String(parseInt(inv[0].new_max_seq) + 1).padStart(4, '0')}`);
await check('estimates', 'estimate_number', `EST-${String(parseInt(est[0].old_count_plus1_src) + 1).padStart(3, '0')}`);
await check('estimates', 'estimate_number', `EST-${String(parseInt(est[0].new_max_seq) + 1).padStart(3, '0')}`);

// Guard: any row whose number has no numeric suffix would make substring() NULL.
const { rows: bad } = await pool.query(
  `SELECT count(*) AS n FROM invoices WHERE tenant_id=$1 AND substring(invoice_number from '[0-9]+$') IS NULL`, [T]);
const { rows: bad2 } = await pool.query(
  `SELECT count(*) AS n FROM estimates WHERE tenant_id=$1 AND substring(estimate_number from '[0-9]+$') IS NULL`, [T]);
console.log('rows with unparseable number (ignored by MAX, safe):', 'invoices=' + bad[0].n, 'estimates=' + bad2[0].n);

await pool.end();
