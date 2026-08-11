import pool from './src/db/pool.js';
const q = async (s,p)=> (await pool.query(s,p)).rows;
console.log('--- tasks columns ---');
console.table(await q(`select column_name,data_type,udt_name,column_default,is_nullable from information_schema.columns where table_name='tasks' order by ordinal_position`));
console.log('--- distinct task priority/status in DB ---');
console.table(await q(`select priority, status, count(*) from tasks group by 1,2 order by 3 desc`));
await pool.end();
