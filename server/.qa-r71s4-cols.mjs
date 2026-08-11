import pool from './src/db/pool.js';
const c = (await pool.query(`select column_name,data_type from information_schema.columns where table_name='contracts' order by ordinal_position`)).rows;
console.log('contracts columns:', c.map(r=>r.column_name).join(', '));
const d = await pool.query(`delete from contracts where content->>'sections' is not null and id='94173e4c-2fa2-4b6e-97d7-7ca7c1bbec95' returning id`);
console.log('cleaned probe contract:', d.rowCount);
console.log('contract count now:', (await pool.query('select count(*)::int n from contracts')).rows[0].n);
await pool.end();
