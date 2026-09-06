// Run 125-s1 — the REAL contract-template user path: Clone a built-in -> Edit the copy
// -> Delete the copy. Retires the 3-night-old "Edit 404s on defaults" ticket as a non-bug.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const T=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={'Content-Type':'application/json',Authorization:`Bearer ${T}`};
const req=async(m,p,b)=>{const r=await fetch(BASE+p,{method:m,headers:H,body:b===undefined?undefined:JSON.stringify(b)});
  const t=await r.text();let j=null;try{j=JSON.parse(t);}catch{}return{st:r.status,j,t:t.slice(0,140).replace(/\s+/g,' ')};};
const FAIL=[];const chk=(ok,m)=>{console.log(`${ok?'PASS':'FAIL'} ${m}`);if(!ok)FAIL.push(m);};
const before=(await pool.query(`SELECT count(*)::int c FROM contract_templates`)).rows[0].c;
console.log('contract_templates before =',before);

const list=await req('GET','/api/crm/contracts/templates');
chk(list.st===200,`GET templates -> ${list.st}`);
const tpls=list.j?.templates||[];
console.log('listed:',tpls.map(t=>`${t.name}[default=${t.is_default},tenant=${t.tenant_id}]`).join(' | '));
const builtin=tpls.find(t=>t.is_default);

// 1. the UI hides Edit/Delete on built-ins; confirm the SERVER also refuses (defence in depth)
const pe=await req('PATCH',`/api/crm/contracts/templates/${builtin.id}`,{name:'HIJACK'});
chk(pe.st===404,`PATCH built-in refused -> ${pe.st} ${pe.t.slice(0,60)}`);
const de=await req('DELETE',`/api/crm/contracts/templates/${builtin.id}`);
chk(de.st===404,`DELETE built-in refused -> ${de.st} ${de.t.slice(0,60)}`);
const stillThere=(await pool.query(`SELECT name FROM contract_templates WHERE id=$1`,[builtin.id])).rows[0];
chk(stillThere?.name===builtin.name,`built-in row unmodified (${stillThere?.name})`);

// 2. the REAL path: Clone -> Edit -> Delete
const cl=await req('POST','/api/crm/contracts/templates',{name:`${builtin.name} (Copy)`,type:builtin.type||'custom',content:{sections:[{title:'Agreement',body:'orig'}]}});
chk(cl.st===201||cl.st===200,`CLONE -> ${cl.st} ${cl.st>=400?cl.t:''}`);
const cid=cl.j?.id;
if(cid){
  const relist=await req('GET','/api/crm/contracts/templates');
  const mine=(relist.j?.templates||[]).find(t=>t.id===cid);
  chk(!!mine,'clone appears in list');
  chk(mine&&!mine.is_default,`clone is NOT flagged built-in (is_default=${mine?.is_default}) -> UI will show Edit/Delete`);
  const up=await req('PATCH',`/api/crm/contracts/templates/${cid}`,{name:'QA-R125 edited',type:'custom',content:{sections:[{title:'A',body:'edited'}]}});
  chk(up.st===200,`EDIT clone -> ${up.st} ${up.st>=400?up.t:''}`);
  chk(up.j?.name==='QA-R125 edited',`edit persisted (${up.j?.name})`);
  const dl=await req('DELETE',`/api/crm/contracts/templates/${cid}`);
  chk(dl.st===200,`DELETE clone -> ${dl.st}`);
}
const after=(await pool.query(`SELECT count(*)::int c FROM contract_templates`)).rows[0].c;
chk(after===before,`net-zero DB ${before} -> ${after}`);
// belt and braces
await pool.query(`DELETE FROM contract_templates WHERE name LIKE 'QA-R125%' OR name LIKE '%(Copy)'`);
console.log(`\n=== ${FAIL.length} FAILURES ===`);FAIL.forEach(f=>console.log(f));
await pool.end();
