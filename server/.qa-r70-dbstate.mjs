// R70 s4-verify — Are the malformed rows the Run 69 render guards defend against STILL PRESENT?
// If a later stage cleaned them, re-running the render test proves nothing: the guard is never exercised.
import pool from './src/db/pool.js';

const out = {};

// 1. custom_field_definitions.options — d575bf7 (LeadDetail) + 447aabd (SettingsView) guard this
const cf = await pool.query(`
  SELECT id, tenant_id, entity_type, field_key, field_label, field_type,
         options, jsonb_typeof(to_jsonb(options)) AS opt_json_type,
         pg_typeof(options)::text AS opt_pg_type
  FROM custom_field_definitions
  ORDER BY created_at DESC NULLS LAST`);
out.custom_fields = cf.rows;

// 2. invoices.line_items containing a null element — 17fa0dc guards this
const inv = await pool.query(`
  SELECT id, invoice_number, status, line_items,
         jsonb_array_length(line_items) AS n
  FROM invoices
  WHERE jsonb_typeof(line_items) = 'array'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(line_items) e
      WHERE jsonb_typeof(e) <> 'object')
  ORDER BY created_at DESC`);
out.invoices_with_bad_line_items = inv.rows;

// 3. estimates with fractional cents — b7775a8 (formatCurrency) is visible only on these
const est = await pool.query(`
  SELECT count(*) FILTER (WHERE total::numeric <> trunc(total::numeric)) AS fractional,
         count(*) AS total_rows,
         count(*) FILTER (WHERE (total::numeric * 100)::bigint % 10 = 0
                            AND total::numeric <> trunc(total::numeric)) AS ends_in_zero_cent
  FROM estimates`);
out.estimates = est.rows[0];

// a concrete example that would render wrong pre-fix (x.x0 -> drops the trailing 0)
const estEx = await pool.query(`
  SELECT estimate_number, total FROM estimates
  WHERE (total::numeric * 100)::bigint % 10 = 0 AND total::numeric <> trunc(total::numeric)
  ORDER BY total::numeric DESC LIMIT 5`);
out.estimate_examples = estEx.rows;

console.log(JSON.stringify(out, null, 1));
await pool.end();
