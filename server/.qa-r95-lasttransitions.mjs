// Run 95 — the final 2 never-executed transition routes. Both backing tables are
// EMPTY, so no sweep could ever reach these handlers. Seed exactly one row each,
// execute, assert the transition, delete. Net DB writes = 0 (verified).
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const TOKEN=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={'Content-Type':'application/json',Authorization:`Bearer ${TOKEN}`};
const {rows:[t]}=await pool.query("SELECT id FROM tenants WHERE slug='waterloo'");
// markRead scopes by req.user.id, so the row MUST belong to the token's user.
// An unordered LIMIT 1 picks a different user and the 404 is correct authorization, not a bug.
const TOKEN_UID=JSON.parse(Buffer.from(TOKEN.split(".")[1],"base64url").toString()).id;
const {rows:[u]}=await pool.query("SELECT id FROM users WHERE id=$1",[TOKEN_UID]);
const cnt=async tb=>(await pool.query(`SELECT count(*)::int n FROM ${tb}`)).rows[0].n;
const before={notifications:await cnt('notifications'),automations:await cnt('automations')};
const defects=[];
let nId=null,aId=null;
try{
  // ---- 1. PATCH /api/notifications/:id/read ----
  ({rows:[{id:nId}]}=await pool.query(
    `INSERT INTO notifications (tenant_id,user_id,type,title,body,is_read)
     VALUES ($1,$2,'storm_alert','QA-R95 probe','QA-R95',false) RETURNING id`,[t.id,u.id]));
  let res=await fetch(`${BASE}/api/notifications/${nId}/read`,{method:'PATCH',headers:H,body:'{}'});
  const nBody=(await res.text()).slice(0,160);
  const {rows:[nAfter]}=await pool.query('SELECT is_read,read_at FROM notifications WHERE id=$1',[nId]);
  const nOk=res.status<500 && nAfter?.is_read===true;
  if(!nOk) defects.push({r:'PATCH /api/notifications/:id/read',status:res.status,body:nBody});
  console.log(`  ${nOk?'  ok  ':'DEFECT'} ${String(res.status).padEnd(5)} PATCH /api/notifications/:id/read`);
  console.log(`         is_read=${nAfter?.is_read} read_at=${nAfter?.read_at?'set':'null'}`);
  if(!nOk) console.log(`         ${nBody.replace(/\s+/g,' ')}`);

  // ---- 2. PATCH /api/crm/automations/:id/toggle ----
  ({rows:[{id:aId}]}=await pool.query(
    `INSERT INTO automations (tenant_id,name,trigger_type,action_type,is_active)
     VALUES ($1,'QA-R95 probe','lead_created','send_email',true) RETURNING id`,[t.id]));
  res=await fetch(`${BASE}/api/crm/automations/${aId}/toggle`,{method:'PATCH',headers:H,body:'{}'});
  const aBody=(await res.text()).slice(0,160);
  const {rows:[aAfter]}=await pool.query('SELECT is_active FROM automations WHERE id=$1',[aId]);
  const aOk=res.status<500 && aAfter?.is_active===false;   // true -> toggled -> false
  if(!aOk) defects.push({r:'PATCH /api/crm/automations/:id/toggle',status:res.status,body:aBody});
  console.log(`  ${aOk?'  ok  ':'DEFECT'} ${String(res.status).padEnd(5)} PATCH /api/crm/automations/:id/toggle`);
  console.log(`         is_active true -> ${aAfter?.is_active}`);
  if(!aOk) console.log(`         ${aBody.replace(/\s+/g,' ')}`);
} finally {
  if(nId) await pool.query('DELETE FROM notifications WHERE id=$1',[nId]);
  if(aId) await pool.query('DELETE FROM automations WHERE id=$1',[aId]);
  await pool.query("DELETE FROM notifications WHERE title LIKE 'QA-R95%'");
  await pool.query("DELETE FROM automations WHERE name LIKE 'QA-R95%'");
}
const after={notifications:await cnt('notifications'),automations:await cnt('automations')};
console.log(`\nrow counts before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
console.log(`net drift: ${JSON.stringify(before)===JSON.stringify(after)?'NONE (0 net writes)':'LEAKED'}`);
console.log(`defects: ${defects.length}`);
for(const d of defects) console.log(`  ${d.status} ${d.r} :: ${d.body.replace(/\s+/g,' ')}`);
await pool.end();
