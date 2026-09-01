// Run 114 s1 — DUPLICATE / BRACKETED QUERY PARAMS. Express `qs` turns `?x=a&x=b` into an
// ARRAY and `?x[y]=1` into an OBJECT. Every handler that treats req.query.X as a string
// (String coercion, whitelist lookup, .trim(), regex test, parseInt) sees a shape it never
// planned for. Untested dimension as of Run 113.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const T=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const I=JSON.parse(fs.readFileSync('C:/tmp/qa-r85-ids.json','utf8'));
const inv=JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json','utf8'));
const DEAD='00000000-0000-4000-8000-000000000000';
const SKIP=/import|geocode|\/send|email|\/sms|webhook|skip-trace\/(run|start)|logout|login|register|refresh|score-all|correct-all|mark-all-read|\/complete|alerts\/test|\/pdf/i;
const byPath=[[/\/leads\//,'lead'],[/\/estimates\//,'estimate'],[/\/invoices\//,'invoice'],[/\/contracts\//,'contract'],[/\/work-orders\//,'workOrder'],[/\/expenses\//,'expense'],[/\/subcontractors\//,'subcontractor'],[/\/canvass-pins\//,'canvassPin'],[/\/team\//,'user'],[/\/properties\//,'property'],[/\/material-orders\//,'materialOrder'],[/\/storm-events\//,'stormEvent'],[/\/tasks\//,'task'],[/\/documents\//,'document'],[/\/contacts\//,'contact'],[/\/drip-sequences\//,'dripSequence'],[/\/automations\//,'automation'],[/\/notifications\//,'notification'],[/\/custom-fields\//,'customField'],[/\/alert-configs\//,'alertConfig'],[/\/tenants\//,'tenantId']];
const resolve=p=>{let o=p;for(const m of [...p.matchAll(/:(\w+)/g)].map(x=>x[1])){let v=DEAD;
  if(/^contractToken$/i.test(m))v=I.contractToken||DEAD; else if(/token/i.test(m))v=I.estimateToken||DEAD;
  else if(/^(userId|memberId)$/.test(m))v=I.user||DEAD; else if(/^leadId$/.test(m))v=I.lead||DEAD;
  else if(/^(woId|workOrderId)$/.test(m))v=I.workOrder||DEAD;
  else for(const [re,k] of byPath){if(re.test(p)&&I[k]){v=I[k];break;}}
  o=o.replace(':'+m,v);} return o;};
// The param names the server actually reads (routes + services), from the Run 77 lesson.
const PARAMS=['page','limit','sort_by','sort_dir','status','stage','search','q','type','days','bbox','start_date','end_date','lead_id','assigned_to','priority','entity_type','source','category','is_active','severity','state','county','event_type','min_score','offset','ids','filter','view','group_by','provider','year','month'];
const VARIANTS=[
  {k:'dup-array', mk:p=>`${p}=1&${p}=2`},          // qs -> ['1','2']
  {k:'obj',       mk:p=>`${encodeURIComponent(p+'[a]')}=1`},  // qs -> {a:'1'}
  {k:'nested-arr',mk:p=>`${encodeURIComponent(p+'[]')}=1&${encodeURIComponent(p+'[]')}=2`},
];
const gets=inv.filter(r=>r.method==='GET'&&!SKIP.test(r.path));
const results=[],defects=[];
for(const v of VARIANTS){
  const counts={};
  for(const r of gets){
    const url=resolve(r.path);
    for(const p of PARAMS){
      const q=v.mk(p);
      let res;
      try{ const f=await fetch(`${BASE}${url}?${q}`,{headers:{Authorization:`Bearer ${T}`}});
           res={st:f.status, body:(await f.text()).slice(0,220)}; }
      catch(e){ res={st:'THREW', body:String(e).slice(0,200)}; }
      counts[res.st]=(counts[res.st]||0)+1;
      results.push({v:v.k,path:r.path,p,st:res.st});
      if((typeof res.st==='number'&&res.st>=500)||res.st==='THREW')
        defects.push({v:v.k,path:r.path,param:p,url:`${url}?${q}`,st:res.st,body:res.body.replace(/\n/g,' ')});
    }
  }
  console.log(`[${v.k}] ${gets.length} routes x ${PARAMS.length} params = ${gets.length*PARAMS.length} reqs | ${JSON.stringify(counts)}`);
}
console.log(`\nTOTAL ${results.length} requests`);
console.log(`5xx/THREW: ${defects.length}`);
const seen=new Set();
for(const d of defects){ const k=d.v+' '+d.path+' '+d.st; if(seen.has(k))continue; seen.add(k);
  console.log(`  [${d.v}] ${d.st} ${d.path}  param=${d.param}\n      ${d.body}`); }
fs.writeFileSync('C:/tmp/qa-r114-qparam.json',JSON.stringify({results,defects},null,1));
await pool.end();
