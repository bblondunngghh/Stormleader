import pool from './src/db/pool.js';
import fs from 'fs';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const SEL=`SELECT id FROM leads WHERE tenant_id='${T}' AND (
  contact_name IN ('DELETE ME','empty-priority probe','true','12345','{"x","y"}','{"nested":{"deep":1}}')
  OR address IN ('456 Test Ave','123 QA St','777 QA Test Rd','888 QA Path','true','12345','{"x","y"}','{"nested":{"deep":1}}')
  OR address ILIKE 'qa2026%'
  OR (contact_name IS NULL AND address IS NULL AND city IS NULL))`;
const backup={};
for (const [k,sql] of [
 ['leads',`SELECT * FROM leads WHERE id IN (${SEL})`],
 ['estimates',`SELECT * FROM estimates WHERE lead_id IN (${SEL})`],
 ['invoices',`SELECT * FROM invoices WHERE lead_id IN (${SEL})`],
 ['work_orders',`SELECT * FROM work_orders WHERE lead_id IN (${SEL})`],
 ['activities',`SELECT * FROM activities WHERE lead_id IN (${SEL})`],
 ['contacts',`SELECT * FROM contacts WHERE lead_id IN (${SEL})`],
]) backup[k]=(await pool.query(sql)).rows;
fs.writeFileSync('C:/tmp/qa-s4-fuzz-backup.json', JSON.stringify(backup,null,1));
console.log('BACKUP', Object.entries(backup).map(([k,v])=>`${k}=${v.length}`).join(' '));
const c=await pool.connect();
try{
  await c.query('BEGIN');
  for (const [l,sql] of [
   ['invoices',`DELETE FROM invoices WHERE lead_id IN (${SEL})`],
   ['work_orders',`DELETE FROM work_orders WHERE lead_id IN (${SEL})`],
   ['estimates',`DELETE FROM estimates WHERE lead_id IN (${SEL})`],
   ['leads',`DELETE FROM leads WHERE id IN (${SEL})`],
  ]) console.log('  deleted',l,(await c.query(sql)).rowCount);
  await c.query('COMMIT'); console.log('COMMIT ok');
}catch(e){await c.query('ROLLBACK');console.log('ROLLBACK',e.code,e.message);}finally{c.release();}
const a=await pool.query(`SELECT 'leads' t,count(*)::int c FROM leads WHERE tenant_id=$1
 UNION ALL SELECT 'estimates',count(*)::int FROM estimates WHERE tenant_id=$1
 UNION ALL SELECT 'invoices',count(*)::int FROM invoices WHERE tenant_id=$1
 UNION ALL SELECT 'contracts',count(*)::int FROM contracts WHERE tenant_id=$1
 UNION ALL SELECT 'work_orders',count(*)::int FROM work_orders WHERE tenant_id=$1
 UNION ALL SELECT 'tasks',count(*)::int FROM tasks WHERE tenant_id=$1`,[T]);
console.log('AFTER:',a.rows.map(r=>`${r.t}=${r.c}`).join(' '));
await pool.end();
