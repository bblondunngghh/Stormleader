import pool from './src/db/pool.js';
const mode = process.argv[2];
const id = '1252940b-b691-4182-8d4f-680ac71a0711'; // EST-083
if (mode === 'on') {
  await pool.query(`UPDATE estimates SET financing_enabled = true, financing_plan_ids = $2::jsonb WHERE id = $1`,
    [id, JSON.stringify(['b27521fe-7ae1-4cf3-82e8-0517b15bf7f7','e2ed01d1-c459-47de-863d-7941be83d13f'])]);
} else if (mode === 'off') {
  await pool.query(`UPDATE estimates SET financing_enabled = false, financing_plan_ids = '[]'::jsonb WHERE id = $1`, [id]);
}
const r = await pool.query(`SELECT estimate_number, financing_enabled, financing_plan_ids FROM estimates WHERE id = $1`, [id]);
console.log(JSON.stringify(r.rows[0]));
await pool.end();
