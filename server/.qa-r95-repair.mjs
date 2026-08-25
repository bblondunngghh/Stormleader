import pool from './src/db/pool.js';
const ID='f8a24416-8692-4a13-a45a-5641e62170ef';
const b=await pool.query(`SELECT line_items::text raw, status, completed_at FROM work_orders WHERE id=$1`,[ID]);
console.log('before:', JSON.stringify(b.rows[0]));
// bind as TEXT and cast — never bind a JS array to a jsonb param
await pool.query(`UPDATE work_orders SET line_items = $1::jsonb WHERE id=$2`, ['[]', ID]);
const a=await pool.query(`SELECT line_items::text raw, jsonb_typeof(line_items) jty, status, completed_at FROM work_orders WHERE id=$1`,[ID]);
console.log('after :', JSON.stringify(a.rows[0]));
const d=await pool.query(`SELECT jsonb_typeof(line_items) jty, count(*)::int n FROM work_orders GROUP BY 1 ORDER BY n DESC`);
console.log('distribution now:', d.rows.map(r=>`${r.jty}=${r.n}`).join(', '));
await pool.end();
