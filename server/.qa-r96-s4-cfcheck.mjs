// Run 96 / s4 — before removing the leftover `qa_options_probe` custom field
// definition, prove no real lead stores a value under that key.
// READ ONLY.
import pool from './src/db/pool.js';

const KEY = 'qa_options_probe';

const { rows: withVal } = await pool.query(
  `SELECT id, contact_name, custom_fields
     FROM leads
    WHERE custom_fields ? $1`,
  [KEY]
);
console.log(`leads carrying a value under "${KEY}":`, withVal.length);
for (const r of withVal) console.log('  ', r.id, r.contact_name, JSON.stringify(r.custom_fields));

const { rows: anyCf } = await pool.query(
  `SELECT count(*)::int n FROM leads
    WHERE custom_fields IS NOT NULL AND custom_fields <> '{}'::jsonb`
);
console.log('leads with ANY custom_fields data:', anyCf[0].n);

const { rows: keys } = await pool.query(
  `SELECT DISTINCT jsonb_object_keys(custom_fields) AS k FROM leads
    WHERE custom_fields IS NOT NULL AND custom_fields <> '{}'::jsonb`
);
console.log('distinct custom_fields keys in use:', JSON.stringify(keys.map(r => r.k)));

await pool.end();
