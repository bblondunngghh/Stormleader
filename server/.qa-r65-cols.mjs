import pool from './src/db/pool.js';
const { rows } = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%skip%'`);
console.log('tables:', rows.map(r=>r.table_name));
for (const r of rows) {
  const c = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [r.table_name]);
  console.log(r.table_name, '->', c.rows.map(x=>x.column_name).join(', '));
}
await pool.end();
