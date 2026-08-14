import pool from './src/db/pool.js';
const BASE='http://localhost:3001', TENANT='791bb51d-3293-4839-92e9-bd4d4f873af2';
const mint=async()=>(await(await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email:'waterlooconstruction1@gmail.com',password:'2Wealth&health',tenantSlug:'waterloo'})})).json()).accessToken;
const token=await mint();
const BAD={ 'EST-083 [null]':'1252940b-b691-4182-8d4f-680ac71a0711', 'EST-082 [null,"",1]':'2dd4659c-ed16-4353-9ee6-5dfdf944f365' };
const snap=async()=>({est:(await pool.query('SELECT COUNT(*)::int n FROM estimates')).rows[0].n,
  inv:(await pool.query('SELECT COUNT(*)::int n FROM invoices')).rows[0].n,
  wo:(await pool.query('SELECT COUNT(*)::int n FROM work_orders')).rows[0].n});
const before=await snap();
for (const [label,id] of Object.entries(BAD)) {
  for (const [name,path] of [['duplicate',`/api/estimates/${id}/duplicate`],
      ['invoice from-estimate',`/api/crm/invoices/from-estimate/${id}`],
      ['work-order from-estimate',`/api/crm/work-orders/from-estimate/${id}`]]) {
    const r=await fetch(BASE+path,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});
    const t=await r.text();
    console.log(`${String(r.status).padEnd(4)} ${name.padEnd(24)} ${label}  ${r.status>=500?t.slice(0,150):''}`);
  }
}
const after=await snap();
console.log('\nrows created — estimates:',after.est-before.est,'invoices:',after.inv-before.inv,'work_orders:',after.wo-before.wo);
// cleanup everything created in the last 10 minutes
for (const [t,] of [['estimates'],['invoices'],['work_orders']]) {
  const { rowCount } = await pool.query(`DELETE FROM ${t} WHERE created_at > NOW() - INTERVAL '10 minutes'`);
  console.log(`cleaned ${t}: ${rowCount}`);
}
const final=await snap();
console.log('NET est:',final.est-before.est,'inv:',final.inv-before.inv,'wo:',final.wo-before.wo);
await pool.end();
