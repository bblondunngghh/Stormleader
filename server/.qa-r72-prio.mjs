import pool from './src/db/pool.js';
const a = await pool.query(`SELECT priority, count(*) FROM tasks GROUP BY priority ORDER BY 2 DESC`);
console.log('tasks.priority values:', JSON.stringify(a.rows));
const b = await pool.query(`SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='priority'`);
console.log('column:', JSON.stringify(b.rows));
const c = await pool.query(`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname = (SELECT udt_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='priority')`);
console.log('enum labels:', JSON.stringify(c.rows.map(r=>r.enumlabel)));
await pool.end();
