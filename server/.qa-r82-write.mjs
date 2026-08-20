import fs from 'fs';
const TOKEN=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const I=JSON.parse(fs.readFileSync('C:/tmp/qa-r82-ids.json','utf8'));
const INV=JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json','utf8'));
const BASE='http://localhost:3001', DEAD='00000000-0000-4000-8000-000000000000';

const HARD_SKIP=/auth\/(login|register|logout)|counties\/:id\/import|properties\/(trigger-import|geocode|import-csv)|skip-trace|webhooks|payments\/webhook/i;
const DEADONLY=/\/(send|send-email|test-email)$/i;

const P={leadId:I.lead,estimateId:I.estimate,invoiceId:I.invoice,contractId:I.contract,
 workOrderId:I.workOrder,taskId:I.task,propertyId:I.property,stormId:I.stormEvent,
 userId:I.user,tenantId:I.tenantId,pinId:I.canvassPin,orderId:I.materialOrder,
 token:I.estimateToken,subcontractorId:I.subcontractor,expenseId:I.expense,
 activityId:I.activity,contactId:I.contact,fieldId:I.customField,memberId:I.user,
 listId:I.prospectList,planId:I.financingPlan,lenderId:I.financingLender,countyId:I.county};

const created=[]; const results=[];
async function call(method,path,url,body,kind){
  try{
    const t0=Date.now();
    const r=await fetch(BASE+url,{method,headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const ms=Date.now()-t0;
    const ct=r.headers.get('content-type')||'';
    let j=null,txt='';
    if(ct.includes('json')){ j=await r.json().catch(()=>null); txt=JSON.stringify(j); } else txt=(await r.text()).slice(0,200);
    if(r.status>=200&&r.status<300&&j&&j.id&&method==='POST') created.push({path,id:j.id,url});
    if(r.status>=200&&r.status<300&&j&&j.data&&j.data.id&&method==='POST') created.push({path,id:j.data.id,url});
    results.push({method,path,url,kind,status:r.status,ms,snip:txt.slice(0,240)});
    return {status:r.status,j};
  }catch(e){ results.push({method,path,url,kind,status:'FETCH_ERR',snip:e.message}); return {status:'ERR'}; }
}

for(const r of INV){
  if(r.method==='GET') continue;
  if(HARD_SKIP.test(r.path)){ results.push({...r,kind:'-',status:'SKIP',snip:'charter-prohibited / destructive'}); continue; }
  const deadOnly=DEADONLY.test(r.path);
  for(const useReal of (deadOnly?[false]:[false,true])){
    let url=r.path.replace(/:([A-Za-z0-9_]+)\??/g,(m,n)=>{
      if(!useReal) return DEAD;
      return (P[n]!==undefined&&P[n]!==null)?P[n]:(n==='id'?idFor(r.path):DEAD);
    });
    if(useReal && !r.path.includes(':')) continue;  // no params -> real pass identical
    await call(r.method,r.path,url,{}, useReal?'{} real-id':'{} dead-id');
  }
}
function idFor(p){
  if(p.startsWith('/api/crm/leads')||p.startsWith('/api/leads'))return I.lead;
  if(p.startsWith('/api/estimates'))return I.estimate;
  if(p.startsWith('/api/crm/invoices'))return I.invoice;
  if(p.startsWith('/api/crm/contracts'))return I.contract;
  if(p.startsWith('/api/crm/work-orders'))return I.workOrder;
  if(p.startsWith('/api/crm/tasks'))return I.task;
  if(p.startsWith('/api/crm/expenses'))return I.expense;
  if(p.startsWith('/api/crm/subcontractors'))return I.subcontractor;
  if(p.startsWith('/api/crm/canvass-pins'))return I.canvassPin;
  if(p.startsWith('/api/crm/custom-fields'))return I.customField;
  if(p.startsWith('/api/crm/prospect-lists'))return I.prospectList;
  if(p.startsWith('/api/crm/financing'))return I.financingPlan;
  if(p.startsWith('/api/materials'))return I.materialOrder;
  if(p.startsWith('/api/counties'))return I.county;
  if(p.startsWith('/api/properties'))return I.property;
  if(p.startsWith('/api/storms'))return I.stormEvent;
  if(p.startsWith('/api/admin/tenants'))return I.tenantId;
  return DEAD;
}
fs.writeFileSync('C:/tmp/qa-r82-write-results.json',JSON.stringify(results,null,1));
fs.writeFileSync('C:/tmp/qa-r82-created.json',JSON.stringify(created,null,1));
const by={}; for(const x of results) by[x.status]=(by[x.status]||0)+1;
console.log('write calls:',results.length,JSON.stringify(by));
console.log('\n=== 5xx ===');
const bad=results.filter(x=>typeof x.status==='number'&&x.status>=500);
for(const x of bad) console.log(`${x.status} ${x.method} ${x.path} [${x.kind}]\n   ${x.snip}`);
console.log('\n=== 2xx ON EMPTY BODY (created rows / no-validation) ===');
for(const x of results.filter(y=>typeof y.status==='number'&&y.status<300&&y.status>=200)) console.log(`${x.status} ${x.method} ${x.path} [${x.kind}] ${x.snip.slice(0,110)}`);
console.log('\nCREATED rows:',created.length, JSON.stringify(created).slice(0,600));
