import fs from 'fs';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const ID='1252940b-b691-4182-8d4f-680ac71a0711';
const bad = [
  {upgrades:[null]}, {upgrades:"notanarray"}, {upgrades:5}, {upgrades:{a:1}},
  {financing_plan_ids:5}, {financing_plan_ids:{a:1}}, {financing_plan_ids:"x"},
  {line_items:"x"}, {line_items:{a:1}}, {line_items:7},
  {insurance_details:"abc"}, {insurance_details:[1,2]}, {insurance_details:3},
];
const good = [
  {upgrades:[]}, {upgrades:[{name:'A',price:'10',selected:true}]},
  {financing_plan_ids:[]}, {insurance_details:{}}, {insurance_details:{claim_number:'C1'}},
  {upgrades:null}, {notes:'guard regression probe'},
];
let rejected=0, accepted=0, fails=[];
for (const b of bad) {
  const r = await fetch(`http://localhost:3001/api/estimates/${ID}`,{method:'PATCH',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${TOKEN}`},body:JSON.stringify(b)});
  const t = await r.text();
  if (r.status===400) rejected++; else { fails.push(`ACCEPTED ${JSON.stringify(b)} -> ${r.status}`); }
  console.log('BAD ', JSON.stringify(b).padEnd(42), '->', r.status, r.status===400 ? JSON.parse(t).error : 'NOT REJECTED');
}
for (const b of good) {
  const r = await fetch(`http://localhost:3001/api/estimates/${ID}`,{method:'PATCH',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${TOKEN}`},body:JSON.stringify(b)});
  if (r.status===200) accepted++; else fails.push(`VALID REJECTED ${JSON.stringify(b)} -> ${r.status} ${(await r.text()).slice(0,80)}`);
  console.log('GOOD', JSON.stringify(b).padEnd(42), '->', r.status);
}
console.log(`\nbad rejected ${rejected}/${bad.length} | valid accepted ${accepted}/${good.length}`);
if (fails.length) console.log('FAILURES:\n' + fails.join('\n'));
