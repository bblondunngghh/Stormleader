import fs from 'fs';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H = {'Content-Type':'application/json','Authorization':`Bearer ${TOKEN}`};
console.log('--- POST /orders element shapes (was 500 on [null]) ---');
for (const b of [{items:[null]},{items:["str"]},{items:[1]},{items:[[]]},{items:[{}]},{items:[]},{items:'x'}]) {
  const r = await fetch('http://localhost:3001/api/materials/orders',{method:'POST',headers:H,body:JSON.stringify(b)});
  const t = await r.text();
  console.log(JSON.stringify(b).padEnd(18),'->',r.status, r.status>=400 ? JSON.parse(t).error : 'CREATED '+JSON.parse(t).id);
}
console.log('--- POST /estimate/:id/auto-order against REAL rows with [null] line_items ---');
for (const [name,id] of [['EST-083','1252940b-b691-4182-8d4f-680ac71a0711'],['EST-082','2dd4659c-ed16-4353-9ee6-5dfdf944f365']]) {
  const r = await fetch(`http://localhost:3001/api/materials/estimate/${id}/auto-order`,{method:'POST',headers:H,body:'{}'});
  const t = await r.text();
  console.log(name,'->',r.status, t.slice(0,140));
}
