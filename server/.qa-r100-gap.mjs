// Run 100 — (1) re-resolve the 11 phase-A 404s with CORRECT ids, (2) malformed-input fuzz.
// A 404 from a bad fixture proves nothing; only a correctly-resolved id exercises the handler.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const TOKEN=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const I=JSON.parse(fs.readFileSync('C:/tmp/qa-r85-ids.json','utf8'));
const H={'Content-Type':'application/json',Authorization:`Bearer ${TOKEN}`};
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';

const one=async(l,s,p=[])=>{try{return (await pool.query(s,p)).rows[0]||null;}catch(e){console.log('  (fixture '+l+' unavailable: '+e.code+')');return null;}};
const county   = await one('county',`SELECT id FROM counties LIMIT 1`);
const storm    = await one('storm',`SELECT id FROM storm_events LIMIT 1`);
const matOrder = await one('matOrder',`SELECT id FROM material_orders WHERE tenant_id=$1 LIMIT 1`,[T]);
const matProd  = await one('matProd',`SELECT id FROM material_products LIMIT 1`);
const plist    = await one('plist',`SELECT id FROM prospect_lists WHERE tenant_id=$1 LIMIT 1`,[T]);
const ctrTok   = await one('ctrTok',`SELECT public_token t FROM contracts WHERE tenant_id=$1 AND public_token IS NOT NULL LIMIT 1`,[T]);
const leadTok  = await one('leadTok',`SELECT status_token t FROM leads WHERE tenant_id=$1 AND status_token IS NOT NULL LIMIT 1`,[T]);

const GAP=[
  ['GET',`/api/counties/${county?.id}/status`,                  !!county],
  ['GET',`/api/crm/contracts/public/${ctrTok?.t||I.contractToken}`, true],
  ['GET',`/api/crm/drip-sequences/${I.dripSequence}`,            !!I.dripSequence],
  ['GET',`/api/crm/financing/applications/${I.financingApp}`,    !!I.financingApp],
  ['GET',`/api/crm/prospect-lists/${plist?.id}/items`,           !!plist],
  ['GET',`/api/drift/${storm?.id}`,                              !!storm],
  ['GET',`/api/leads/status/public/${leadTok?.t}`,               !!leadTok],
  ['GET',`/api/materials/orders/${matOrder?.id}`,                !!matOrder],
  ['GET',`/api/materials/products/${matProd?.id}`,               !!matProd],
  ['GET',`/api/storms/${storm?.id}`,                             !!storm],
];
console.log('=== GAP: phase-A 404s re-hit with REAL ids ===');
for(const [m,u,have] of GAP){
  if(!have){console.log(`  SKIP (no fixture)  ${m} ${u.replace(/undefined/,'<none>')}`);continue;}
  const r=await fetch(BASE+u,{method:m,headers:H});
  const b=(await r.text()).slice(0,140).replace(/\n/g,' ');
  console.log(`  ${String(r.status).padEnd(4)} ${m} ${u}\n       ${b}`);
}

// ---- malformed input: must be 4xx, never 5xx ----
const FUZZ=[
  ['GET','/api/crm/leads/not-a-uuid',null],
  ['GET','/api/crm/leads/'+I.lead+"'--",null],
  ['GET','/api/estimates/12345',null],
  ['GET','/api/crm/leads?page=abc&limit=-5',null],
  ['GET','/api/crm/leads?limit=999999999999',null],
  ['GET','/api/crm/leads?sort_by=__proto__&sort_dir=constructor',null],
  ['GET','/api/crm/leads?stage=not_a_stage',null],
  ['GET','/api/map/properties?bbox=abc',null],
  ['GET','/api/storm-history?days=NaN',null],
  ['GET','/api/crm/calendar?start=zzz&end=zzz',null],
  ['PATCH','/api/crm/leads/'+I.lead,{stage:12345}],
  ['PATCH','/api/crm/leads/'+I.lead,{stage:{$ne:null}}],
  ['PATCH','/api/crm/leads/'+I.lead,{estimated_value:'not-a-number'}],
  ['PATCH','/api/crm/leads/'+I.lead,{custom_fields:'a-string-not-an-object'}],
  ['POST','/api/crm/leads',{__proto__:{polluted:1}}],
  ['POST','/api/crm/tasks',{title:null,priority:'medium'}],
];
console.log('\n=== FUZZ: malformed input must be 4xx, never 5xx ===');
const bad=[];
for(const [m,u,body] of FUZZ){
  let st,txt;
  try{const r=await fetch(BASE+u,{method:m,headers:H,body:body?JSON.stringify(body):undefined});
    st=r.status;txt=(await r.text()).slice(0,120).replace(/\n/g,' ');}catch(e){st='THREW';txt=String(e).slice(0,110);}
  const isBad=(typeof st==='number'&&st>=500)||st==='THREW';
  if(isBad)bad.push({m,u,body,st,txt});
  console.log(`  ${isBad?'FAIL':'ok  '} ${String(st).padEnd(5)} ${m} ${u} ${body?JSON.stringify(body):''}`);
  if(isBad)console.log(`         -> ${txt}`);
}
// malformed JSON body (not valid JSON at all)
const r=await fetch(BASE+'/api/crm/leads',{method:'POST',headers:H,body:'{"broken":'});
console.log(`  ${r.status>=500?'FAIL':'ok  '} ${r.status}   POST /api/crm/leads  <malformed JSON>`);
if(r.status>=500)bad.push({m:'POST',u:'/api/crm/leads',body:'<malformed JSON>',st:r.status});
console.log(`\nFUZZ 5xx: ${bad.length}`);
await pool.end();
