import pool from './src/db/pool.js';
const r = await pool.query(`DELETE FROM tasks WHERE title = 'qa2026-r71-s4-badge-probe' RETURNING id`);
console.log('deleted probe tasks:', r.rowCount, r.rows.map(x => x.id).join(','));
const left = await pool.query(`SELECT COUNT(*)::int c FROM tasks WHERE title LIKE 'qa2026%'`);
console.log('qa2026 tasks remaining:', left.rows[0].c);
await pool.end();
