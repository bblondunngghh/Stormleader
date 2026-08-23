// Run 84 real-id resolver. Extends r82's with the families it left as DEAD
// (financing plans/lenders/applications, drip steps, templates, lists) —
// a dead-uuid sweep 404s before handler logic runs and cannot find
// stored-shape crashes (see qa_standing_gotchas).
import pool from './src/db/pool.js';
import fs from 'fs';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const out = { tenantId: T };
const grab = async (key, sql) => {
  try { const r = await pool.query(sql, sql.includes('$1') ? [T] : []); if (r.rows[0]) out[key] = r.rows[0].id; }
  catch (e) { out['_err_' + key] = e.code; }        // missing table must not abort the sweep
};
const S = (t, extra = '') => `SELECT id FROM ${t} WHERE tenant_id=$1 ${extra} ORDER BY created_at DESC LIMIT 1`;
const pairs = [
  ['lead','leads'],['estimate','estimates'],['invoice','invoices'],['contract','contracts'],
  ['workOrder','work_orders'],['task','tasks'],['expense','expenses'],['subcontractor','subcontractors'],
  ['document','documents'],['activity','activities'],['contact','contacts'],
  ['dripSequence','drip_sequences'],['automation','automations'],['canvassPin','canvass_pins'],['materialOrder','material_orders'],
  ['notification','notifications'],['financingApp','financing_applications'],['territory','canvass_territories'],
  ['user','users'],['customField','custom_field_definitions'],
  // --- new for r84 ---
  ['financingPlan','financing_plans'],['financingLender','financing_lenders'],
  ['contractTemplate','contract_templates'],['prospectList','prospect_lists'],
  ['estimateTemplate','estimate_templates'],['payment','payments'],['alertConfig','alert_configs'],
  ['stormAlert','storm_alerts'],['contentLibrary','content_library'],
];
for (const [k, t] of pairs) await grab(k, S(t));
await grab('property', `SELECT id FROM properties LIMIT 1`);
await grab('stormEvent', `SELECT id FROM storm_events LIMIT 1`);
await grab('dripStep', `SELECT id FROM drip_sequence_steps LIMIT 1`);
await grab('pipelineStage', `SELECT id FROM pipeline_stages WHERE tenant_id=$1 LIMIT 1`);
await grab('prospectListItem', `SELECT id FROM prospect_list_items LIMIT 1`);
for (const [k, t, col] of [['estimateToken','estimates','public_token'],['contractToken','client_status_tokens','token']]) {
  try {
    const r = await pool.query(`SELECT ${col} v FROM ${t} WHERE tenant_id=$1 AND ${col} IS NOT NULL LIMIT 1`, [T]);
    if (r.rows[0]) out[k] = r.rows[0].v;
  } catch (e) { out['_err_' + k] = e.code; }
}
const tb = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
out._tables = tb.rows.map(x => x.table_name);
fs.writeFileSync('C:/tmp/qa-r85-ids.json', JSON.stringify(out, null, 1));
const resolved = Object.entries(out).filter(([k,v]) => !k.startsWith('_') && v).length;
console.log('resolved:', resolved, '| tables:', out._tables.length);
console.log('MISSING:', Object.keys(out).filter(k => k.startsWith('_err_')).join(', ') || 'none');
console.log(JSON.stringify({ ...out, _tables: undefined }, null, 1).slice(0, 1800));
await pool.end();
