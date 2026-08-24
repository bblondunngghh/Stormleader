// Run 90 (s4-verify) — read-only: who is the logged-in user and what role does the DB hold?
import pool from './src/db/pool.js';
const { rows } = await pool.query(
  "SELECT id, email, role, tenant_id FROM users ORDER BY created_at LIMIT 10"
);
console.log(JSON.stringify(rows, null, 1));
await pool.end();
