import pool from './src/db/pool.js';
const { rows:[t] } = await pool.query("SELECT id FROM tenants WHERE slug='waterloo'");
for (const tb of ['automations','contract_templates','custom_fields','drip_sequences','financing_lenders','financing_plans','tasks','work_order_milestones']) {
  const tot = await pool.query(`SELECT count(*)::int n FROM ${tb}`).then(r=>r.rows[0].n).catch(e=>'ERR:'+e.code);
  const hasTid = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='tenant_id'`,[tb]).then(r=>r.rowCount>0).catch(()=>null);
  let mine = 'n/a';
  if (hasTid) mine = await pool.query(`SELECT count(*)::int n FROM ${tb} WHERE tenant_id=$1`,[t.id]).then(r=>r.rows[0].n).catch(e=>'ERR:'+e.code);
  console.log(`${tb.padEnd(24)} total=${String(tot).padEnd(6)} tenant_id_col=${String(hasTid).padEnd(5)} thisTenant=${mine}`);
}
await pool.end();
