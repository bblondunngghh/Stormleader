import pool from './src/db/pool.js';
let bad=0;
for(const [tb,col] of [['contract_templates','name'],['financing_plans','name'],['financing_lenders','provider'],
  ['tasks','title'],['automations','name'],['notifications','title'],['drip_sequences','name'],
  ['prospect_lists','name'],['financing_applications','customer_name'],['custom_field_definitions','field_label']]){
  const {rows}=await pool.query(`SELECT count(*)::int n FROM ${tb} WHERE ${col} LIKE 'QA-R9%'`);
  if(rows[0].n) { console.log(`  LEAK ${tb}.${col} = ${rows[0].n}`); bad+=rows[0].n; }
}
const {rows:wo}=await pool.query(`SELECT jsonb_typeof(line_items) jty, count(*)::int n FROM work_orders GROUP BY 1`);
console.log('work_orders line_items:', wo.map(r=>`${r.jty}=${r.n}`).join(', '));
const {rows:orph}=await pool.query('SELECT count(*)::int n FROM prospect_list_items i LEFT JOIN prospect_lists l ON l.id=i.list_id WHERE l.id IS NULL');
const {rows:cf}=await pool.query("SELECT field_label FROM custom_field_definitions");
const {rows:woc}=await pool.query("SELECT status, completed_at FROM work_orders WHERE id='f8a24416-8692-4a13-a45a-5641e62170ef'");
console.log('orphan prospect_list_items:', orph[0].n);
console.log('custom_field_definitions labels:', JSON.stringify(cf.map(r=>r.field_label)));
console.log('touched work order f8a24416:', JSON.stringify(woc[0]));
console.log(bad===0 ? '\nHYGIENE: CLEAN — 0 QA rows remaining' : `\nHYGIENE: ${bad} LEAKED ROWS`);
await pool.end();
