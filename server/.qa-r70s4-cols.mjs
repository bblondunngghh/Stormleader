import pool from './src/db/pool.js';
const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='estimates' ORDER BY ordinal_position`);
console.log(r.rows.map(c => c.column_name + ':' + c.data_type).join('\n'));
const f = await pool.query(`SELECT estimate_number, financing_enabled, financing_plan_ids, estimate_name, introduction IS NOT NULL AS has_intro, inspection_notes IS NOT NULL AS has_insp FROM estimates WHERE financing_enabled = true OR estimate_name IS NOT NULL LIMIT 10`);
console.log('--- rows with financing/estimate_name ---');
console.log(JSON.stringify(f.rows, null, 1));
await pool.end();
