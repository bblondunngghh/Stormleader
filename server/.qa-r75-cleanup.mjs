import pool from './src/db/pool.js';
const r = await pool.query(`DELETE FROM tasks WHERE id='905d65e5-6c23-4fc8-b1ee-979e048c33b8' RETURNING id,title`);
console.log('deleted probe task:', JSON.stringify(r.rows));
const c = await pool.query(`SELECT COUNT(*) n FROM tasks WHERE tenant_id=(SELECT id FROM tenants WHERE slug='waterloo')`);
console.log('tasks remaining:', c.rows[0].n);
await pool.end();
