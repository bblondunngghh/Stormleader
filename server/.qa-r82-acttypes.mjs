import pool from './src/db/pool.js';
const r=await pool.query(`SELECT type,count(*)::int c FROM activities GROUP BY 1 ORDER BY 2 DESC`);
console.log(r.rows.map(x=>`${x.type}=${x.c}`).join('  '));
await pool.end();
