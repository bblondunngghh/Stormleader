import fs from 'fs';
import pool from './src/db/pool.js';
const r = await pool.query('SELECT tenant_id FROM users GROUP BY tenant_id ORDER BY COUNT(*) DESC LIMIT 1');
fs.writeFileSync('.qa-tid.txt', r.rows[0].tenant_id);
await pool.end();
