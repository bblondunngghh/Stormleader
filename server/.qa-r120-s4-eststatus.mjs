// Run 120 s4 — is the EstimatesView filtered-empty-copy defect REACHABLE?
// Need: estimates present in the tenant AND at least one filterable status with
// zero rows. READ ONLY.
import pool from './src/db/pool.js';
const t = (await pool.query(`select id from tenants where slug='waterloo'`)).rows[0].id;
const r = await pool.query(
  `select status, count(*)::int c from estimates where tenant_id=$1 group by status order by c desc`, [t]);
const total = r.rows.reduce((s, x) => s + x.c, 0);
console.log('estimates in tenant:', total);
r.rows.forEach(x => console.log('  ', String(x.status).padEnd(12), x.c));
const en = await pool.query(
  `select unnest(enum_range(null::estimate_status))::text s`).catch(() => null);
if (en) console.log('enum values:', en.rows.map(x => x.s).join(', '));
await pool.end();
