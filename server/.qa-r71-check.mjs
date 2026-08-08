import pool from './src/db/pool.js';
const { rows } = await pool.query(`SELECT estimate_number, upgrades, financing_plan_ids, insurance_details, updated_at
  FROM estimates WHERE id='1252940b-b691-4182-8d4f-680ac71a0711'`);
console.log(JSON.stringify(rows[0]));
await pool.end();
