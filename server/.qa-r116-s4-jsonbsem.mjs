// Run 116 s4 — READ-ONLY: what does `COALESCE(col,'{}') || $n::jsonb` do with a
// non-object payload? Establishes whether an unguarded jsonb-merge column can be
// corrupted or merely errors. No table is touched; these are literal expressions.
import pool from './src/db/pool.js';
const cases = [
  [`'{}'::jsonb || '"oops"'::jsonb`,       'object || string-scalar'],
  [`'{}'::jsonb || '42'::jsonb`,           'object || number-scalar'],
  [`'{}'::jsonb || 'true'::jsonb`,         'object || bool-scalar'],
  [`'{}'::jsonb || '[]'::jsonb`,           'object || empty-array'],
  [`'{}'::jsonb || '[1,2]'::jsonb`,        'object || array'],
  [`'{"a":1}'::jsonb || '"oops"'::jsonb`,  'nonempty-obj || string'],
  [`'{"a":1}'::jsonb || '[9]'::jsonb`,     'nonempty-obj || array'],
  [`'{}'::jsonb || 'null'::jsonb`,         'object || json-null'],
  [`'{"a":1}'::jsonb || '{"b":2}'::jsonb`, 'object || object (happy path)'],
];
for (const [expr, label] of cases) {
  try {
    const { rows } = await pool.query(`SELECT ${expr} AS r`);
    console.log(`  OK    ${label.padEnd(30)} -> ${JSON.stringify(rows[0].r)}`);
  } catch (e) {
    console.log(`  ERROR ${label.padEnd(30)} -> ${e.code} ${e.message}`);
  }
}
await pool.end();
