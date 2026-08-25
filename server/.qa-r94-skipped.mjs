import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const tables=['automations','contract_templates','custom_fields','drip_sequences','financing_lenders','financing_plans','tasks','work_order_milestones','canvass_territories'];
for(const t of tables){
  let exists=null,cols=[],total=null,scoped=null;
  try{
    const c=await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,[t]);
    exists=c.rows.length>0; cols=c.rows.map(r=>r.column_name);
  }catch(e){ }
  if(!exists){ console.log(`${t.padEnd(24)} TABLE DOES NOT EXIST`); continue; }
  try{ total=(await pool.query(`SELECT count(*)::int n FROM "${t}"`)).rows[0].n; }catch(e){ total='ERR '+e.code; }
  const hasTid=cols.includes('tenant_id');
  if(hasTid){ try{ scoped=(await pool.query(`SELECT count(*)::int n FROM "${t}" WHERE tenant_id=$1`,[T])).rows[0].n; }catch(e){ scoped='ERR '+e.code; } }
  console.log(`${t.padEnd(24)} rows=${String(total).padEnd(6)} tenant_id=${hasTid?String(scoped):'NO COLUMN'}  id_col=${cols.includes('id')}`);
}
await pool.end();
