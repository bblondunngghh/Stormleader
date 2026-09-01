// Run 114 s1 — round 2. TRAP: leads.tags is text[] (NOT jsonb); a JSON.stringify restore
// throws 22P02 "malformed array literal". Restore by passing the JS value straight to pg
// for array/scalar columns and only stringify for jsonb.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const T=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const I=JSON.parse(fs.readFileSync('C:/tmp/qa-r85-ids.json','utf8'));
const req=async(m,p,b)=>{const r=await fetch(BASE+p,{method:m,headers:{'Content-Type':'application/json',Authorization:`Bearer ${T}`},body:JSON.stringify(b)});return{st:r.status,body:(await r.text()).slice(0,160)};};
const TARGETS=[
 {name:'lead.custom_fields', path:`/api/crm/leads/${I.lead}`, field:'custom_fields', table:'leads', id:I.lead},
 {name:'lead.tags',          path:`/api/crm/leads/${I.lead}`, field:'tags',          table:'leads', id:I.lead},
 {name:'estimate.upgrades',  path:`/api/estimates/${I.estimate}`, field:'upgrades', table:'estimates', id:I.estimate},
 {name:'estimate.insurance_details', path:`/api/estimates/${I.estimate}`, field:'insurance_details', table:'estimates', id:I.estimate},
 {name:'customField.options',path:`/api/crm/custom-fields/${I.customField}`, field:'options', table:'custom_field_definitions', id:I.customField},
];
const BAD=[['string','oops'],['number',42],['object',{a:1}],['array',[1,2]],['null',null],['bool',true]];
const out=[];
for(const t of TARGETS){
  let typ, orig;
  try{
    typ=(await pool.query(`SELECT pg_typeof(${t.field})::text tt FROM ${t.table} WHERE id=$1`,[t.id])).rows[0]?.tt;
    orig=(await pool.query(`SELECT ${t.field} FROM ${t.table} WHERE id=$1`,[t.id])).rows[0];
  }catch(e){ out.push({t:t.name,SKIP:e.code+' '+e.message.slice(0,60)}); continue; }
  if(!orig){ out.push({t:t.name,SKIP:'no row'}); continue; }
  const isJsonb = typ === 'jsonb' || typ === 'json';
  const enc = v => (isJsonb ? JSON.stringify(v) : v);   // pg encodes JS arrays for text[]
  const read = async () => (await pool.query(`SELECT ${t.field} FROM ${t.table} WHERE id=$1`,[t.id])).rows[0][t.field];
  for(const [label,val] of BAD){
    const r=await req('PATCH',t.path,{[t.field]:val});
    const after=await read();
    const changed=JSON.stringify(after)!==JSON.stringify(orig[t.field]);
    out.push({t:t.name,typ,bad:label,st:r.st,stored:JSON.stringify(after)?.slice(0,70),changed,err:r.st>=400?r.body.slice(0,80):''});
    if(changed) await pool.query(`UPDATE ${t.table} SET ${t.field}=$2 WHERE id=$1`,[t.id,enc(orig[t.field])]);
  }
  out.push({t:t.name,RESTORED:JSON.stringify(await read())===JSON.stringify(orig[t.field])});
}
for(const r of out){ if(r.SKIP) console.log(r.t,'SKIP',r.SKIP); else if(r.RESTORED!==undefined) console.log('  RESTORED',r.t,r.RESTORED);
 else console.log([r.t+`(${r.typ})`,r.bad,r.st,r.st<400?'ACCEPTED':'rejected','stored='+r.stored,'changed='+r.changed,r.err].join(' | ')); }
fs.writeFileSync('C:/tmp/qa-r114-jsonb2.json',JSON.stringify(out,null,1));
await pool.end();
