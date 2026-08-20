import pool from './src/db/pool.js';
const r=await pool.query(`SELECT column_name,data_type FROM information_schema.columns WHERE table_name='estimates' AND column_name IN ('estimate_name','estimate_date','introduction','inspection_notes','footer_notes','profit_margin','discounts','signers','deposit') ORDER BY column_name`);
console.log('MIGRATION 050 columns present:', r.rows.length, '/9');
r.rows.forEach(x=>console.log('  ',x.column_name,x.data_type));
try{const m=await pool.query(`SELECT * FROM schema_migrations ORDER BY 1 DESC LIMIT 5`);console.log('migrations:',JSON.stringify(m.rows));}catch(e){console.log('no schema_migrations table:',e.code);}
await pool.end();
