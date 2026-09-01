// Run 114 s1 — jsonb array/object columns written from the request body with NO type guard.
// Probe: PATCH a REAL row with a wrong-typed value, record status + what got stored, REVERT.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE = 'http://localhost:3001';
const T = fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const I = JSON.parse(fs.readFileSync('C:/tmp/qa-r85-ids.json','utf8'));
const req = async (m,p,b) => { const r = await fetch(BASE+p,{method:m,headers:{'Content-Type':'application/json',Authorization:`Bearer ${T}`},body:b===undefined?undefined:JSON.stringify(b)}); return {st:r.status, body:(await r.text()).slice(0,200)}; };

const TARGETS = [
  { name:'estimate.line_items', path:`/api/estimates/${I.estimate}`, field:'line_items', table:'estimates', id:I.estimate, cols:['line_items','subtotal','tax_amount','total'] },
  { name:'estimate.discounts',  path:`/api/estimates/${I.estimate}`, field:'discounts',  table:'estimates', id:I.estimate, cols:['discounts'] },
  { name:'estimate.signers',    path:`/api/estimates/${I.estimate}`, field:'signers',    table:'estimates', id:I.estimate, cols:['signers'] },
  { name:'estimate.deposit',    path:`/api/estimates/${I.estimate}`, field:'deposit',    table:'estimates', id:I.estimate, cols:['deposit'] },
  { name:'estimate.financing_plan_ids', path:`/api/estimates/${I.estimate}`, field:'financing_plan_ids', table:'estimates', id:I.estimate, cols:['financing_plan_ids'] },
  { name:'invoice.line_items',  path:`/api/crm/invoices/${I.invoice}`,  field:'line_items', table:'invoices', id:I.invoice, cols:['line_items'] },
  { name:'workOrder.line_items',path:`/api/crm/work-orders/${I.workOrder}`, field:'line_items', table:'work_orders', id:I.workOrder, cols:['line_items'] },
  { name:'contract.content',    path:`/api/crm/contracts/${I.contract}`, field:'content',   table:'contracts', id:I.contract, cols:['content'] },
];
const BAD = [ ['string','oops'], ['number',42], ['object-for-array',{a:1}], ['null-in-array',null] ];

const snap = async (t,id,cols) => (await pool.query(`SELECT ${cols.join(',')} FROM ${t} WHERE id=$1`,[id])).rows[0];
const restore = async (t,id,orig,cols) => {
  const sets = cols.map((c,i)=>`${c}=$${i+2}`).join(',');
  const vals = cols.map(c => (orig[c]!==null && typeof orig[c]==='object') ? JSON.stringify(orig[c]) : orig[c]);
  await pool.query(`UPDATE ${t} SET ${sets} WHERE id=$1`,[id,...vals]);
};

const out=[];
for (const t of TARGETS) {
  const orig = await snap(t.table,t.id,t.cols);
  if (!orig) { out.push({t:t.name, err:'no row'}); continue; }
  for (const [label,val] of BAD) {
    if (label==='object-for-array' && t.field==='content') continue; // content IS an object
    const r = await req('PATCH', t.path, { [t.field]: val });
    const after = await snap(t.table,t.id,t.cols);
    const stored = after[t.field];
    const changed = JSON.stringify(stored)!==JSON.stringify(orig[t.field]);
    const collateral = t.cols.filter(c=>c!==t.field && JSON.stringify(after[c])!==JSON.stringify(orig[c]))
      .map(c=>`${c}: ${JSON.stringify(orig[c])} -> ${JSON.stringify(after[c])}`);
    out.push({ t:t.name, bad:label, st:r.st, accepted:r.st<400, stored:JSON.stringify(stored)?.slice(0,80), changed, collateral, err:r.st>=400?r.body.slice(0,90):undefined });
    if (changed || collateral.length) await restore(t.table,t.id,orig,t.cols);
  }
  const final = await snap(t.table,t.id,t.cols);
  const ok = t.cols.every(c=>JSON.stringify(final[c])===JSON.stringify(orig[c]));
  out.push({ t:t.name, RESTORED: ok });
}
console.log(JSON.stringify(out,null,1));
fs.writeFileSync('C:/tmp/qa-r114-jsonbtypes.json', JSON.stringify(out,null,1));
await pool.end();
