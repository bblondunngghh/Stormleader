import pool from './src/db/pool.js';
import fs from 'fs';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const out = { tenantId: T };
const grab = async (key, sql) => {
  try { const r = await pool.query(sql, [T]); if (r.rows[0]) out[key] = r.rows[0].id; }
  catch (e) { out['_err_'+key] = e.code; }
};
const S = (t, extra='') => `SELECT id FROM ${t} WHERE tenant_id=$1 ${extra} ORDER BY created_at DESC LIMIT 1`;
await grab('lead', S('leads'));
await grab('estimate', S('estimates'));
await grab('invoice', S('invoices'));
await grab('contract', S('contracts'));
await grab('workOrder', S('work_orders'));
await grab('task', S('tasks'));
await grab('expense', S('expenses'));
await grab('subcontractor', S('subcontractors'));
await grab('document', S('documents'));
await grab('activity', S('activities'));
await grab('contact', S('contacts'));
await grab('automation', S('automation_rules'));
await grab('dripSequence', S('drip_sequences'));
await grab('canvassPin', S('canvass_pins'));
await grab('materialOrder', S('material_orders'));
await grab('notification', S('notifications'));
await grab('financingApp', S('financing_applications'));
await grab('territory', S('territories'));
await grab('property', `SELECT id FROM properties LIMIT 1`);
await grab('stormEvent', `SELECT id FROM storm_events LIMIT 1`);
await grab('user', S('users'));
await grab('customField', S('custom_field_definitions'));
// public tokens
try { const r = await pool.query(`SELECT public_token FROM estimates WHERE tenant_id=$1 AND public_token IS NOT NULL LIMIT 1`,[T]); if(r.rows[0]) out.estimateToken = r.rows[0].public_token; } catch(e){ out._err_estToken=e.code; }
try { const r = await pool.query(`SELECT public_token FROM contracts WHERE tenant_id=$1 AND public_token IS NOT NULL LIMIT 1`,[T]); if(r.rows[0]) out.contractToken = r.rows[0].public_token; } catch(e){ out._err_ctrToken=e.code; }
// list tables that exist
const t = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
out._tables = t.rows.map(x=>x.table_name);
fs.writeFileSync('C:/tmp/qa-r82-ids.json', JSON.stringify(out,null,1));
console.log(JSON.stringify({...out, _tables: out._tables.length}, null, 1));
await pool.end();
