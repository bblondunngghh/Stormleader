import pool from './src/db/pool.js';
const t=['leads','contacts','tasks','activities','estimates','work_orders','subcontractors','territories','documents','invoices','expenses','users','tenants','financing_applications'];
for(const x of t){ try{const r=await pool.query(`SELECT COUNT(*)::int c FROM ${x}`);console.log(x.padEnd(24),r.rows[0].c);}catch(e){console.log(x.padEnd(24),'ERR');} }
console.log('--- QA leftovers ---');
for(const [x,col] of [['leads','address'],['subcontractors','name'],['territories','name'],['tasks','title']]){
  try{const r=await pool.query(`SELECT id,${col} FROM ${x} WHERE ${col}::text ILIKE '%QA-R12%' OR ${col}::text ILIKE '%qa_%' OR ${col}::text ILIKE '%$eq%' OR ${col}::text='12345'`);
  if(r.rows.length) r.rows.forEach(y=>console.log('  ',x,JSON.stringify(y)));}catch(e){}
}
await pool.end();
