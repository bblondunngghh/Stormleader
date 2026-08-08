import fs from 'fs';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const shapes = [ {items:[null]}, {items:["str"]}, {items:[1]}, {items:[[]]} ];
for (const b of shapes) {
  const r = await fetch('http://localhost:3001/api/materials/orders',{method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${TOKEN}`},body:JSON.stringify(b)});
  const t = await r.text();
  console.log(JSON.stringify(b).padEnd(20),'->',r.status, t.slice(0,110));
}
