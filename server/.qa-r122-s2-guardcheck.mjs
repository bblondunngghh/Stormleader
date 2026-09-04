// Run 122-s2: confirm the UNCOMMITTED jsonb-null guard in estimates/invoices/workOrders
// routes is live and frontend-safe. Read-mostly: the only writes are idempotent
// re-writes of a row's OWN current value (no new rows, no value changes).
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const T=(await (await fetch(BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email:'waterlooconstruction1@gmail.com',password:'2Wealth&health',tenantSlug:'waterloo'})})).json()).accessToken;
if(!T){console.log('LOGIN FAILED');process.exit(1);}
const req=async(m,p,b)=>{const r=await fetch(BASE+p,{method:m,headers:{'Content-Type':'application/json',Authorization:'Bearer '+T},body:b===undefined?undefined:JSON.stringify(b)});const t=await r.text();return{st:r.status,b:t.slice(0,120)};};
const q=async(s,p=[])=>(await pool.query(s,p)).rows;
const TEN='791bb51d-3293-4839-92e9-bd4d4f873af2';
const est=(await q(`SELECT id,line_items,deposit,insurance_details,updated_at FROM estimates WHERE tenant_id=$1 LIMIT 1`,[TEN]))[0];
const inv=(await q(`SELECT id,line_items,updated_at FROM invoices WHERE tenant_id=$1 LIMIT 1`,[TEN]))[0];
const wo =(await q(`SELECT id,line_items,updated_at FROM work_orders WHERE tenant_id=$1 LIMIT 1`,[TEN]))[0];
const R=[];
R.push(['EST line_items:null -> want 400', await req('PATCH',`/api/estimates/${est.id}`,{line_items:null})]);
R.push(['EST insurance_details:null -> want 400', await req('PATCH',`/api/estimates/${est.id}`,{insurance_details:null})]);
R.push(['EST deposit:null -> want 200 (client sends this)', await req('PATCH',`/api/estimates/${est.id}`,{deposit:null})]);
R.push(['INV line_items:null -> want 400', await req('PATCH',`/api/crm/invoices/${inv.id}`,{line_items:null})]);
R.push(['WO  line_items:null -> want 400', await req('PATCH',`/api/crm/work-orders/${wo.id}`,{line_items:null})]);
// regression: a VALID write (the row's OWN current array) must still 200
R.push(['EST valid line_items -> want 200', await req('PATCH',`/api/estimates/${est.id}`,{line_items:est.line_items||[]})]);
R.push(['INV valid line_items -> want 200', await req('PATCH',`/api/crm/invoices/${inv.id}`,{line_items:inv.line_items||[]})]);
R.push(['WO  valid line_items -> want 200', await req('PATCH',`/api/crm/work-orders/${wo.id}`,{line_items:wo.line_items||[]})]);
for(const [k,v] of R) console.log(v.st, k, v.st>=400?('| '+v.b):'');
const est2=(await q(`SELECT line_items,deposit,insurance_details FROM estimates WHERE id=$1`,[est.id]))[0];
const inv2=(await q(`SELECT line_items FROM invoices WHERE id=$1`,[inv.id]))[0];
const wo2 =(await q(`SELECT line_items FROM work_orders WHERE id=$1`,[wo.id]))[0];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
console.log('\nDATA INTACT:',
  'est.line_items',same(est.line_items,est2.line_items),
  '| est.deposit',same(est.deposit,est2.deposit),
  '| est.insurance',same(est.insurance_details,est2.insurance_details),
  '| inv',same(inv.line_items,inv2.line_items),
  '| wo',same(wo.line_items,wo2.line_items));
const cnt=await q(`SELECT (SELECT count(*) FROM estimates WHERE tenant_id=$1) e,(SELECT count(*) FROM invoices WHERE tenant_id=$1) i,(SELECT count(*) FROM work_orders WHERE tenant_id=$1) w,(SELECT count(*) FROM tasks WHERE tenant_id=$1) t`,[TEN]);
console.log('COUNTS:',JSON.stringify(cnt[0]));
await pool.end();
