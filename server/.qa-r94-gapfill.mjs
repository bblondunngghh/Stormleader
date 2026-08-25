// Run 94 s1 — close the 8 PATCH/PUT routes realidwrite could not reach.
// Same 3-layer safety: per-row snapshot+restore, global row-count drift, transitions reverted.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE='http://localhost:3001';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const TOKEN=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const q=async(s,p=[])=>{try{return (await pool.query(s,p)).rows;}catch(e){return [];}};
const snapAll=async()=>{const r=await q("SELECT tablename FROM pg_tables WHERE schemaname='public'");const c={};for(const{tablename}of r){const x=await q(`SELECT count(*)::int n FROM "${tablename}"`);if(x[0])c[tablename]=x[0].n;}return c;};
const getRow=async(t,id)=>(await q(`SELECT * FROM ${t} WHERE id=$1`,[id]))[0]||null;
const restore=async(t,id,s)=>{const cols=Object.keys(s).filter(c=>c!=='id');await pool.query(`UPDATE ${t} SET ${cols.map((c,i)=>`"${c}"=$${i+1}`).join(', ')} WHERE id=$${cols.length+1}`,[...cols.map(c=>s[c]),id]);};

const wom=(await q(`SELECT wom.id mid, wo.id woid FROM work_order_milestones wom JOIN work_orders wo ON wo.id=wom.work_order_id WHERE wo.tenant_id=$1 LIMIT 1`,[T]))[0];
const ct=(await q(`SELECT id FROM contract_templates WHERE tenant_id IS NULL LIMIT 1`))[0];
const et=(await q(`SELECT id FROM estimate_templates WHERE tenant_id=$1 LIMIT 1`,[T]))[0];
const notif=(await q(`SELECT id FROM notifications WHERE tenant_id=$1 LIMIT 1`,[T]))[0];

const PROBES=[
 {m:'PATCH',path:`/api/crm/work-orders/${wom?.woid}/milestones/${wom?.mid}`,label:'work-orders/:id/milestones/:milestoneId (MATCHED pair)',table:'work_order_milestones',id:wom?.mid},
 {m:'PATCH',path:`/api/crm/contracts/templates/${ct?.id}`,label:'contracts/templates/:id (GLOBAL tpl, tenant_id NULL)',table:'contract_templates',id:ct?.id},
 {m:'PATCH',path:`/api/estimates/templates/${et?.id}`,label:'estimates/templates/:id (real own row)',table:'estimate_templates',id:et?.id},
 {m:'PATCH',path:`/api/crm/work-orders/${wom?.woid}/milestones/${wom?.mid}/complete`,label:'milestone /complete (TRANSITION)',table:'work_order_milestones',id:wom?.mid},
 {m:'PATCH',path:`/api/notifications/${notif?.id}/read`,label:'notifications/:id/read (TRANSITION)',table:'notifications',id:notif?.id},
];
const before=await snapAll();
console.log('=== gap-fill: PATCH routes realidwrite could not reach ===\n');
const defects=[];
for(const p of PROBES){
  if(!p.id||p.path.includes('undefined')){console.log(`  --  SKIP (no row) ${p.label}`);continue;}
  const snap=await getRow(p.table,p.id);
  let st,body='';
  try{const r=await fetch(BASE+p.path,{method:p.m,headers:{'Content-Type':'application/json',Authorization:`Bearer ${TOKEN}`},body:JSON.stringify({})});st=r.status;body=(await r.text()).slice(0,200);}
  catch(e){st='THREW';body=String(e).slice(0,160);}
  let moved='';
  if(snap){const a=await getRow(p.table,p.id);const d=Object.keys(snap).filter(k=>k!=='updated_at'&&JSON.stringify(snap[k])!==JSON.stringify(a?.[k]));
    if(d.length){moved=` MUTATED[${d.join(',')}] -> restored`;await restore(p.table,p.id,snap);}}
  const bad=(typeof st==='number'&&st>=500)||st==='THREW';
  if(bad)defects.push({...p,st,body});
  console.log(`  ${bad?'DEFECT':'  ok  '} ${String(st).padEnd(5)} ${p.label}${moved}`);
  if(bad)console.log(`         ${body.replace(/\s+/g,' ')}`);
}
const after=await snapAll();
const drift=Object.keys(after).filter(t=>before[t]!==after[t]).map(t=>`${t}: ${before[t]}->${after[t]}`);
console.log('\nglobal row-count drift:',drift.length?drift.join(', '):'NONE (0 net writes)');
console.log('5xx/threw:',defects.length);
await pool.end();
