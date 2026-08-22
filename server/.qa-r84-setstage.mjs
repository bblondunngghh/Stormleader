import pool from './src/db/pool.js';
const [,,stage] = process.argv;
const r = await pool.query(`UPDATE leads SET stage=$1 WHERE id='71858ef0-1b81-466f-86a5-3dbb23c4a241' RETURNING stage`, [stage]);
console.log('stage now:', r.rows[0].stage);
process.exit(0);
