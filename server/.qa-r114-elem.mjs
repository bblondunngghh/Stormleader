// Run 114 s1 — ELEMENT-level type confusion inside the jsonb ARRAY columns. The container
// guards added by earlier runs check Array.isArray only; a well-formed array whose ELEMENTS
// are null/string/number/array still lands in the column verbatim. materials.js:581 proves
// this shape produced a real 500 once. Probe: store the junk, then hit every reader that
// iterates it (detail GET, list GET, PDF), then REVERT.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const T=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const I=JSON.parse(fs.readFileSync('C:/tmp/qa-r85-ids.json','utf8'));
const H={'Content-Type':'application/json',Authorization:`Bearer ${T}`};
const get=async p=>{try{const r=await fetch(BASE+p,{headers:H});return{st:r.status,body:(await r.text()).slice(0,180)};}catch(e){return{st:'THREW',body:String(e).slice(0,160)};}};
const patch=async(p,b)=>{try{const r=await fetch(BASE+p,{method:'PATCH',headers:H,body:JSON.stringify(b)});return{st:r.status,body:(await r.text()).slice(0,180)};}catch(e){return{st:'THREW',body:String(e).slice(0,160)};}};

const TARGETS=[
 {n:'estimate.line_items', tbl:'estimates',   id:I.estimate,  f:'line_items',
  w:`/api/estimates/${I.estimate}`,
  readers:[['detail',`/api/estimates/${I.estimate}`],['list','/api/estimates'],['pdf',`/api/estimates/${I.estimate}/pdf`]]},
 {n:'estimate.discounts',  tbl:'estimates',   id:I.estimate,  f:'discounts',
  w:`/api/estimates/${I.estimate}`,
  readers:[['detail',`/api/estimates/${I.estimate}`],['pdf',`/api/estimates/${I.estimate}/pdf`]]},
 {n:'estimate.signers',    tbl:'estimates',   id:I.estimate,  f:'signers',
  w:`/api/estimates/${I.estimate}`,
  readers:[['detail',`/api/estimates/${I.estimate}`],['pdf',`/api/estimates/${I.estimate}/pdf`]]},
 {n:'invoice.line_items',  tbl:'invoices',    id:I.invoice,   f:'line_items',
  w:`/api/crm/invoices/${I.invoice}`,
  readers:[['detail',`/api/crm/invoices/${I.invoice}`],['list','/api/crm/invoices']]},
 {n:'workOrder.line_items',tbl:'work_orders', id:I.workOrder, f:'line_items',
  w:`/api/crm/work-orders/${I.workOrder}`,
  readers:[['detail',`/api/crm/work-orders/${I.workOrder}`],['list','/api/crm/work-orders'],['pdf',`/api/crm/work-orders/${I.workOrder}/pdf`]]},
];
const ELEMS=[['null-elem',[null]],['string-elem',['oops']],['number-elem',[42]],['array-elem',[[1,2]]],['bool-elem',[true]],['deep-null',[{quantity:null,unit_price:null,description:null}]]];
const out=[],defects=[];
for(const t of TARGETS){
  const orig=(await pool.query(`SELECT ${t.f} FROM ${t.tbl} WHERE id=$1`,[t.id])).rows[0][t.f];
  const origUpd=(await pool.query(`SELECT updated_at FROM ${t.tbl} WHERE id=$1`,[t.id])).rows[0].updated_at;
  for(const [label,val] of ELEMS){
    const w=await patch(t.w,{[t.f]:val});
    const stored=(await pool.query(`SELECT ${t.f} FROM ${t.tbl} WHERE id=$1`,[t.id])).rows[0][t.f];
    const reads=[];
    for(const [rn,rp] of t.readers){
      const r=await get(rp);
      reads.push(`${rn}:${r.st}`);
      if((typeof r.st==='number'&&r.st>=500)||r.st==='THREW')
        defects.push({target:t.n,elem:label,reader:rn,path:rp,st:r.st,body:r.body.replace(/\n/g,' ')});
    }
    out.push({t:t.n,elem:label,write:w.st,stored:JSON.stringify(stored)?.slice(0,50),reads:reads.join(' ')});
    // revert immediately so the next case starts clean
    await pool.query(`UPDATE ${t.tbl} SET ${t.f}=$2, updated_at=$3 WHERE id=$1`,[t.id,JSON.stringify(orig),origUpd]);
  }
  const fin=(await pool.query(`SELECT ${t.f},updated_at FROM ${t.tbl} WHERE id=$1`,[t.id])).rows[0];
  out.push({t:t.n,RESTORED:JSON.stringify(fin[t.f])===JSON.stringify(orig)&&String(fin.updated_at)===String(origUpd)});
}
for(const r of out){ if(r.RESTORED!==undefined) console.log('  RESTORED',r.t,r.RESTORED);
 else console.log([r.t.padEnd(24),r.elem.padEnd(12),'write='+r.write,'stored='+r.stored,'|',r.reads].join(' ')); }
console.log('\n5xx/THREW on read: '+defects.length);
for(const d of defects) console.log(`  ${d.target} [${d.elem}] ${d.reader} ${d.st} ${d.path}\n     ${d.body}`);
fs.writeFileSync('C:/tmp/qa-r114-elem.json',JSON.stringify({out,defects},null,1));
await pool.end();
