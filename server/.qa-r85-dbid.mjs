// Identify WHICH database the server is talking to, and what tenants live in it.
// The r85 id-resolver lost 7 entity families vs r84; establish whether the data
// changed or the connection target changed before trusting any sweep result.
import pool from './src/db/pool.js';
const host = (process.env.DATABASE_URL || '').replace(/\/\/[^@]*@/, '//***@');
console.log('DATABASE_URL:', host || '(unset)');
const meta = await pool.query(
  `SELECT current_database() db, inet_server_addr()::text addr, inet_server_port() port, version() v`);
console.log(JSON.stringify({ ...meta.rows[0], v: meta.rows[0].v.slice(0, 60) }, null, 1));
const t = await pool.query(`SELECT id, slug, name, created_at FROM tenants ORDER BY created_at`);
console.log('\ntenants:', t.rows.length);
for (const r of t.rows) console.log(` ${r.id}  ${String(r.slug).padEnd(16)} ${r.name}`);
const per = await pool.query(
  `SELECT t.slug, count(l.id)::int leads FROM tenants t LEFT JOIN leads l ON l.tenant_id=t.id GROUP BY t.slug ORDER BY 2 DESC`);
console.log('\nleads per tenant:', JSON.stringify(per.rows));
const ps = await pool.query(`SELECT tenant_id, count(*)::int n FROM pipeline_stages GROUP BY 1`);
console.log('pipeline_stages per tenant:', JSON.stringify(ps.rows));
await pool.end();
