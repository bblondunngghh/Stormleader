// Run 125-s1 — for every create endpoint that takes a client-supplied lead_id, does the
// server accept a lead belonging to ANOTHER tenant? If yes, and that resource's read path
// joins leads unscoped (see qa-r125-joinscan.json), it is the tasks defect all over again.
// Creates one foreign lead + one row per endpoint, reads back, deletes everything.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const T=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={'Content-Type':'application/json',Authorization:`Bearer ${T}`};
const req=async(m,p,b)=>{const r=await fetch(BASE+p,{method:m,headers:H,body:b===undefined?undefined:JSON.stringify(b)});
  const t=await r.text();let j=null;try{j=JSON.parse(t);}catch{}return{st:r.status,j,t:t.slice(0,120).replace(/\s+/g,' ')};};
const q=async(s,p)=>(await pool.query(s,p)).rows;
const W=(await q(`SELECT id FROM tenants WHERE slug='waterloo'`))[0].id;
const OTHER=(await q(`SELECT id FROM tenants WHERE slug='stormleads-test'`))[0].id;
const MARK='ZZ-VICTIM-CUSTOMER', ADDR='999 SECRET STREET';
const FL=(await q(`INSERT INTO leads (tenant_id,contact_name,address,city) VALUES ($1,$2,$3,'Nowhere') RETURNING id`,[OTHER,MARK,ADDR]))[0].id;
console.log('foreign lead fixture:',FL,'\n');

const CASES=[
  ['contracts', 'POST','/api/crm/contracts', {lead_id:FL,title:'QA-R125'},                 'GET','/api/crm/contracts'],
  ['invoices',  'POST','/api/crm/invoices',  {lead_id:FL,line_items:[],total:1},           'GET','/api/crm/invoices'],
  ['expenses',  'POST','/api/crm/expenses',  {lead_id:FL,category:'material',amount:1,date:'2026-09-05'},'GET','/api/crm/expenses'],
  ['estimates', 'POST','/api/estimates',     {lead_id:FL,line_items:[],total:1},           'GET','/api/estimates'],
  ['work_orders','POST','/api/crm/work-orders',{lead_id:FL,title:'QA-R125'},               'GET','/api/crm/work-orders'],
  ['documents', 'POST','/api/crm/documents', {lead_id:FL,name:'QA-R125',url:'http://x/y'}, 'GET','/api/crm/documents'],
  ['activities','POST','/api/crm/activities',{lead_id:FL,type:'note',notes:'QA-R125'},     'GET','/api/crm/leads/'+FL+'/activities'],
];
const created=[];const LEAK=[],SAFE=[],NA=[];
for(const [name,m,p,body,gm,gp] of CASES){
  const r=await req(m,p,body);
  if(r.st>=400){SAFE.push(`${name}: create refused ${r.st} ${r.t.slice(0,70)}`);console.log(`ok       ${r.st} POST ${p} -> refused: ${r.t.slice(0,70)}`);continue;}
  created.push([name,r.j?.id]);
  console.log(`ACCEPTED ${r.st} POST ${p} (id=${r.j?.id})`);
  const g=await req(gm,gp);
  const blob=JSON.stringify(g.j||'');
  const leaked=blob.includes(MARK)||blob.includes(ADDR);
  if(leaked){LEAK.push(`${name}: ${gm} ${gp} discloses foreign lead PII`);console.log(`   *** LEAK ${gm} ${gp} -> foreign customer name/address in response`);}
  else {NA.push(`${name}: FK accepted but ${gp} did not echo foreign PII`);console.log(`   (accepted, but ${gp} did not echo the foreign PII)`);}
}
// cleanup
for(const [name,id] of created){if(!id)continue;
  const tbl={contracts:'contracts',invoices:'invoices',expenses:'expenses',estimates:'estimates',work_orders:'work_orders',documents:'documents',activities:'activities'}[name];
  try{await pool.query(`DELETE FROM ${tbl} WHERE id=$1`,[id]);}catch(e){console.log('cleanup err',tbl,e.code);}}
await pool.query(`DELETE FROM leads WHERE id=$1`,[FL]);
const leftovers=(await q(`SELECT count(*)::int c FROM leads WHERE contact_name=$1`,[MARK]))[0].c;
console.log(`\ncleanup: foreign-lead leftovers = ${leftovers}`);
console.log(`\n=== ${LEAK.length} CONFIRMED LEAKS ===`);LEAK.forEach(l=>console.log(' *',l));
console.log(`=== ${NA.length} FK accepted, no PII echo ===`);NA.forEach(l=>console.log(' -',l));
console.log(`=== ${SAFE.length} create refused ===`);SAFE.forEach(l=>console.log(' -',l));
await pool.end();
