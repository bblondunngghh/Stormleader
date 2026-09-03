// Run 120 s4 — does /leads?sort_by=updated_at&sort_dir=ASC actually reproduce the
// Stale Leads panel's ordering? READ ONLY.
import pool from './src/db/pool.js';

const t = (await pool.query(`select id from tenants where slug='waterloo'`)).rows[0].id;

const byUpdated = await pool.query(
  `select address, updated_at, created_at from leads where tenant_id=$1
    order by updated_at asc limit 5`, [t]);
console.log('--- leads ORDER BY updated_at ASC (what the fixed link asks for) ---');
byUpdated.rows.forEach(r => console.log('  ', (r.address || '').slice(0, 30).padEnd(32), r.updated_at.toISOString()));

const byStale = await pool.query(
  `select address, updated_at,
          extract(day from now() - updated_at)::int as days_stale
     from leads where tenant_id=$1
    order by days_stale desc limit 5`, [t]);
console.log('--- leads ORDER BY days_stale DESC (the panel query shape) ---');
byStale.rows.forEach(r => console.log('  ', (r.address || '').slice(0, 30).padEnd(32), r.days_stale + 'd'));

const same = byUpdated.rows.map(r => r.address).join('|') === byStale.rows.map(r => r.address).join('|');
console.log(same ? 'MATCH — updated_at ASC == days_stale DESC' : 'DIVERGENT');
await pool.end();
