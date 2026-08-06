// R69 s1 — re-inject the exact junk via direct SQL, bypassing the now-fixed API,
// to prove the CLIENT guard independently (Run 68's method). Also used to clean up.
import pool from './src/db/pool.js';

const ID = '03206c8e-73cf-434e-abbf-f00b324c2097';
const mode = process.argv[2];

if (mode === 'inject') {
  await pool.query(
    `UPDATE custom_field_definitions
        SET options = $1::jsonb, field_type = 'select', field_label = 'QA Options Probe'
      WHERE id = $2`,
    [JSON.stringify('abcde'), ID]
  );
  const { rows } = await pool.query('SELECT field_label, field_type, options FROM custom_field_definitions WHERE id = $1', [ID]);
  console.log('injected:', JSON.stringify(rows[0]), '| options typeof =', typeof rows[0].options);
} else if (mode === 'cleanup') {
  const { rowCount } = await pool.query('DELETE FROM custom_field_definitions WHERE id = $1', [ID]);
  console.log('deleted rows:', rowCount);
  const { rows } = await pool.query(
    `SELECT id, field_label, field_type, options, jsonb_typeof(options) AS opt_type
       FROM custom_field_definitions
      WHERE options IS NOT NULL AND jsonb_typeof(options) <> 'array'`
  );
  console.log('remaining rows with a non-array options across ALL tenants:', rows.length);
  for (const r of rows) console.log('  ', r.id, r.field_label, r.opt_type, JSON.stringify(r.options));
} else {
  // audit only
  const { rows } = await pool.query(
    `SELECT id, tenant_id, field_label, field_type, jsonb_typeof(options) AS opt_type, options
       FROM custom_field_definitions WHERE options IS NOT NULL`
  );
  console.log('custom fields with options set:', rows.length);
  for (const r of rows) console.log('  ', r.opt_type.padEnd(7), r.field_type.padEnd(8), r.field_label, JSON.stringify(r.options).slice(0, 60));
}
await pool.end();
