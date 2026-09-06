// Run 125-s1 — GROUND-TRUTH multi-tenant isolation probe. Takes rows that provably belong
// to ANOTHER tenant and attacks them with the waterloo token across every route that
// accepts that row's id. A 2xx on a foreign row is a real isolation defect.
// Writes are identity-shaped and the row is snapshotted + compared afterwards.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const T=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={'Content-Type':'application/json',Authorization:`Bearer ${T}`};
const req=async(m,p,b)=>{const r=await fetch(BASE+p,{method:m,headers:H,body:b===undefined?undefined:JSON.stringify(b)});
  const ct=r.headers.get('content-type')||'';
  const t=/pdf|octet/.test(ct)?`pdf(${(await r.arrayBuffer()).byteLength}B)`:await r.text();
  let j=null;try{j=JSON.parse(t);}catch{}return{st:r.status,j,t:String(t).slice(0,110).replace(/\s+/g,' ')};};
const q=async(s,p)=>{try{return (await pool.query(s,p)).rows;}catch(e){return[{ERR:e.code+' '+e.message.slice(0,60)}];}};
const W=(await q(`SELECT id FROM tenants WHERE slug='waterloo'`))[0].id;

const LEAK=[],OK=[];
const judge=(label,st,extra='')=>{
  const leaked=st>=200&&st<300;
  (leaked?LEAK:OK).push(`${st} ${label} ${extra}`);
  console.log(`${leaked?'*** LEAK':'ok      '} ${String(st).padEnd(4)} ${label} ${extra}`);
};

// ---- pick rows with a NON-NULL tenant_id that is not waterloo
const fEst=(await q(`SELECT id,tenant_id,total,status FROM estimates WHERE tenant_id IS NOT NULL AND tenant_id<>$1 LIMIT 1`,[W]))[0];
const fUser=(await q(`SELECT id,tenant_id,email FROM users WHERE tenant_id IS NOT NULL AND tenant_id<>$1 LIMIT 1`,[W]))[0];
const fTpl=(await q(`SELECT id,tenant_id,name FROM estimate_templates WHERE tenant_id IS NOT NULL AND tenant_id<>$1 LIMIT 1`,[W]))[0];
const fPlan=(await q(`SELECT id,tenant_id FROM financing_plans WHERE tenant_id IS NOT NULL AND tenant_id<>$1 LIMIT 1`,[W]))[0];
const fStage=(await q(`SELECT id,tenant_id,name FROM pipeline_stages WHERE tenant_id IS NOT NULL AND tenant_id<>$1 LIMIT 1`,[W]))[0];
console.log('foreign fixtures:',JSON.stringify({fEst,fUser,fTpl,fPlan,fStage},null,1));

const snap=async(t,id)=>id?JSON.stringify((await q(`SELECT * FROM ${t} WHERE id=$1`,[id]))[0]):null;

console.log('\n=== FOREIGN ESTIMATE (read) ===');
if(fEst){
  for(const p of [`/api/estimates/${fEst.id}`,`/api/estimates/${fEst.id}/pdf`,`/api/crm/expenses/summary/${fEst.id}`]){
    const r=await req('GET',p); judge(`GET ${p}`,r.st,r.t.slice(0,60));
  }
  console.log('--- foreign estimate (write) ---');
  const b4=await snap('estimates',fEst.id);
  for(const [m,p,body] of [
    ['PATCH',`/api/estimates/${fEst.id}`,{status:'sent'}],
    ['POST',`/api/estimates/${fEst.id}/send`,{}],
    ['DELETE',`/api/estimates/${fEst.id}`,undefined],
  ]){const r=await req(m,p,body);judge(`${m} ${p}`,r.st,r.t.slice(0,60));}
  const af=await snap('estimates',fEst.id);
  console.log(b4===af?'PASS foreign estimate row UNCHANGED':'*** FOREIGN ROW MUTATED ***');
  if(b4!==af){console.log('before',b4);console.log('after ',af);}
}

console.log('\n=== FOREIGN USER (can waterloo assign work to another tenant\'s user?) ===');
if(fUser){
  const lead=(await q(`SELECT id FROM leads WHERE tenant_id=$1 LIMIT 1`,[W]))[0].id;
  const r=await req('POST','/api/crm/tasks',{title:'QA-R125 xt probe',lead_id:lead,assigned_to:fUser.id});
  judge(`POST /crm/tasks assigned_to=<foreign user>`,r.st,r.t.slice(0,70));
  if(r.j?.id)await pool.query(`DELETE FROM tasks WHERE id=$1`,[r.j.id]);
}

console.log('\n=== FOREIGN estimate_template / financing_plan / pipeline_stage ===');
for(const [lbl,row,paths] of [
  ['estimate_template',fTpl,[['PATCH','/api/estimates/templates/%s',{name:'HIJACK'}],['DELETE','/api/estimates/templates/%s',undefined]]],
  ['financing_plan',fPlan,[['PATCH','/api/crm/financing/plans/%s',{name:'HIJACK'}],['DELETE','/api/crm/financing/plans/%s',undefined]]],
  ['pipeline_stage',fStage,[['PATCH','/api/crm/pipeline-stages/%s',{name:'HIJACK'}],['DELETE','/api/crm/pipeline-stages/%s',undefined]]],
]){
  if(!row){console.log(`(no foreign ${lbl})`);continue;}
  const tbl=lbl+'s'==='estimate_templates'?'estimate_templates':(lbl==='financing_plan'?'financing_plans':'pipeline_stages');
  const b4=await snap(tbl,row.id);
  for(const [m,tpl,body] of paths){const p=tpl.replace('%s',row.id);const r=await req(m,p,body);judge(`${m} ${p}`,r.st,r.t.slice(0,60));}
  const af=await snap(tbl,row.id);
  console.log(b4===af?`PASS foreign ${lbl} row UNCHANGED`:`*** FOREIGN ${lbl} MUTATED ***`);
}

console.log(`\n=== ${LEAK.length} LEAKS / ${OK.length} correctly refused ===`);
LEAK.forEach(l=>console.log('LEAK:',l));
await pool.end();
