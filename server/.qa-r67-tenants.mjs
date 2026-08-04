import pool from './src/db/pool.js';
const t = await pool.query(`SELECT id, name, slug FROM tenants ORDER BY created_at`);
console.log('TENANTS:'); t.rows.forEach(r=>console.log(' ', r.id, '|', r.slug, '|', r.name));
const u = await pool.query(`SELECT id, email, tenant_id, role FROM users ORDER BY created_at LIMIT 20`);
console.log('\nUSERS:'); u.rows.forEach(r=>console.log(' ', r.email, '| tenant', r.tenant_id, '| role', r.role));
// which tenants actually hold data worth probing
for (const tbl of ['leads','contacts','estimates','invoices','tasks','work_orders','documents']) {
  const c = await pool.query(`SELECT tenant_id, count(*)::int n FROM ${tbl} GROUP BY tenant_id ORDER BY n DESC LIMIT 4`);
  console.log(`\n${tbl}:`, c.rows.map(r=>`${r.tenant_id.slice(0,8)}=${r.n}`).join('  '));
}
await pool.end();
