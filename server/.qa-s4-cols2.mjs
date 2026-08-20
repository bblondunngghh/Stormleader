import pool from './src/db/pool.js';
const r=await pool.query(`SELECT column_name,data_type FROM information_schema.columns WHERE table_name='estimates' AND column_name IN ('estimate_name','estimate_date','introduction','inspection_notes','footer_notes','profit_margin','discounts','signers','deposit') ORDER BY column_name`);
console.log('MIGRATION 050 columns present:', r.rows.length, '/9 ->', r.rows.map(x=>x.column_name+':'+x.data_type).join(', '));
await pool.end();
