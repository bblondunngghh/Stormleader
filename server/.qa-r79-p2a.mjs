// Run 79 s1 pass 2a — lifecycle on resources with ZERO rows: drip sequences, automations,
// territories, financing applications. These handlers have never executed on real stored data.
import fs from 'node:fs';
const API='http://localhost:3001';
const TOKEN=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const IDS=JSON.parse(fs.readFileSync('C:/tmp/qa-r79-ids.json','utf8')).ids;
const R=[];
async function req(method,path,body){
  const o={method,headers:{Authorization:`Bearer ${TOKEN}`,'Content-Type':'application/json'}};
  if(body!==undefined)o.body=JSON.stringify(body);
  const t0=Date.now();
  try{
    const r=await fetch(API+path,o);
    const ct=r.headers.get('content-type')||'';
    let txt; if(ct.includes('json')){txt=await r.text();}else{const b=await r.arrayBuffer();txt=`<${ct} ${b.byteLength}b>`;}
    const rec={method,path,status:r.status,ms:Date.now()-t0,body:txt.slice(0,300)};
    R.push(rec);
    console.log(String(r.status).padEnd(4),method.padEnd(6),path,'::',txt.slice(0,110).replace(/\n/g,' '));
    try{return JSON.parse(txt);}catch{return txt;}
  }catch(e){R.push({method,path,status:0,body:'FETCH-ERR '+e.message});console.log('ERR ',method,path,e.message);return null;}
}
const created={};

console.log('===== A. DRIP SEQUENCE =====');
const seq=await req('POST','/api/crm/drip-sequences',{name:'QA79 Sequence',trigger_type:'lead_created',
  trigger_config:{stage:'new'},
  steps:[{step_order:1,delay_days:0,channel:'email',subject:'QA79 hello',body:'QA79 body {{first_name}}'},
         {step_order:2,delay_days:3,channel:'sms',body:'QA79 followup'}]});
if(seq&&seq.id){created.seq=seq.id;
  await req('GET',`/api/crm/drip-sequences/${seq.id}`);
  await req('PATCH',`/api/crm/drip-sequences/${seq.id}`,{name:'QA79 Sequence v2',is_active:true});
  await req('POST',`/api/crm/drip-sequences/${seq.id}/enroll`,{leadId:IDS.lead});
  await req('POST',`/api/crm/drip-sequences/${seq.id}/enroll`,{lead_id:IDS.lead});
  await req('GET',`/api/crm/drip-sequences/${seq.id}/enrollments`);
  await req('POST',`/api/crm/drip-sequences/${seq.id}/cancel`,{leadId:IDS.lead});
}

console.log('===== B. AUTOMATION =====');
const au=await req('POST','/api/crm/automations',{name:'QA79 Automation',trigger_type:'stage_changed',
  trigger_config:{to_stage:'appt_set'},action_type:'create_task',action_config:{title:'QA79 task',due_in_days:1}});
if(au&&au.id){created.au=au.id;
  await req('PATCH',`/api/crm/automations/${au.id}`,{name:'QA79 Automation v2'});
  await req('PATCH',`/api/crm/automations/${au.id}/toggle`,{});
  await req('PATCH',`/api/crm/automations/${au.id}/toggle`,{});
  await req('GET','/api/crm/automations');
}

console.log('===== C. TERRITORY =====');
const terr=await req('POST','/api/crm/territories',{name:'QA79 Territory',color:'#3366ff',
  coordinates:[[-97.4,32.7],[-97.3,32.7],[-97.3,32.8],[-97.4,32.8],[-97.4,32.7]],notes:'QA79'});
if(terr&&terr.id){created.terr=terr.id;
  await req('GET',`/api/crm/territories/${terr.id}`);
  await req('GET',`/api/crm/territories/${terr.id}/pins`);
  await req('PATCH',`/api/crm/territories/${terr.id}`,{name:'QA79 Territory v2',assigned_user_id:IDS.teamUser});
  await req('GET','/api/crm/territories');
}

console.log('===== D. FINANCING APPLICATION (mock provider) =====');
const app=await req('POST','/api/crm/financing/applications',
  {leadId:IDS.lead,planId:'39f9d453-73b1-49fb-ab58-835517cb2dde',estimateId:IDS.estimate,
   amount:1250000,customerName:'QA79 Customer',customerEmail:'qa79@example.com',callbackUrl:'http://localhost:5173/cb'});
if(app&&app.id){created.app=app.id;
  await req('GET',`/api/crm/financing/applications/${app.id}`);
  await req('GET','/api/crm/financing/applications');
  await req('GET',`/api/crm/financing/applications?leadId=${IDS.lead}`);
}

console.log('===== CLEANUP (DELETE routes) =====');
if(created.seq) await req('DELETE',`/api/crm/drip-sequences/${created.seq}`);
if(created.au)  await req('DELETE',`/api/crm/automations/${created.au}`);
if(created.terr)await req('DELETE',`/api/crm/territories/${created.terr}`);

fs.writeFileSync('C:/tmp/qa-r79-p2a.json',JSON.stringify({created,R},null,1));
console.log('\n5xx:',R.filter(x=>x.status>=500||x.status===0).length,'  created(left):',JSON.stringify(created));
