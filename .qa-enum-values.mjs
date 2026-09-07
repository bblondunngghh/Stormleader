// Read-only. Lists the DISTINCT values actually stored in every enum-ish column that the
// raw-enum-render sweep flagged, so a "renders the raw value" hit can be judged against
// real data: a single-word value is its own label, an underscored one is not.
import pool from './server/src/db/pool.js';

const TARGETS = [
  ['estimates', 'status'],
  ['material_orders', 'status'],
  ['subcontractors', 'status'],
  ['contracts', 'status'],
  ['invoices', 'status'],
  ['expenses', 'category'],
  ['products', 'category'],
  ['activities', 'type'],
  ['tasks', 'status'],
  ['tasks', 'priority'],
  ['leads', 'priority'],
  ['leads', 'stage'],
  ['leads', 'source'],
  ['drip_enrollments', 'status'],
];

const out = {};
for (const [tbl, col] of TARGETS) {
  const key = tbl + '.' + col;
  try {
    const { rows } = await pool.query(
      `SELECT ${col}::text AS v, COUNT(*)::int AS n FROM ${tbl} GROUP BY 1 ORDER BY 2 DESC LIMIT 30`
    );
    out[key] = { stored: rows.map((r) => `${r.v} (${r.n})`) };
  } catch (e) {
    out[key] = { err: e.message.slice(0, 90) };
  }
  // Also the declared domain, when the column is a real enum or has a CHECK constraint.
  try {
    const { rows } = await pool.query(
      `SELECT e.enumlabel AS v
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         JOIN information_schema.columns c
           ON c.udt_name = t.typname AND c.table_name = $1 AND c.column_name = $2
        ORDER BY e.enumsortorder`,
      [tbl, col]
    );
    if (rows.length) out[key].enumDomain = rows.map((r) => r.v);
  } catch { /* not an enum */ }
}
console.log(JSON.stringify(out, null, 1));
await pool.end();
