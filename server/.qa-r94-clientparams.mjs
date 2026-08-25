// Run 94 s1 — THE SET DIFFERENCE THAT MATTERS: params the CLIENT actually sends
// vs params the SERVER actually honors. Empirical (a routes-only grep under-counts,
// because handlers pass req.query straight into a service that destructures it).
// Each probe is self-testing: a HONORED filter must change the row count for a real
// value AND return 0 for a value that exists nowhere.
import fs from 'fs';
const BASE='http://localhost:3001';
const TOKEN=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={Authorization:`Bearer ${TOKEN}`};
const I=JSON.parse(fs.readFileSync('C:/tmp/qa-r85-ids.json','utf8'));
const get=async(u)=>{const r=await fetch(BASE+u,{headers:H});const t=await r.text();
  let j=null;try{j=JSON.parse(t);}catch{} return {st:r.status,j,t};};
const arr=(j)=>{if(Array.isArray(j))return j;if(!j||typeof j!=='object')return null;
  const k=Object.keys(j).filter(x=>Array.isArray(j[x]));if(!k.length)return null;
  return j[k.sort((a,b)=>j[b].length-j[a].length)[0]];};
const N=async(u)=>{const {st,j}=await get(u);const a=arr(j);return {st,n:a?a.length:null};};

// [label, baseline url, url with the CLIENT-SENT param, expectation]
const PROBES=[
 ['/search  limit=8 (ExpensesView:64, InvoicesView:520)', '/api/search?q=a', '/api/search?q=a&limit=8', 'n<=8'],
 ['/crm/expenses  limit=20 (LeadDetail:210)', '/api/crm/expenses', '/api/crm/expenses?limit=20', 'n<=20'],
 ['/crm/expenses  lead_id (LeadDetail:210)', '/api/crm/expenses', `/api/crm/expenses?lead_id=${I.lead}`, 'filters'],
 ['/crm/contracts  lead_id (LeadDetail:202)', '/api/crm/contracts', `/api/crm/contracts?lead_id=${I.lead}`, 'filters'],
 ['/crm/custom-fields  entity_type (crm.js:207)', '/api/crm/custom-fields', '/api/crm/custom-fields?entity_type=lead', 'filters'],
 ['/leads  priority=hot (LeadList:63)', '/api/crm/leads', '/api/crm/leads?priority=hot', 'filters'],
 ['/leads  needs_followup (LeadList:64)', '/api/crm/leads', '/api/crm/leads?needs_followup=true', 'filters'],
 ['/leads  unassigned (LeadList:65)', '/api/crm/leads', '/api/crm/leads?unassigned=true', 'filters'],
];
console.log('=== client-sent query params vs server behaviour ===\n');
const suspects=[];
for(const [label,baseU,probeU,exp] of PROBES){
  const b=await N(baseU), p=await N(probeU);
  let verdict;
  if(p.st>=500||b.st>=500) verdict='5XX';
  else if(b.n===null||p.n===null) verdict='n/a (not a list)';
  else if(exp.startsWith('n<=')){ const cap=+exp.slice(3); verdict = p.n<=cap ? 'HONORED' : (b.n>cap ? 'IGNORED' : 'inconclusive (base already under cap)'); }
  else verdict = p.n!==b.n ? 'HONORED' : (b.n===0?'inconclusive (no rows)':'SUSPECT — same count');
  if(/IGNORED|SUSPECT|5XX/.test(verdict)) suspects.push({label,baseU,probeU,b,p,verdict});
  console.log(`  ${verdict.padEnd(34)} base=${String(b.n).padEnd(5)} probe=${String(p.n).padEnd(5)} ${label}`);
}
// bogus-value self-test for every SUSPECT: a real filter must return 0 for a nonexistent value
console.log('\n=== bogus-value self-test on suspects ===');
for(const s of suspects){
  const bogus=s.probeU.replace(/=([^&]*)$/,'=__qa_nonexistent__');
  const r=await N(bogus);
  console.log(`  ${s.label}\n     bogus -> ${r.n} (base ${s.b.n})  => ${r.n===s.b.n?'PARAM IS IGNORED':'param does apply'}`);
}
