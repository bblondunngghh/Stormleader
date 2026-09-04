import pool from './src/db/pool.js';
const id='8cd0f0f2-6296-412f-a5a8-96ae2c6f786e';
const r=await pool.query(`SELECT id,address,stage,updated_at FROM leads WHERE id=$1`,[id]);
console.log(JSON.stringify(r.rows[0]));
if(process.argv[2]==='revert'){
  const u=await pool.query(`UPDATE leads SET stage='new' WHERE id=$1 RETURNING stage`,[id]);
  console.log('reverted ->',u.rows[0].stage);
}
await pool.end();
