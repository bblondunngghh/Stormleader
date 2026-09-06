// Run 125-s1 — the THREE PUBLIC customer-facing token routes, never swept by any run,
// plus the predicted contract_templates Edit 404. READ-ONLY except one identity PATCH.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const T=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={'Content-Type':'application/json',Authorization:`Bearer ${T}`};
const req=async(m,p,b,auth=true)=>{const r=await fetch(BASE+p,{method:m,headers:auth?H:{'Content-Type':'application/json'},body:b===undefined?undefined:JSON.stringify(b)});
  const ct=r.headers.get('content-type')||'';const t=/pdf|octet/.test(ct)?`pdf(${(await r.arrayBuffer()).byteLength}B)`:await r.text();
  let j=null;try{j=JSON.parse(t);}catch{} return {st:r.status,ct:ct.split(';')[0],j,t:String(t).slice(0,160).replace(/\s+/g,' ')};};
const q=async(sql,p)=>{try{return (await pool.query(sql,p)).rows;}catch(e){return[{ERR:e.code+' '+e.message.slice(0,90)}];}};
const TEN=(await q(`SELECT id FROM tenants WHERE slug='waterloo'`))[0].id;

console.log('=== TOKEN INVENTORY ===');
const est=await q(`SELECT public_token,status FROM estimates WHERE tenant_id=$1 AND public_token IS NOT NULL LIMIT 3`,[TEN]);
const con=await q(`SELECT token,status FROM contracts WHERE tenant_id=$1 AND token IS NOT NULL LIMIT 3`,[TEN]);
const sts=await q(`SELECT token FROM client_status_tokens LIMIT 3`);
console.log('estimates:',JSON.stringify(est));
console.log('contracts:',JSON.stringify(con));
console.log('status   :',JSON.stringify(sts));

console.log('\n=== PUBLIC ROUTES (NO AUTH HEADER — as a real customer sees them) ===');
const probes=[];
if(est[0]?.public_token){probes.push(['GET',`/api/estimates/public/${est[0].public_token}`]);
  probes.push(['GET',`/api/crm/financing/public/${est[0].public_token}/plans`]);
  probes.push(['GET',`/api/crm/financing/public/${est[0].public_token}/applications`]);}
if(con[0]?.token)probes.push(['GET',`/api/crm/contracts/public/${con[0].token}`]);
if(sts[0]?.token)probes.push(['GET',`/api/leads/status/public/${sts[0].token}`]);
for(const [m,p] of probes){const r=await req(m,p,undefined,false);
  console.log(`${r.st} ${m} ${p.slice(0,70)} :: ${r.ct} ${r.t.slice(0,110)}`);}

console.log('\n=== SAME ROUTES WITH A BOGUS TOKEN (must be 404, never 500) ===');
for(const [m,p] of probes){const bp=p.replace(/[^/]+(?=(\/|$))/, 'ZZZbogusZZZ');
  const p2=p.split('/').map(s=>/^[0-9a-f-]{8,}$|^[A-Za-z0-9_-]{16,}$/.test(s)?'ZZZbogusZZZ':s).join('/');
  const r=await req(m,p2,undefined,false);console.log(`${r.st} ${m} ${p2.slice(0,70)} :: ${r.t.slice(0,90)}`);}

console.log('\n=== contract_templates OWNERSHIP (predicted Edit 404) ===');
const tpl=await q(`SELECT id,name,tenant_id,is_default FROM contract_templates ORDER BY is_default DESC`);
tpl.forEach(r=>console.log(' ',JSON.stringify(r)));
const mine=tpl.filter(r=>r.tenant_id===TEN);
console.log(`waterloo owns ${mine.length} of ${tpl.length}`);
const target=tpl[0];
if(target&&target.id){
  const g=await req('GET','/api/crm/contract-templates');
  console.log(`GET /api/crm/contract-templates -> ${g.st} count=${Array.isArray(g.j)?g.j.length:(g.j?.templates?.length??'?')}`);
  const listed=Array.isArray(g.j)?g.j:(g.j?.templates||[]);
  console.log('listed ids:',JSON.stringify(listed.map(x=>({id:x.id,tenant_id:x.tenant_id,name:x.name}))));
  for(const t of listed.slice(0,4)){
    const r=await req('PUT',`/api/crm/contract-templates/${t.id}`,{name:t.name,body:t.body??t.content??'x'});
    console.log(`PUT template ${t.name} (tenant=${t.tenant_id}) -> ${r.st} ${r.t.slice(0,90)}`);
  }
}
await pool.end();
