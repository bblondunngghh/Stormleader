// Run 94 s1 — FULL GET sweep. All 132 GET routes, real ids substituted from context.
import fs from 'fs';
const BASE='http://localhost:3001';
const TOKEN=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const inv=JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json','utf8'));
const I=JSON.parse(fs.readFileSync('C:/tmp/qa-r85-ids.json','utf8'));

// map a :param to a real id using the route path as context
function resolve(path){
  let p=path;
  const seg=(re,val)=>{ if(val&&re.test(path)) return val; return null; };
  const byPath=[
    [/\/leads\//,'lead'],[/\/estimates\//,'estimate'],[/\/invoices\//,'invoice'],
    [/\/contracts\/templates\//,'contractTemplate'],[/\/contracts\//,'contract'],
    [/\/work-orders\//,'workOrder'],[/\/tasks\//,'task'],[/\/expenses\//,'expense'],
    [/\/subcontractors\//,'subcontractor'],[/\/documents\//,'document'],
    [/\/activities\//,'activity'],[/\/contacts\//,'contact'],
    [/\/drip-sequences\//,'dripSequence'],[/\/automations\//,'automation'],
    [/\/canvass-pins\//,'canvassPin'],[/\/material-orders\//,'materialOrder'],
    [/\/notifications\//,'notification'],[/\/territories\//,'territory'],
    [/\/team\//,'user'],[/\/users\//,'user'],[/\/properties\//,'property'],
    [/\/financing\/plans\//,'financingPlan'],[/\/financing\/lenders\//,'financingLender'],
    [/\/financing\/applications\//,'financingApp'],[/\/prospect-lists\//,'prospectList'],
    [/\/custom-fields\//,'customField'],[/\/storm-events\//,'stormEvent'],
    [/\/tenants\//,'tenantId'],[/\/estimates\/templates\//,'estimateTemplate'],
  ];
  const params=[...path.matchAll(/:(\w+)/g)].map(m=>m[1]);
  for(const param of params){
    let val=null;
    // token params
    if(/token/i.test(param)) val = /contract|status/.test(path)?I.contractToken:I.estimateToken;
    if(!val && /milestoneId/i.test(param)) val=null;
    if(!val && /^(userId|memberId)$/.test(param)) val=I.user;
    if(!val && /^(leadId)$/.test(param)) val=I.lead;
    if(!val && /^(woId|workOrderId)$/.test(param)) val=I.workOrder;
    if(!val && /^(estimateId)$/.test(param)) val=I.estimate;
    if(!val && /^(stepId)$/.test(param)) val=I.dripStep;
    if(!val && /^(zip)$/.test(param)) val='50701';
    if(!val && /^(state)$/.test(param)) val='IA';
    if(!val){ for(const [re,key] of byPath){ if(re.test(path)&&I[key]){ val=I[key]; break; } } }
    if(!val) val=I.lead; // last resort: a valid uuid so we exercise the handler, not the validator
    p=p.replace(':'+param,val);
  }
  return p;
}

const gets=inv.filter(r=>r.method==='GET');
const rows=[]; const defects=[];
for(const r of gets){
  const url=resolve(r.path);
  let st,body='',ms=Date.now();
  try{
    const res=await fetch(BASE+url,{headers:{Authorization:`Bearer ${TOKEN}`}});
    st=res.status; body=(await res.text()).slice(0,300);
  }catch(e){ st='THREW'; body=String(e).slice(0,200); }
  ms=Date.now()-ms;
  const bad=(typeof st==='number'&&st>=500)||st==='THREW';
  rows.push({path:r.path,url,st,ms,len:body.length});
  if(bad) defects.push({path:r.path,url,st,body});
}
const b={}; for(const r of rows) b[r.st]=(b[r.st]||0)+1;
console.log('GET routes swept:',rows.length);
console.log('status buckets:',JSON.stringify(b));
console.log('\n=== 5xx / THREW:',defects.length,'===');
for(const d of defects) console.log(`  ${d.st}  GET ${d.path}\n       ${d.url}\n       ${d.body.replace(/\s+/g,' ').slice(0,240)}`);
console.log('\n=== non-2xx (for triage) ===');
for(const r of rows.filter(r=>typeof r.st==='number'&&(r.st<200||r.st>=300))) console.log(`  ${r.st}  GET ${r.path}`);
fs.writeFileSync('C:/tmp/qa-r94-get.json',JSON.stringify(rows,null,1));
