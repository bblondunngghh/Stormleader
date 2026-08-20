import fs from 'fs';
const TOK = fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H = {'Content-Type':'application/json','Authorization':`Bearer ${TOK}`};
const api = async (m,p,b) => { const r = await fetch('http://localhost:3001/api'+p,{method:m,headers:H,body:b?JSON.stringify(b):undefined}); let j=null; try{j=await r.json();}catch{} return {s:r.status,j}; };

const list = await api('GET','/estimates?limit=5');
const rows = list.j?.estimates || list.j?.data || list.j;
const est = Array.isArray(rows) ? rows[0] : null;
if (!est) { console.log('NO ESTIMATE', list.s, JSON.stringify(list.j).slice(0,300)); process.exit(1); }
console.log('target estimate', est.estimate_number, est.id);

// snapshot the 9 fields
const F = ['estimate_name','estimate_date','introduction','inspection_notes','footer_notes','profit_margin','discounts','signers','deposit'];
const before = await api('GET',`/estimates/${est.id}`);
const bE = before.j?.estimate || before.j;
const snap = {}; F.forEach(f => snap[f] = bE[f]);
console.log('BEFORE:', JSON.stringify(snap));

const probe = {
  estimate_name:'S4 Round Trip Probe', estimate_date:'2026-08-19',
  introduction:'S4 intro', inspection_notes:'S4 inspection', footer_notes:'S4 footer',
  profit_margin:41.5, discounts:[{label:'S4 disc',amount:12}],
  signers:[{name:'S4 Signer',email:'s4@example.com'}], deposit:{type:'percent',value:25}
};
const patch = await api('PATCH',`/estimates/${est.id}`, probe);
console.log('PATCH', patch.s);
const after = await api('GET',`/estimates/${est.id}`);
const aE = after.j?.estimate || after.j;
let pass = 0, fail = [];
for (const f of F) {
  const want = probe[f], got = aE[f];
  const ok = JSON.stringify(want) === JSON.stringify(got) ||
             (f==='profit_margin' && Number(got) === want) ||
             (f==='estimate_date' && String(got).startsWith('2026-08-19'));
  if (ok) pass++; else fail.push(`${f}: want ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
}
console.log(`PERSISTED ${pass}/9`); fail.forEach(x=>console.log('  FAIL',x));

// empty-string coercion edge case (commit claims '' -> NULL for date/numeric)
const edge = await api('PATCH',`/estimates/${est.id}`, {estimate_date:'', profit_margin:''});
const e2 = await api('GET',`/estimates/${est.id}`);
const eE = e2.j?.estimate || e2.j;
console.log(`EDGE '' coercion: PATCH ${edge.s} estimate_date=${JSON.stringify(eE.estimate_date)} profit_margin=${JSON.stringify(eE.profit_margin)}`);

// revert
const rev = {}; F.forEach(f => rev[f] = snap[f] === null ? (f==='discounts'||f==='signers' ? [] : (f==='estimate_date'||f==='profit_margin' ? '' : null)) : snap[f]);
const r2 = await api('PATCH',`/estimates/${est.id}`, rev);
const v = await api('GET',`/estimates/${est.id}`);
const vE = v.j?.estimate || v.j;
console.log('REVERT', r2.s, JSON.stringify(Object.fromEntries(F.map(f=>[f,vE[f]]))));
