// Run 94 s1 — POST/DELETE empty-body validation sweep. Missing required fields must 400, never 500.
// EXCLUSIONS are safety-critical, not cosmetic:
//   /import/i  -> trigger-import starts a REAL background bulk property import (hyphen, not slash!)
//   send/email/sms/webhook -> outbound side effects
//   geocode -> costs money
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const TOKEN=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const inv=JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json','utf8'));
const I=JSON.parse(fs.readFileSync('C:/tmp/qa-r85-ids.json','utf8'));
const DEAD='00000000-0000-4000-8000-000000000000';

const SKIP=/import|geocode|\/send|email|\/sms|webhook|skip-trace\/(run|start)|logout|login|register/i;

function resolve(path,dead){
  let p=path;
  const byPath=[[/\/leads\//,'lead'],[/\/estimates\//,'estimate'],[/\/invoices\//,'invoice'],
    [/\/contracts\//,'contract'],[/\/work-orders\//,'workOrder'],[/\/expenses\//,'expense'],
    [/\/subcontractors\//,'subcontractor'],[/\/canvass-pins\//,'canvassPin'],
    [/\/territories\//,'territory'],[/\/team\//,'user'],[/\/properties\//,'property'],
    [/\/material-orders\//,'materialOrder'],[/\/storm-events\//,'stormEvent'],[/\/tenants\//,'tenantId']];
  for(const m of [...path.matchAll(/:(\w+)/g)].map(x=>x[1])){
    let v=dead?DEAD:null;
    if(!dead){
      if(/token/i.test(m)) v=I.estimateToken;
      else if(/^(userId|memberId)$/.test(m)) v=I.user;
      else if(/^(leadId)$/.test(m)) v=I.lead;
      else if(/^(woId|workOrderId)$/.test(m)) v=I.workOrder;
      else { for(const[re,k]of byPath){ if(re.test(path)&&I[k]){v=I[k];break;} } }
      if(!v) v=DEAD;
    }
    p=p.replace(':'+m,v);
  }
  return p;
}
const snapAll=async()=>{const r=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;const c={};
  for(const{tablename}of r){try{c[tablename]=(await pool.query(`SELECT count(*)::int n FROM "${tablename}"`)).rows[0].n;}catch{}}return c;};

const targets=inv.filter(r=>['POST','DELETE'].includes(r.method));
const skipped=targets.filter(r=>SKIP.test(r.path));
const run=targets.filter(r=>!SKIP.test(r.path));
console.log(`POST/DELETE total ${targets.length} | sweeping ${run.length} | EXCLUDED (side-effecting) ${skipped.length}`);
skipped.forEach(r=>console.log(`   excl: ${r.method} ${r.path}`));

const before=await snapAll();
const rows=[],defects=[];
// DEAD ids only — an empty-body POST with a real parent id could create a row.
for(const r of run){
  const url=resolve(r.path,true);
  let st,body='';
  try{const res=await fetch(BASE+url,{method:r.method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${TOKEN}`},body:r.method==='POST'?'{}':undefined});
    st=res.status;body=(await res.text()).slice(0,250);}catch(e){st='THREW';body=String(e).slice(0,200);}
  const bad=(typeof st==='number'&&st>=500)||st==='THREW';
  rows.push({m:r.method,path:r.path,st});
  if(bad)defects.push({m:r.method,path:r.path,url,st,body});
}
const after=await snapAll();
const drift=Object.keys(after).filter(t=>before[t]!==after[t]).map(t=>`${t}: ${before[t]}->${after[t]}`);
const b={};for(const r of rows)b[r.st]=(b[r.st]||0)+1;
console.log('\nswept:',rows.length,'| buckets:',JSON.stringify(b));
console.log('global row-count drift:',drift.length?drift.join(', '):'NONE (0 net writes)');
console.log('\n=== 5xx / THREW:',defects.length,'===');
for(const d of defects)console.log(`  ${d.st}  ${d.m} ${d.path}\n       ${d.url}\n       ${d.body.replace(/\s+/g,' ').slice(0,240)}`);
const twoxx=rows.filter(r=>typeof r.st==='number'&&r.st>=200&&r.st<300);
console.log('\n=== 2xx on a DEAD id (unexpected — should be 404/400) ===');
twoxx.forEach(r=>console.log(`  ${r.st}  ${r.m} ${r.path}`));
fs.writeFileSync('C:/tmp/qa-r94-write.json',JSON.stringify(rows,null,1));
await pool.end();
