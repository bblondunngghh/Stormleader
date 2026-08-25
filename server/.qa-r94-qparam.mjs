// Run 94 s1 — NEW DIMENSION: do list endpoints HONOR their query params?
// A status sweep cannot see this. A filter that silently ignores an unknown value and
// returns EVERY row is a data-correctness bug (and, for a scoping param, a leak).
// Empirical, not a grep: the standing gotcha is that a routes-only grep for req.query.X
// UNDER-COUNTS because handlers pass req.query straight into a service.
import fs from 'fs';
const BASE='http://localhost:3001';
const TOKEN=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={Authorization:`Bearer ${TOKEN}`};
const inv=JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json','utf8'));

const get=async(u)=>{try{const r=await fetch(BASE+u,{headers:H});const t=await r.text();
  let j=null;try{j=JSON.parse(t);}catch{}
  return {st:r.status,j};}catch(e){return {st:'THREW',j:null};}};
// find the primary array in a response envelope
const arr=(j)=>{if(Array.isArray(j))return j;if(!j||typeof j!=='object')return null;
  const keys=Object.keys(j).filter(k=>Array.isArray(j[k]));
  if(!keys.length)return null;
  return j[keys.sort((a,b)=>j[b].length-j[a].length)[0]];};

const cands=inv.filter(r=>r.method==='GET'&&!r.path.includes(':'));
const listy=[];
for(const r of cands){
  const {st,j}=await get(r.path);
  if(st!==200)continue;
  const a=arr(j);
  if(a&&a.length>=2) listy.push({path:r.path,base:a.length});
}
console.log(`list endpoints with >=2 rows: ${listy.length}\n`);
const ignoredLimit=[],ignoredFilter=[];
for(const L of listy){
  const sep=L.path.includes('?')?'&':'?';
  const {j:j1}=await get(`${L.path}${sep}limit=1`);
  const a1=arr(j1); const n1=a1?a1.length:null;
  // bogus filter value: a real filter must return 0 rows for a value that exists nowhere
  const {j:j2}=await get(`${L.path}${sep}status=__qa_nope__`);
  const a2=arr(j2); const n2=a2?a2.length:null;
  const limitOK = n1!==null && n1<=1;
  const filterOK = n2!==null && n2<L.base;
  if(!limitOK) ignoredLimit.push({...L,n1});
  if(!filterOK) ignoredFilter.push({...L,n2});
  console.log(`  ${L.path.padEnd(46)} base=${String(L.base).padEnd(5)} limit=1 -> ${String(n1).padEnd(5)}${limitOK?'ok':'IGNORED'}   status=bogus -> ${String(n2).padEnd(5)}${filterOK?'ok':'ignored/na'}`);
}
console.log(`\nlimit ignored on ${ignoredLimit.length}/${listy.length}`);
ignoredLimit.forEach(x=>console.log(`   LIMIT IGNORED  ${x.path}  base=${x.base} limit=1 returned ${x.n1}`));
console.log(`status filter not applied on ${ignoredFilter.length}/${listy.length} (many legitimately have no status column)`);
