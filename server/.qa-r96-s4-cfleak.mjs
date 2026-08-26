// Run 96 / s4 — investigate the leftover `QA Options Probe` custom field definition.
// The r95 hygiene sweep only matches 'QA-R9%', so this row slipped past it.
// READ ONLY.
import pool from './src/db/pool.js';

const { rows } = await pool.query(
  `SELECT * FROM custom_field_definitions`
);
console.log('custom_field_definitions — ALL ROWS:');
for (const r of rows) console.log(' ', JSON.stringify(r));

const { rows: t } = await pool.query(`SELECT id, slug, name FROM tenants`);
console.log('\ntenants:');
for (const r of t) console.log(' ', r.slug, r.id, '|', r.name);

// Anything else QA-shaped that the 'QA-R9%' pattern would miss.
console.log('\nBROADER QA-SHAPED SCAN (label/name LIKE %QA% or %Probe% or %qa2026%):');
for (const [tb, col] of [
  ['custom_field_definitions', 'field_label'], ['tasks', 'title'], ['automations', 'name'],
  ['contract_templates', 'name'], ['financing_plans', 'name'], ['financing_lenders', 'provider'],
  ['prospect_lists', 'name'], ['drip_sequences', 'name'], ['notifications', 'title'],
  ['financing_applications', 'customer_name'],
]) {
  const { rows: hit } = await pool.query(
    `SELECT ${col} AS v, count(*)::int n FROM ${tb}
      WHERE ${col} ILIKE '%qa%' OR ${col} ILIKE '%probe%' OR ${col} ILIKE '%test%'
      GROUP BY 1 ORDER BY 1`
  );
  if (hit.length) console.log(`  ${tb}.${col}:`, JSON.stringify(hit));
}

await pool.end();
