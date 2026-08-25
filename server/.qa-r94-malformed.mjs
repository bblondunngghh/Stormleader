// Run 94 s1 — NEW DIMENSION: malformed body / wrong content-type / oversized payload.
// Every prior write sweep sent VALID JSON ('{}'). express.json() throwing a SyntaxError
// is a classic un-handled 500 if the error middleware does not check err.type.
import fs from 'fs';
const BASE='http://localhost:3001';
const TOKEN=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={Authorization:`Bearer ${TOKEN}`};
// representative POST/PATCH endpoints across different routers
const EPS=[
 ['POST','/api/crm/leads'],['PATCH','/api/crm/leads/8cd0f0f2-6296-412f-a5a8-96ae2c6f786e'],
 ['POST','/api/estimates'],['POST','/api/crm/invoices'],['POST','/api/crm/contracts'],
 ['POST','/api/crm/tasks'],['POST','/api/crm/expenses'],['POST','/api/crm/work-orders'],
 ['PUT','/api/crm/tenant-settings'],['POST','/api/crm/subcontractors'],
 ['POST','/api/crm/canvass-pins'],['POST','/api/crm/automations'],
];
const CASES=[
 ['malformed JSON','{"a":',                       'application/json'],
 ['bare string body','not json at all',           'application/json'],
 ['JSON null','null',                             'application/json'],
 ['JSON array root','[1,2,3]',                    'application/json'],
 ['JSON scalar root','42',                        'application/json'],
 ['text/plain ct','{"name":"x"}',                 'text/plain'],
 ['no content-type','{"name":"x"}',               null],
 ['form-urlencoded','name=x&b=1',                 'application/x-www-form-urlencoded'],
 ['deep nesting','{"a":'.repeat(60)+'1'+'}'.repeat(60),'application/json'],
 ['huge string','{"name":"'+'A'.repeat(200000)+'"}','application/json'],
];
const defects=[];let n=0;
const grid={};
for(const [cname,body,ct] of CASES){
  const buckets={};
  for(const [m,p] of EPS){
    const headers={...H};
    if(ct) headers['Content-Type']=ct;
    let st;
    try{const r=await fetch(BASE+p,{method:m,headers,body});st=r.status;
      if(st>=500){const t=await r.text();defects.push({cname,m,p,st,t:t.slice(0,200)});}
    }catch(e){st='THREW';defects.push({cname,m,p,st,t:String(e).slice(0,160)});}
    buckets[st]=(buckets[st]||0)+1;n++;
  }
  grid[cname]=buckets;
  console.log(`  ${cname.padEnd(20)} ${JSON.stringify(buckets)}`);
}
console.log(`\nprobes: ${n} (${CASES.length} malformed shapes x ${EPS.length} endpoints)`);
console.log(`5xx / threw: ${defects.length}`);
for(const d of defects) console.log(`  DEFECT ${d.st} [${d.cname}] ${d.m} ${d.p}\n     ${d.t.replace(/\s+/g,' ')}`);
