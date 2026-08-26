// Run 96 / s4 — SQL ground truth for the lead stage distribution, to decide whether
// `/api/leads?stage=sold` returning 0 rows is a regression or data drift.
// READ ONLY: two SELECTs, no writes.
import pool from './src/db/pool.js';

const tenant = await pool.query(
  `SELECT id, slug FROM tenants WHERE slug = 'waterloo' LIMIT 1`
);
const tid = tenant.rows[0].id;
console.log('tenant', tenant.rows[0].slug, tid);

const dist = await pool.query(
  `SELECT stage::text AS stage, COUNT(*)::int AS n
     FROM leads WHERE tenant_id = $1 GROUP BY 1 ORDER BY 2 DESC, 1`,
  [tid]
);
console.log('\nSTAGE DISTRIBUTION (this tenant):');
for (const r of dist.rows) console.log(`  ${String(r.n).padStart(3)}  ${r.stage}`);
console.log('  total', dist.rows.reduce((a, r) => a + r.n, 0));

const enumLabels = await pool.query(
  `SELECT e.enumlabel FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'lead_stage' ORDER BY e.enumsortorder`
);
console.log('\nlead_stage ENUM LABELS:', enumLabels.rows.map(r => r.enumlabel).join(', '));

// The exact predicate the fixed needs_followup filter uses.
const nf = await pool.query(
  `SELECT COUNT(*)::int AS n FROM leads l
    WHERE l.tenant_id = $1
      AND l.stage::text NOT IN ('closed_won','closed_lost','sold','lost')`,
  [tid]
);
console.log('\nneeds_followup stage predicate matches:', nf.rows[0].n, 'leads');

await pool.end();
