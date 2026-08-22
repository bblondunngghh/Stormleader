import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const SINCE = "created_at > now() - interval '45 minutes'";
for (const t of ['estimates','invoices','work_orders','leads','activities','contracts','tasks','canvass_pins']) {
  try {
    const { rows } = await pool.query(`SELECT id, created_at FROM ${t} WHERE tenant_id=$1 AND ${SINCE} ORDER BY created_at`, [T]);
    if (rows.length) console.log(`${t}: ${rows.length} new ->`, rows.map(r=>r.id.slice(0,8)).join(' '));
  } catch (e) { console.log(t, 'ERR', e.code); }
}
console.log('--- totals ---');
for (const t of ['estimates','invoices','work_orders','leads','contracts']) {
  const { rows } = await pool.query(`SELECT count(*)::int c FROM ${t} WHERE tenant_id=$1`, [T]);
  console.log(t, rows[0].c);
}
console.log('--- state to revert ---');
const d = await pool.query(`SELECT id, estimate_number, status FROM estimates WHERE tenant_id=$1 AND status NOT IN ('draft','sent') ORDER BY updated_at DESC LIMIT 8`, [T]);
console.table(d.rows);
const w = await pool.query(`SELECT id, status, completed_at FROM work_orders WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 4`, [T]);
console.table(w.rows);
console.log('--- junk check: values my junk body could have written ---');
for (const [t,c] of [['leads','contact_name'],['subcontractors','name'],['canvass_pins','notes'],['drip_sequences','name'],['automations','name'],['contract_templates','name'],['canvass_territories','name'],['tenants','name']]) {
  try { const { rows } = await pool.query(`SELECT id, ${c}::text v FROM ${t} WHERE ${t==='tenants'?'id':'tenant_id'}=$1 AND ${c}::text IN ('12345','true','not-a-number')`, [T]);
    if (rows.length) console.log('JUNK', t+'.'+c, rows.map(r=>r.id.slice(0,8)+'='+r.v).join(' '));
  } catch(e) { console.log(t+'.'+c,'ERR',e.code); }
}
await pool.end();
