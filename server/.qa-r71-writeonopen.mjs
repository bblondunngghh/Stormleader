import pool from './src/db/pool.js';
const ID='1252940b-b691-4182-8d4f-680ac71a0711';
await pool.query(`UPDATE estimates SET line_items='[null]'::jsonb, upgrades='[null]'::jsonb WHERE id=$1`,[ID]);
const { rows } = await pool.query(`SELECT estimate_number, line_items, upgrades, updated_at FROM estimates WHERE id=$1`,[ID]);
console.log('BEFORE-OPEN:', JSON.stringify(rows[0]));
await pool.end();
