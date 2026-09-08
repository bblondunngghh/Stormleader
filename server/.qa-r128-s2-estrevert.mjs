// Run 128 (s2) — REVERT the single row the autosave repro wrote.
//
// My page.route matcher was `/api/.*\/estimates` but the real path is `/api/estimates/:id`
// (client/src/api/estimates.js:6), so the PATCH was never intercepted and hit the live
// database. EST-090 is restored to the shape of its batch sibling EST-089, which was
// created in the same tier-generation write (identical created_at) and still carries the
// untouched-row signature updated_at == created_at.
import pool from './src/db/pool.js';

const ID = '0bdbfda6-24a6-40d2-89b5-81fd6a436693'; // EST-090

const { rows: before } = await pool.query('SELECT * FROM estimates WHERE id = $1', [ID]);
console.log('BEFORE customer_name=', JSON.stringify(before[0].customer_name),
  'discounts=', JSON.stringify(before[0].discounts), 'updated_at=', before[0].updated_at);

await pool.query(
  `UPDATE estimates SET
     customer_name = NULL, customer_address = NULL, customer_phone = NULL, customer_email = NULL,
     estimate_name = NULL, scope_of_work = NULL, terms = NULL, warranty_info = NULL,
     inspection_notes = NULL, introduction = NULL, footer_notes = NULL, profit_margin = NULL,
     discounts = '[]'::jsonb, signers = '[]'::jsonb,
     updated_at = created_at
   WHERE id = $1`,
  [ID]
);

const { rows: after } = await pool.query(
  `SELECT customer_name, customer_address, customer_phone, customer_email, estimate_name,
          scope_of_work, terms, warranty_info, inspection_notes, introduction, footer_notes,
          profit_margin, discounts, signers, notes, tax_rate, valid_until, upgrades, deposit,
          insurance_details, financing_enabled, financing_plan_ids, created_at, updated_at
     FROM estimates WHERE id = $1`, [ID]
);
const { rows: sib } = await pool.query(
  `SELECT customer_name, customer_address, customer_phone, customer_email, estimate_name,
          scope_of_work, terms, warranty_info, inspection_notes, introduction, footer_notes,
          profit_margin, discounts, signers, tax_rate, valid_until, upgrades, deposit,
          insurance_details, financing_enabled, financing_plan_ids
     FROM estimates WHERE estimate_number = 'EST-089'`
);

const a = after[0], s = sib[0];
const diffs = Object.keys(s).filter(k => JSON.stringify(a[k]) !== JSON.stringify(s[k]));
console.log('AFTER  customer_name=', JSON.stringify(a.customer_name),
  'discounts=', JSON.stringify(a.discounts), 'updated_at=', a.updated_at);
console.log('updated_at === created_at :', String(a.updated_at) === String(a.created_at));
console.log('fields still differing from untouched sibling EST-089:', diffs.length ? diffs : 'NONE');
for (const k of diffs) console.log(`  ${k}: EST-090=${JSON.stringify(a[k])} EST-089=${JSON.stringify(s[k])}`);
await pool.end();
