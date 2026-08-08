import pool from './src/db/pool.js';
import fs from 'fs';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const API='http://localhost:3001';
const { rows } = await pool.query(
  `SELECT id, estimate_number, upgrades, financing_plan_ids, insurance_details
     FROM estimates ORDER BY created_at DESC LIMIT 4`);
console.log('newest 4 estimates:');
rows.forEach(r=>console.log(' ', r.estimate_number, r.id, 'upg=', JSON.stringify(r.upgrades), 'fpi=', JSON.stringify(r.financing_plan_ids)));
const target = rows.find(r=>r.estimate_number==='EST-083') || rows[0];
console.log('TARGET:', target.estimate_number, target.id);
fs.writeFileSync('C:/tmp/qa-r71-snapshot.json', JSON.stringify(target));
// probe hostile shapes
const shapes = [
  {upgrades:[null]},
  {financing_plan_ids: 5},
  {financing_plan_ids: {a:1}},
  {upgrades: "notanarray"},
  {insurance_details: "abc"},
];
for (const body of shapes) {
  const r = await fetch(`${API}/api/estimates/${target.id}`, {method:'PATCH',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${TOKEN}`}, body: JSON.stringify(body)});
  const txt = await r.text();
  const back = await pool.query('SELECT upgrades, financing_plan_ids, insurance_details FROM estimates WHERE id=$1',[target.id]);
  console.log(JSON.stringify(body), '->', r.status, '| stored:', JSON.stringify(back.rows[0]));
}
await pool.end();
