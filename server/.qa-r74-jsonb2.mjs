import pool from './src/db/pool.js';
const BASE='http://localhost:3001', TENANT='791bb51d-3293-4839-92e9-bd4d4f873af2';
const mint=async()=>(await(await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email:'waterlooconstruction1@gmail.com',password:'2Wealth&health',tenantSlug:'waterloo'})})).json()).accessToken;
const H={Authorization:`Bearer ${await mint()}`,'Content-Type':'application/json'};
const req=async(m,p,b)=>{const r=await fetch(BASE+p,{method:m,headers:H,body:b===undefined?undefined:JSON.stringify(b)});
  const t=await r.text(); let j=null; try{j=JSON.parse(t);}catch{} return {status:r.status,json:j,text:t.slice(0,160)};};
const leadId=(await pool.query('SELECT id FROM leads WHERE tenant_id=$1 LIMIT 1',[TENANT])).rows[0].id;
const SHAPES=[['string','abcde'],['number',12345],['bool',true],['object',{a:1}],
              ['array-of-null',[null]],['array-of-scalar',[1,'',null]],['nested',[{q:{deep:1}}]]];
const CASES=[
 {n:'estimates.line_items', t:'estimates', f:'line_items', c:['POST','/api/estimates',{lead_id:leadId,customer_name:'QA r74 probe',line_items:[]}], u:id=>`/api/estimates/${id}`, pdf:id=>`/api/estimates/${id}/pdf`},
 {n:'estimates.upgrades', t:'estimates', f:'upgrades', c:['POST','/api/estimates',{lead_id:leadId,customer_name:'QA r74 probe',line_items:[]}], u:id=>`/api/estimates/${id}`, pdf:id=>`/api/estimates/${id}/pdf`},
 {n:'estimates.insurance_details', t:'estimates', f:'insurance_details', c:['POST','/api/estimates',{lead_id:leadId,customer_name:'QA r74 probe',line_items:[]}], u:id=>`/api/estimates/${id}`, pdf:id=>`/api/estimates/${id}/pdf`},
 {n:'estimates.financing_plan_ids', t:'estimates', f:'financing_plan_ids', c:['POST','/api/estimates',{lead_id:leadId,customer_name:'QA r74 probe',line_items:[]}], u:id=>`/api/estimates/${id}`, pdf:id=>`/api/estimates/${id}/pdf`},
 {n:'invoices.line_items', t:'invoices', f:'line_items', c:['POST','/api/crm/invoices',{lead_id:leadId,customer_name:'QA r74 probe',line_items:[]}], u:id=>`/api/crm/invoices/${id}`, pdf:null},
 {n:'work_orders.line_items', t:'work_orders', f:'line_items', c:['POST','/api/crm/work-orders',{lead_id:leadId,title:'QA r74 probe',line_items:[]}], u:id=>`/api/crm/work-orders/${id}`, pdf:id=>`/api/crm/work-orders/${id}/pdf`},
];
const created={estimates:[],invoices:[],work_orders:[]}; const summary=[];
for (const c of CASES) {
  const res=await req(...c.c);
  const id=res.json?.id||res.json?.estimate?.id||res.json?.invoice?.id||res.json?.workOrder?.id;
  if(!id){console.log(`SKIP ${c.n}: create -> ${res.status} ${res.text}`);continue;}
  created[c.t].push(id);
  console.log(`\n--- ${c.n} ---`);
  let acc=0;
  for (const [label,shape] of SHAPES) {
    const pr=await req('PATCH',c.u(id),{[c.f]:shape});
    let stored='-', pdfStatus='-';
    if(pr.status<300){ acc++;
      stored=String((await pool.query(`SELECT ${c.f}::text v FROM ${c.t} WHERE id=$1`,[id])).rows[0]?.v).slice(0,34);
      if(c.pdf){ const pd=await fetch(BASE+c.pdf(id),{headers:H}); pdfStatus=pd.status; }
    }
    console.log(`  PATCH ${String(pr.status).padEnd(4)} ${label.padEnd(16)} stored=${stored.padEnd(36)} PDF=${pdfStatus}`);
  }
  summary.push({n:c.n,acc,tot:SHAPES.length});
}
console.log('\n=========== JSONB WRITE-GUARD COVERAGE ===========');
summary.forEach(s=>console.log(`${s.n.padEnd(32)} accepted ${s.acc}/${s.tot} hostile shapes  ${s.acc===0?'GUARDED':s.acc===s.tot?'** UNGUARDED **':'PARTIAL (container only)'}`));
console.log('\ncleanup:');
for (const [t,arr] of Object.entries(created)) { if(!arr.length) continue;
  const {rowCount}=await pool.query(`DELETE FROM ${t} WHERE id=ANY($1::uuid[])`,[arr]); console.log(`  ${t}: deleted ${rowCount}/${arr.length}`); }
for (const t of ['estimates','invoices','work_orders'])
  console.log(`  ${t} now:`,(await pool.query(`SELECT COUNT(*)::int n FROM ${t}`)).rows[0].n);
await pool.end();
