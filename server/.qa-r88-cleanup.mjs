// Run 88 — inspect what the enum probe stored, then remove the QA rows.
import pool from './src/db/pool.js';

const cols = async (table) => {
  const { rows } = await pool.query(
    `SELECT column_name, data_type, udt_name FROM information_schema.columns
     WHERE table_name = $1 ORDER BY ordinal_position`, [table]
  );
  console.log(`${table}:`, rows.map((r) => `${r.column_name}:${r.udt_name}`).join(' '));
};

await cols('tasks');
console.log('');
const { rows: leadCols } = await pool.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'status'`
);
console.log('leads.status column exists:', leadCols.length > 0);

const { rows: probe } = await pool.query(
  `SELECT id, title, priority, status FROM tasks WHERE title = 'QA-R88 enum probe'`
);
console.log('QA-R88 task rows:', JSON.stringify(probe));

const { rowCount } = await pool.query(`DELETE FROM tasks WHERE title = 'QA-R88 enum probe'`);
console.log('deleted QA-R88 task rows:', rowCount);

const { rows: after } = await pool.query(`SELECT count(*)::int AS n FROM tasks`);
console.log('tasks remaining:', after[0].n);
await pool.end();
