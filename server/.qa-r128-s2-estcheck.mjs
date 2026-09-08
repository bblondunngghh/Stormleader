// Run 128 (s2) — READ-ONLY: identify the estimate row touched by the autosave repro and
// show the fields that could have been written, so the revert is scoped to real damage.
import pool from './src/db/pool.js';

const { rows } = await pool.query(
  `SELECT id, estimate_number, customer_name, customer_address, customer_phone, customer_email,
          estimate_name, scope_of_work, terms, warranty_info, notes, inspection_notes,
          introduction, valid_until, tax_rate, profit_margin, footer_notes,
          discounts, signers, upgrades, deposit, insurance_details,
          financing_enabled, financing_plan_ids,
          created_at, updated_at
     FROM estimates
    ORDER BY updated_at DESC
    LIMIT 3`
);
for (const r of rows) {
  console.log('---', r.estimate_number, r.id);
  console.log('  updated_at', r.updated_at, ' created_at', r.created_at);
  for (const [k, v] of Object.entries(r)) {
    if (['id', 'estimate_number', 'created_at', 'updated_at'].includes(k)) continue;
    console.log(`  ${k} = ${JSON.stringify(v)}`);
  }
}
await pool.end();
