import pool from './src/db/pool.js';
for (const tb of ['notifications','automations']) {
  const {rows}=await pool.query(`SELECT column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,[tb]);
  console.log(`=== ${tb} ===`);
  for(const r of rows) console.log(`  ${r.column_name.padEnd(22)} ${r.udt_name.padEnd(14)} null=${r.is_nullable} def=${String(r.column_default||'').slice(0,30)}`);
  for(const r of rows.filter(x=>x.data_type==='USER-DEFINED')){
    const {rows:e}=await pool.query(`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=$1 ORDER BY e.enumsortorder`,[r.udt_name]);
    console.log(`    enum ${r.udt_name}: ${e.map(x=>x.enumlabel).join('|')}`);
  }
}
await pool.end();
