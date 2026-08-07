import pool from './src/db/pool.js';
const q=async(l,s,p=[])=>{const{rows}=await pool.query(s,p);console.log(l,JSON.stringify(rows));};
await q('estimates total / null lead_id : ',
  `SELECT count(*)::int total, count(*) FILTER (WHERE lead_id IS NULL)::int null_lead FROM estimates`);
await q('EST-001 lead_id               : ',
  `SELECT estimate_number, lead_id, customer_name, customer_email, total FROM estimates WHERE financing_enabled=true`);
await q('is lead_id nullable?          : ',
  `SELECT column_name, is_nullable FROM information_schema.columns
   WHERE table_name='financing_applications' AND column_name IN ('lead_id','estimate_id','amount')`);
await pool.end();
