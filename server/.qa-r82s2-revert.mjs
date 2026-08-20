import pool from './src/db/pool.js';
const r = await pool.query(`UPDATE estimates SET profit_margin=NULL, discounts='[]'::jsonb, signers='[]'::jsonb, deposit=NULL, estimate_name=NULL
  WHERE estimate_number='EST-082' AND tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2' RETURNING id, profit_margin, discounts, signers, deposit, estimate_name`);
console.log('reverted rows:', r.rowCount, JSON.stringify(r.rows));
await pool.end();
