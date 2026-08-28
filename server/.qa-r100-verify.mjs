import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const TOKEN=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={'Content-Type':'application/json',Authorization:`Bearer ${TOKEN}`};
const L='8cd0f0f2-6296-412f-a5a8-96ae2c6f786e';
const cf=async()=>{const r=await pool.query(`SELECT custom_fields c,jsonb_typeof(custom_fields) t FROM leads WHERE id=$1`,[L]);return r.rows[0];};
const patch=async b=>{const r=await fetch(`${BASE}/api/crm/leads/${L}`,{method:'PATCH',headers:H,body:JSON.stringify(b)});
  return {st:r.status,body:(await r.text()).slice(0,90).replace(/\n/g,' ')};};

console.log('start state:',JSON.stringify(await cf()));
console.log('\n=== BAD TYPES must now be 400 (were 200 + permanent corruption) ===');
const BAD=[['string','a-string-not-an-object'],['number',12345],['boolean',true],
           ['array',[1,2]],['null',null],['array-of-obj',[{k:'v'}]]];
let pass=0;
for(const [label,v] of BAD){
  const r=await patch({custom_fields:v});
  const after=await cf();
  const ok = r.st===400 && after.t==='object';
  if(ok)pass++;
  console.log(`  ${ok?'PASS':'FAIL'}  ${String(r.st).padEnd(4)} custom_fields=${label.padEnd(13)} col stays ${after.t}   ${r.body}`);
}
console.log('\n=== VALID OBJECT still works and MERGES (regression guard) ===');
const a=await patch({custom_fields:{qa_r100:'v1'}});
const s1=await cf();
const b=await patch({custom_fields:{qa_r100_b:'v2'}});
const s2=await cf();
const mergeOk = a.st===200 && b.st===200 && s2.t==='object' && s2.c.qa_r100==='v1' && s2.c.qa_r100_b==='v2';
console.log(`  ${mergeOk?'PASS':'FAIL'}  ${a.st}/${b.st}  after 2 merges: ${JSON.stringify(s2.c)} (${s2.t})`);

// restore
await pool.query(`UPDATE leads SET custom_fields='{}'::jsonb, updated_at=updated_at WHERE id=$1`,[L]);
const fin=await cf();
console.log('\nrestored   :',JSON.stringify(fin));
console.log(`junk leads :`,(await pool.query(`SELECT count(*)::int n FROM leads WHERE jsonb_typeof(custom_fields)<>'object'`)).rows[0].n);
console.log(`\nRESULT: bad-type ${pass}/${BAD.length}  merge-regression ${mergeOk?'PASS':'FAIL'}`);
await pool.end();
