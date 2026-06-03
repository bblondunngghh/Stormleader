// QA helper — mint a JWT for the brandon/waterloo user directly, bypassing the
// HTTP rate limiter. Reads JWT_SECRET from server/.env and signs an access token.
import fs from 'fs';
import path from 'path';
import jwt from './server/node_modules/jsonwebtoken/index.js';
import pg from './server/node_modules/pg/lib/index.js';

const envPath = path.resolve('.env');
const envText = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined });
const { rows } = await pool.query(
  `SELECT u.id, u.tenant_id, u.email, u.role, u.first_name, u.last_name, t.slug
   FROM users u JOIN tenants t ON t.id = u.tenant_id
   WHERE u.email = $1 AND t.slug = $2`,
  ['brandon', 'waterloo']
);
if (rows.length === 0) {
  console.error(JSON.stringify({ error: 'user not found' }));
  process.exit(1);
}
const u = rows[0];
const token = jwt.sign(
  { id: u.id, tenantId: u.tenant_id, email: u.email, role: u.role },
  env.JWT_SECRET,
  { expiresIn: '12h' }
);
console.log(JSON.stringify({
  accessToken: token,
  user: { id: u.id, email: u.email, firstName: u.first_name, lastName: u.last_name, role: u.role, tenantId: u.tenant_id },
  tenant: { slug: u.slug }
}));
await pool.end();
