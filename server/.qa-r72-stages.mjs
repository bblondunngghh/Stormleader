import pool from './src/db/pool.js';
const a = await pool.query(`SELECT stage, count(*) FROM leads GROUP BY stage ORDER BY 2 DESC`);
console.log('leads.stage:', a.rows.map(r=>r.stage+'='+r.count).join('  '));
const b = await pool.query(`SELECT stage, follow_up_at IS NOT NULL AS hasfu FROM leads WHERE follow_up_at IS NOT NULL LIMIT 8`);
console.log('followups stages:', JSON.stringify(b.rows.map(r=>r.stage)));
await pool.end();
