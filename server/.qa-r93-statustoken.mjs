import pool from './src/db/pool.js';
const r = await pool.query('SELECT token, lead_id, created_at FROM client_status_tokens ORDER BY created_at DESC LIMIT 5');
console.log('rows:', r.rowCount);
console.log(JSON.stringify(r.rows, null, 1));
await pool.end();
