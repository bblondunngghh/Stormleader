// Run 95 — the last 6 PATCH handlers whose UPDATE path has NEVER executed.
// Their backing tables are empty for this tenant (or hold only system rows with
// tenant_id IS NULL), so every sweep 404'd in the ownership lookup first.
// Seed one tenant-owned row where needed, PATCH a REAL field, assert the column
// actually changed, then delete. Net DB writes = 0 (verified).
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const TOKEN=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={'Content-Type':'application/json',Authorization:`Bearer ${TOKEN}`};
const {rows:[t]}=await pool.query("SELECT id FROM tenants WHERE slug='waterloo'");
const TID=t.id;
const snapAll=async()=>{const{rows}=await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");const c={};
  for(const{tablename}of rows){try{c[tablename]=(await pool.query(`SELECT count(*)::int n FROM "${tablename}"`)).rows[0].n;}catch{}}return c;};
const before=await snapAll();
const cleanup=[]; const defects=[];

const run=async(label,url,body,verify)=>{
  let status,txt;
  try{const r=await fetch(`${BASE}${url}`,{method:'PATCH',headers:H,body:JSON.stringify(body)});status=r.status;txt=(await r.text()).slice(0,180);}
  catch(e){status='THREW';txt=String(e);}
  const applied=await verify().catch(e=>'VERIFY_ERR '+e.message);
  const bad=(typeof status==='number'&&status>=500)||status==='THREW'||applied!==true;
  if(bad) defects.push({label,status,txt,applied});
  console.log(`  ${bad?'DEFECT':'  ok  '} ${String(status).padEnd(5)} ${label}   applied=${applied}`);
  if(bad) console.log(`         ${String(txt).replace(/\s+/g,' ')}`);
};

try{
  // 1. custom-fields  (real row already owned by this tenant — snapshot + restore)
  const {rows:[cf]}=await pool.query(`SELECT * FROM custom_field_definitions WHERE tenant_id=$1 LIMIT 1`,[TID]);
  if(cf){
    await run('PATCH /api/crm/custom-fields/:id', `/api/crm/custom-fields/${cf.id}`, {field_label:'QA-R95 label'},
      async()=> (await pool.query('SELECT field_label FROM custom_field_definitions WHERE id=$1',[cf.id])).rows[0].field_label==='QA-R95 label');
    await pool.query('UPDATE custom_field_definitions SET field_label=$1 WHERE id=$2',[cf.field_label,cf.id]);
    const back=(await pool.query('SELECT field_label FROM custom_field_definitions WHERE id=$1',[cf.id])).rows[0].field_label;
    console.log(`         restored field_label -> ${JSON.stringify(back)} ${back===cf.field_label?'(verified)':'(FAILED)'}`);
  } else console.log('  --  SKIP custom-fields (no row)');

  // 2. contract template  (the 4 existing rows are system templates, tenant_id IS NULL)
  const {rows:[ct]}=await pool.query(
    `INSERT INTO contract_templates (tenant_id,name,type,content) VALUES ($1,'QA-R95 tmpl','roofing','{}'::jsonb) RETURNING id`,[TID]);
  cleanup.push(['contract_templates',ct.id]);
  await run('PATCH /api/crm/contracts/templates/:id', `/api/crm/contracts/templates/${ct.id}`, {name:'QA-R95 renamed'},
    async()=> (await pool.query('SELECT name FROM contract_templates WHERE id=$1',[ct.id])).rows[0].name==='QA-R95 renamed');

  // 3. financing lender
  const {rows:[fl]}=await pool.query(
    `INSERT INTO financing_lenders (tenant_id,provider,is_active) VALUES ($1,'hearth',true) RETURNING id`,[TID]);
  cleanup.push(['financing_lenders',fl.id]);
  await run('PATCH /api/crm/financing/lenders/:id', `/api/crm/financing/lenders/${fl.id}`, {isActive:false},  // camelCase: SettingsView.jsx:1936 sends isActive
    async()=> (await pool.query('SELECT is_active FROM financing_lenders WHERE id=$1',[fl.id])).rows[0].is_active===false);

  // 4. financing plan
  const {rows:[fp]}=await pool.query(
    `INSERT INTO financing_plans (tenant_id,lender_id,external_plan_id,name,term_months,apr)
     VALUES ($1,$2,'QA-R95-PLAN','QA-R95 plan',60,9.99) RETURNING id`,[TID,fl.id]);
  cleanup.push(['financing_plans',fp.id]);
  await run('PATCH /api/crm/financing/plans/:id', `/api/crm/financing/plans/${fp.id}`, {isActive:false},  // updatePlan accepts only isActive/isDefault
    async()=> (await pool.query('SELECT is_active FROM financing_plans WHERE id=$1',[fp.id])).rows[0].is_active===false);

  // 5. task
  const {rows:[tk]}=await pool.query(
    `INSERT INTO tasks (tenant_id,title) VALUES ($1,'QA-R95 task') RETURNING id`,[TID]);
  cleanup.push(['tasks',tk.id]);
  await run('PATCH /api/crm/tasks/:id', `/api/crm/tasks/${tk.id}`, {title:'QA-R95 task renamed'},
    async()=> (await pool.query('SELECT title FROM tasks WHERE id=$1',[tk.id])).rows[0].title==='QA-R95 task renamed');

  // 6. automation
  const {rows:[au]}=await pool.query(
    `INSERT INTO automations (tenant_id,name,trigger_type,action_type) VALUES ($1,'QA-R95 auto','lead_created','send_email') RETURNING id`,[TID]);
  cleanup.push(['automations',au.id]);
  await run('PATCH /api/crm/automations/:id', `/api/crm/automations/${au.id}`, {name:'QA-R95 auto renamed'},
    async()=> (await pool.query('SELECT name FROM automations WHERE id=$1',[au.id])).rows[0].name==='QA-R95 auto renamed');
} finally {
  for(const [tb,id] of cleanup.reverse()) await pool.query(`DELETE FROM ${tb} WHERE id=$1`,[id]);
  for(const [tb,col] of [['contract_templates','name'],['financing_plans','name'],['financing_lenders','provider'],['tasks','title'],['automations','name']])
    await pool.query(`DELETE FROM ${tb} WHERE ${col} LIKE 'QA-R95%'`);
}
const after=await snapAll();
const drift=Object.keys(after).filter(k=>before[k]!==after[k]).map(k=>`${k}: ${before[k]}->${after[k]}`);
console.log(`\nglobal row-count drift: ${drift.length?drift.join(', '):'NONE (0 net writes)'}`);
console.log(`defects: ${defects.length}`);
for(const d of defects) console.log(`  ${d.status} ${d.label} :: ${String(d.txt).replace(/\s+/g,' ')}`);
await pool.end();
