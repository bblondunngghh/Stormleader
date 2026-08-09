import pool from './src/db/pool.js';
const t='791bb51d-3293-4839-92e9-bd4d4f873af2';
const a=await pool.query(`SELECT stage, count(*) FROM leads WHERE tenant_id=$1 GROUP BY stage ORDER BY 2 DESC`,[t]);
console.log('waterloo leads by stage:', a.rows.map(r=>r.stage+'='+r.count).join('  '));
const b=await pool.query(`SELECT count(*) FROM leads WHERE tenant_id=$1`,[t]);
console.log('waterloo total:', b.rows[0].count);
await pool.end();
