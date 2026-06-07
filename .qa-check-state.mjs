import fs from 'fs';
import pg from './server/node_modules/pg/lib/index.js';
const envText = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

const tenant = await pool.query(
  `SELECT id, name, slug FROM tenants WHERE id = '791bb51d-3293-4839-92e9-bd4d4f873af2'`
);
console.log('Tenant:', JSON.stringify(tenant.rows, null, 2));

console.log('\nAll tenants:');
const allT = await pool.query(`SELECT id, name, slug FROM tenants ORDER BY created_at`);
console.log(JSON.stringify(allT.rows, null, 2));

const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tenants' ORDER BY ordinal_position`);
console.log('\nTenant columns:', cols.rows.map(r=>r.column_name).join(', '));

await pool.end();
