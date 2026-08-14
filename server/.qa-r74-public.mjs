import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
// NO Authorization header anywhere in this file — these are public-by-link routes.
const get=async(p)=>{ try{ const r=await fetch(BASE+p,{signal:AbortSignal.timeout(30000)});
  const t=await r.text(); return {s:r.status,b:t.slice(0,200)};}catch(e){return{s:0,b:e.message};} };

const est = (await pool.query('SELECT id, public_token, estimate_number FROM estimates WHERE public_token IS NOT NULL')).rows;
const con = (await pool.query('SELECT id, token FROM contracts WHERE token IS NOT NULL')).rows;
const cst = (await pool.query('SELECT token FROM client_status_tokens')).rows;

console.log('=== every estimate public token (n=%d) ===', est.length);
let bad=0;
for (const e of est) { const r=await get(`/api/estimates/public/${e.public_token}`);
  if (r.s>=500||r.s===0) { bad++; console.log('  ',r.s,e.estimate_number,r.b.slice(0,120)); } }
console.log('5xx:',bad);

console.log('=== contract public tokens (n=%d) ===', con.length);
for (const c of con) { const r=await get(`/api/crm/contracts/public/${c.token}`); console.log('  ',r.s, r.s>=500?r.b.slice(0,120):''); }

console.log('=== client status tokens (n=%d) ===', cst.length);
const tally={};
for (const c of cst) { const r=await get(`/api/leads/status/public/${c.token}`); tally[r.s]=(tally[r.s]||0)+1;
  if (r.s>=500) console.log('   5xx:',r.b.slice(0,150)); }
console.log('  tally:',JSON.stringify(tally));

console.log('=== financing public token routes (using an estimate token) ===');
for (const p of [`/api/crm/financing/public/${est[0].public_token}/plans`,
                 `/api/crm/financing/public/${est[0].public_token}/applications`]) {
  const r=await get(p); console.log('  ',r.s,p.split('/').pop(),'|',r.b.slice(0,120));
}

console.log('=== FORGED / HOSTILE tokens (must never 500 or leak) ===');
for (const t of ['00000000-0000-4000-8000-000000000000','abc','../../etc/passwd',
                 "' OR 1=1 --", 'null', '%00', 'a'.repeat(500)]) {
  const r=await get(`/api/estimates/public/${encodeURIComponent(t)}`);
  console.log(`  ${String(r.s).padEnd(4)} ${JSON.stringify(t).slice(0,32)} -> ${r.b.slice(0,70)}`);
}
await pool.end();
