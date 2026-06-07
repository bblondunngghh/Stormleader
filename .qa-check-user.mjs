import fs from 'fs';
import pg from './server/node_modules/pg/lib/index.js';
const envText = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const { rows } = await pool.query(
  `SELECT id, email, first_name, last_name, role FROM users WHERE tenant_id = $1`,
  ['791bb51d-3293-4839-92e9-bd4d4f873af2']
);
console.log(JSON.stringify(rows, null, 2));
await pool.end();
