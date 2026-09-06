import pool from './src/db/pool.js';
const q=async(s,p)=>{try{return (await pool.query(s,p)).rows;}catch(e){return[{ERR:e.code}];}};
console.log('TENANTS:',JSON.stringify(await q(`SELECT id,slug,name FROM tenants ORDER BY slug`)));
const W=(await q(`SELECT id FROM tenants WHERE slug='waterloo'`))[0].id;
// every table that has a tenant_id column, and how many rows are NOT waterloo's
const tabs=await q(`SELECT table_name FROM information_schema.columns WHERE column_name='tenant_id' AND table_schema='public' ORDER BY table_name`);
console.log('\ntables with tenant_id:',tabs.length);
for(const t of tabs){
  const n=t.table_name;
  const r=await q(`SELECT count(*)::int total, count(*) FILTER (WHERE tenant_id IS DISTINCT FROM $1)::int foreign_rows FROM ${n}`,[W]);
  if(r[0]?.ERR){console.log(`  ${n.padEnd(30)} ERR ${r[0].ERR}`);continue;}
  if(r[0].foreign_rows>0)console.log(`  ${n.padEnd(30)} total=${String(r[0].total).padEnd(6)} FOREIGN=${r[0].foreign_rows}`);
}
await pool.end();
