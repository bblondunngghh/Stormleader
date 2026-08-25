import pool from './src/db/pool.js';
for(const tb of ['tasks','financing_lenders','financing_plans']){
  const {rows}=await pool.query(`SELECT column_name,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_name=$1 AND is_nullable='NO' AND column_default IS NULL ORDER BY ordinal_position`,[tb]);
  console.log(`${tb} REQUIRED: `+rows.map(r=>r.column_name+':'+r.udt_name).join(', '));
}
await pool.end();
