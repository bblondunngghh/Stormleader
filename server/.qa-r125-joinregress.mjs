// Run 125-s1 — REGRESSION: after tenant-scoping the leads joins, every legitimate
// same-tenant row must STILL resolve its lead fields. Compares the API's populated
// lead fields against a direct SQL count of rows that genuinely have an owned lead.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const T=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={Authorization:`Bearer ${T}`};
const get=async p=>{const r=await fetch(BASE+p,{headers:H});const t=await r.text();let j=null;try{j=JSON.parse(t);}catch{}return{st:r.status,j};};
const q=async(s,p)=>(await pool.query(s,p)).rows;
const W=(await q(`SELECT id FROM tenants WHERE slug='waterloo'`))[0].id;
const FAIL=[];
const CASES=[
  ['contracts','/api/crm/contracts','contracts',['lead_name','lead_address','contact_name','address']],
  ['invoices','/api/crm/invoices','invoices',['lead_name','lead_address','contact_name','address']],
  ['expenses','/api/crm/expenses','expenses',['lead_name','lead_address','contact_name','address']],
  ['estimates','/api/estimates','estimates',['lead_name','lead_address','contact_name','address']],
  ['work_orders','/api/crm/work-orders','work_orders',['lead_name','lead_address','contact_name','address']],
];
for(const [name,path,tbl,fields] of CASES){
  const expected=(await q(
    `SELECT count(*)::int c FROM ${tbl} x JOIN leads l ON l.id=x.lead_id AND l.tenant_id=x.tenant_id WHERE x.tenant_id=$1`,[W]))[0].c;
  const r=await get(path);
  const arr=Array.isArray(r.j)?r.j:(r.j?.[name]||r.j?.items||Object.values(r.j||{}).find(Array.isArray)||[]);
  const populated=arr.filter(o=>fields.some(f=>o[f]!==null&&o[f]!==undefined&&o[f]!=='')).length;
  const ok=r.st===200&&populated>=expected;
  console.log(`${ok?'PASS':'FAIL'} ${name.padEnd(12)} HTTP ${r.st} rows=${arr.length} withLeadFields=${populated} expected>=${expected}`);
  if(!ok){FAIL.push(name);console.log('   sample:',JSON.stringify(arr[0]||{}).slice(0,220));}
}
console.log(`\n=== ${FAIL.length} REGRESSIONS ===`);
await pool.end();
