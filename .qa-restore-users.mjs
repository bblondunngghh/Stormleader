import fs from 'fs';
import pg from './server/node_modules/pg/lib/index.js';
const envText = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// Restore Miles Martin / waterlooconstruction1@gmail.com (the standing probe user)
const r1 = await pool.query(
  `UPDATE users SET email = $1, first_name = $2 WHERE id = $3 RETURNING id, email, first_name, last_name`,
  ['waterlooconstruction1@gmail.com', 'Miles', '45cc729d-cc5b-44b5-93ca-7c01b427fc26']
);
console.log('Restored Miles:', JSON.stringify(r1.rows[0]));

// Restore brandon (the mint-token user)
const r2 = await pool.query(
  `UPDATE users SET email = $1, first_name = $2 WHERE id = $3 RETURNING id, email, first_name, last_name`,
  ['brandon', 'Brandon', '780e0023-c634-40b6-bc1d-67b4c1f0c2bd']
);
console.log('Restored brandon:', JSON.stringify(r2.rows[0]));

await pool.end();
