// Run 75 s1 — duplicate document-number probe.
// Surfaced incidentally: EST-021 and EST-022 each appear twice in the live tenant.
// Hypothesis: createEstimate/createInvoice/createWorkOrder derive the human-facing
// number from COUNT(*)+1, which collides whenever any earlier row is deleted
// (and races under concurrency).
import pool from './src/db/pool.js';

const q = async (label, sql) => {
  const { rows } = await pool.query(sql);
  console.log(`\n== ${label} ==`);
  console.log(JSON.stringify(rows, null, 1).slice(0, 2000));
  return rows;
};

await q('DUPLICATE estimate_number in live tenant',
  `SELECT estimate_number, count(*) AS copies, array_agg(created_at::date ORDER BY created_at) AS created
   FROM estimates WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'
   GROUP BY estimate_number HAVING count(*) > 1 ORDER BY estimate_number`);

await q('DUPLICATE invoice_number in live tenant',
  `SELECT invoice_number, count(*) AS copies, array_agg(created_at::date ORDER BY created_at) AS created
   FROM invoices WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'
   GROUP BY invoice_number HAVING count(*) > 1 ORDER BY invoice_number`);

await q('estimates: count vs max number (gap proves deletes happened)',
  `SELECT count(*) AS row_count,
          max(substring(estimate_number from '[0-9]+$')::int) AS max_seq
   FROM estimates WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'`);

await q('invoices: count vs max number',
  `SELECT count(*) AS row_count,
          max(substring(invoice_number from '[0-9]+$')::int) AS max_seq
   FROM invoices WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2'`);

await q('is there a UNIQUE constraint on these number columns?',
  `SELECT t.relname AS table_name, i.relname AS index_name, ix.indisunique AS is_unique,
          array_agg(a.attname) AS cols
   FROM pg_index ix
   JOIN pg_class i ON i.oid = ix.indexrelid
   JOIN pg_class t ON t.oid = ix.indrelid
   JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
   WHERE t.relname IN ('estimates','invoices','work_orders','contracts')
     AND a.attname IN ('estimate_number','invoice_number','work_order_number','contract_number')
   GROUP BY t.relname, i.relname, ix.indisunique`);

await pool.end();
