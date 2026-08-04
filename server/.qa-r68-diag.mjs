// Diagnostic: why does :3099 (fresh) return 0 for estimate-summary while :3001 returns 82?
import fs from 'node:fs';
import pool from './src/db/pool.js';

const dec = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());

async function login(port) {
  const r = await fetch(`http://localhost:${port}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
  });
  return (await r.json()).accessToken;
}
const g = async (port, tok, p) => {
  const r = await fetch(`http://localhost:${port}${p}`, { headers: { Authorization: `Bearer ${tok}` } });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const t99 = await login(3099), t01 = await login(3001);
console.log('JWT :3099 payload:', JSON.stringify(dec(t99)));
console.log('JWT :3001 payload:', JSON.stringify(dec(t01)));

for (const [port, tok] of [[3099, t99], [3001, t01]]) {
  const es = await g(port, tok, '/api/crm/dashboard/estimate-summary');
  const list = await g(port, tok, '/api/estimates?limit=100');
  const rows = Array.isArray(list.body) ? list.body : (list.body?.data || list.body?.estimates || []);
  const dis = await g(port, tok, '/api/crm/dashboard/days-in-stage');
  const disArr = dis.body?.data || dis.body || [];
  console.log(`:${port} summary=${JSON.stringify(es.body?.data || es.body)}`);
  console.log(`:${port} estimates list=${rows.length} rows, first tenant_id=${rows[0]?.tenant_id} first num=${rows[0]?.estimate_number}`);
  console.log(`:${port} days-in-stage=${Array.isArray(disArr) ? disArr.length : 'n/a'} entries`);
}

console.log('\n=== DB direct ===');
const { rows: byTenant } = await pool.query(
  `SELECT tenant_id, count(*)::int n, count(*) FILTER (WHERE status='draft')::int draft
   FROM estimates GROUP BY tenant_id ORDER BY n DESC`);
console.log('estimates by tenant:', JSON.stringify(byTenant));
const { rows: tenants } = await pool.query(`SELECT id, slug, name FROM tenants ORDER BY slug`);
console.log('tenants:', JSON.stringify(tenants));
const { rows: u } = await pool.query(
  `SELECT id, email, tenant_id FROM users WHERE email='waterlooconstruction1@gmail.com'`);
console.log('user rows:', JSON.stringify(u));
const { rows: dbUrl } = await pool.query(`SELECT current_database() db, inet_server_addr()::text host`);
console.log('this script DB:', JSON.stringify(dbUrl));
await pool.end();
