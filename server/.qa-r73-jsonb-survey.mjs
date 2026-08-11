// Run 73 s1 — survey EVERY jsonb column in the database for dangerous stored shapes.
// Read-only. Carry-forward priority: "JSONB columns are the real risk surface."
import pool from './src/db/pool.js';

const { rows: cols } = await pool.query(`
  SELECT c.table_name, c.column_name
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_name = c.table_name AND t.table_schema = c.table_schema
  WHERE c.table_schema='public' AND c.data_type='jsonb' AND t.table_type='BASE TABLE'
  ORDER BY c.table_name, c.column_name
`);
console.log(`JSONB columns: ${cols.length}\n`);

const danger = [];
for (const { table_name: t, column_name: c } of cols) {
  // Per-column shape census + count of rows whose ARRAY holds a non-object element,
  // which is the exact shape that has crashed 4 renderers across Runs 67-73.
  const q = `
    SELECT
      jsonb_typeof(${c}) AS shape,
      COUNT(*)::int AS n,
      COUNT(*) FILTER (
        WHERE jsonb_typeof(${c})='array'
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(${c}) e
            WHERE jsonb_typeof(e) <> 'object'
          )
      )::int AS bad_elems
    FROM ${t}
    WHERE ${c} IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC`;
  let rows;
  try { ({ rows } = await pool.query(q)); } catch (e) { console.log(`  skip ${t}.${c}: ${e.message.slice(0, 60)}`); continue; }
  if (!rows.length) continue;
  const census = rows.map(r => `${r.shape}:${r.n}${r.bad_elems ? ` (${r.bad_elems} WITH NON-OBJECT ELEMENTS)` : ''}`).join('  ');
  const bad = rows.reduce((a, r) => a + r.bad_elems, 0);
  if (bad) danger.push({ t, c, bad, census });
  console.log(`${bad ? '!! ' : '   '}${t}.${c}  ${census}`);
}

console.log('\n=== COLUMNS HOLDING ARRAYS WITH NON-OBJECT ELEMENTS ===');
if (!danger.length) console.log('  none');
for (const d of danger) {
  console.log(`  ${d.t}.${d.c}: ${d.bad} row(s)`);
  const { rows } = await pool.query(
    `SELECT id, ${d.c} AS v FROM ${d.t}
     WHERE jsonb_typeof(${d.c})='array'
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(${d.c}) e WHERE jsonb_typeof(e) <> 'object')
     LIMIT 5`
  );
  rows.forEach(r => console.log(`     ${r.id}  ${JSON.stringify(r.v).slice(0, 120)}`));
}

// Separately: object-typed columns whose known array-ish sub-keys are wrong-typed.
console.log('\n=== contracts.content sections shape census ===');
const { rows: sec } = await pool.query(`
  SELECT COALESCE(jsonb_typeof(content->'sections'),'(absent)') AS shape, COUNT(*)::int AS n
  FROM contracts GROUP BY 1 ORDER BY 2 DESC`);
sec.forEach(r => console.log(`  sections is ${r.shape}: ${r.n}`));

await pool.end();
