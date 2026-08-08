import fs from 'fs';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const id = process.argv[2]; const body = JSON.parse(process.argv[3]);
const r = await fetch(`http://localhost:3001/api/estimates/${id}`, {method:'PATCH',
  headers:{'Content-Type':'application/json','Authorization':`Bearer ${TOKEN}`}, body: JSON.stringify(body)});
console.log(r.status, (await r.text()).slice(0,120));
