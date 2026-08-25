import pool from './src/db/pool.js';
const {rows:[t]}=await pool.query("SELECT id FROM tenants WHERE slug='waterloo'");
for(const tb of ['custom_field_definitions','contract_templates','financing_lenders','financing_plans','tasks','automations','estimate_templates','canvass_territories']){
  try{
    const tot=(await pool.query(`SELECT count(*)::int n FROM ${tb}`)).rows[0].n;
    const mine=(await pool.query(`SELECT count(*)::int n FROM ${tb} WHERE tenant_id=$1`,[t.id])).rows[0].n;
    const nul=(await pool.query(`SELECT count(*)::int n FROM ${tb} WHERE tenant_id IS NULL`)).rows[0].n;
    console.log(`${tb.padEnd(26)} total=${String(tot).padEnd(5)} mine=${String(mine).padEnd(5)} tenantNull=${nul}`);
  }catch(e){ console.log(`${tb.padEnd(26)} ERR ${e.code} ${e.message.slice(0,50)}`);}
}
await pool.end();
