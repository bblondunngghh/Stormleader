import fs from 'fs';
import pg from './server/node_modules/pg/lib/index.js';
const envText = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const lead = await pool.query(
  `SELECT id, contact_name, contact_email, contact_phone, address, city, stage, priority, source, notes, estimated_value, hail_size_in, updated_at FROM leads WHERE id = '3fa29df8-589c-44a6-ac4d-88cb78243cbe'`
);
console.log(JSON.stringify(lead.rows[0], null, 2));
await pool.end();
