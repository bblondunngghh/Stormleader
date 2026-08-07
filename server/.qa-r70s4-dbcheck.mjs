import pool from './src/db/pool.js';
const q = async (label, sql, params=[]) => {
  const r = await pool.query(sql, params);
  console.log('=== ' + label + ' ===');
  console.log(JSON.stringify(r.rows, null, 1).slice(0, 1500));
};
await q('malformed line_items still present', `SELECT estimate_number, line_items FROM estimates WHERE estimate_number IN ('EST-083','EST-082') ORDER BY estimate_number DESC`);
await q('valid_until null count', `SELECT count(*) FILTER (WHERE valid_until IS NULL) AS nulls, count(*) AS total FROM estimates`);
await q('invoices with [null] line_items', `SELECT invoice_number, line_items FROM invoices WHERE jsonb_typeof(line_items)='array' AND line_items @> '[null]'::jsonb`);
await q('financing_applications amount col', `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='financing_applications' AND column_name IN ('amount','estimate_id')`);
await q('custom field options probe', `SELECT field_key, options FROM custom_field_definitions WHERE field_key LIKE 'qa%'`);
await pool.end();
