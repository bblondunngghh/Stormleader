import pool from './src/db/pool.js';
const f = await pool.query(`SELECT estimate_number, financing_enabled, financing_plan_ids, status FROM estimates WHERE financing_enabled = true`);
console.log('financing_enabled=true rows: ' + f.rowCount);
console.log(JSON.stringify(f.rows, null, 1).slice(0,1200));
const g = await pool.query(`SELECT estimate_number, financing_plan_ids FROM estimates WHERE financing_plan_ids IS NOT NULL AND financing_plan_ids::text NOT IN ('[]','null') LIMIT 10`);
console.log('--- non-empty financing_plan_ids: ' + g.rowCount);
console.log(JSON.stringify(g.rows, null, 1).slice(0,800));
await pool.end();
