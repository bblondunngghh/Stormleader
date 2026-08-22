import pool from './src/db/pool.js';
const R83 = {
  drip_sequences:'8c6f8eda-a446-462a-8991-5a767246cc3b',
  contract_templates:'e27e0532-218f-4440-a8b1-579bc84a8641',
  prospect_lists:'afd280df-adb9-4660-95bc-58bc82c4aaef',
  canvass_pins:'e85f1aa4-3243-4450-a90f-af0769c27211',
  custom_field_definitions:'107af0d9-2a1f-4d24-b505-5053bcd360ea',
  automations:'4c6c468b-1402-43ff-a19c-abcc1dfd6dde',
  subcontractors:'4a9b0e11-ad7a-4bcd-88ff-1c2220e62f20',
};
const log = [];
const run = async (label, sql, params=[]) => {
  try { const r = await pool.query(sql, params); log.push(`${label}: ${r.rowCount}`); }
  catch (e) { log.push(`${label}: ERR ${e.message.slice(0,70)}`); }
};
// 1) tonight's s1 estimate artifacts
await run('estimates EST-083..090', `DELETE FROM estimates WHERE estimate_number BETWEEN 'EST-083' AND 'EST-090' AND created_at::date = DATE '2026-08-21'`);
// 2) my own run-84 rows
await run('wo milestones (QA84)', `DELETE FROM work_order_milestones WHERE work_order_id IN (SELECT id FROM work_orders WHERE title ILIKE '%QA84%')`);
await run('work_orders QA84', `DELETE FROM work_orders WHERE title ILIKE '%QA84%'`);
await run('tasks QA84', `DELETE FROM tasks WHERE title ILIKE '%QA84%'`);
// 3) run-83 leftovers
await run('financing_plans of qa lender', `DELETE FROM financing_plans WHERE lender_id = $1`, ['c95698b8-eb31-4884-b4d1-115c22ca76d2']);
await run('financing_lenders qa', `DELETE FROM financing_lenders WHERE id = $1`, ['c95698b8-eb31-4884-b4d1-115c22ca76d2']);
for (const [t,id] of Object.entries(R83)) await run(t, `DELETE FROM ${t} WHERE id = $1`, [id]);
await run('material_orders qa', `DELETE FROM material_order_items WHERE order_id = $1`, ['da9af329-5035-45c0-a2ac-88522216b796']);
await run('material_orders qa hdr', `DELETE FROM material_orders WHERE id = $1`, ['da9af329-5035-45c0-a2ac-88522216b796']);
// 4) QA leads (children first)
const leadIds = ['79afe165-6af8-4207-80f3-c59ce9d73893','3eb2be99-932d-434b-8404-9b17a85de344'];
for (const tb of ['activities','tasks','estimates','notes','lead_activities']) await run(`${tb} of qa leads`, `DELETE FROM ${tb} WHERE lead_id = ANY($1)`, [leadIds]);
await run('leads qa', `DELETE FROM leads WHERE id = ANY($1)`, [leadIds]);
console.log(log.join('\n'));
const c = await pool.query(`SELECT (SELECT count(*)::int FROM leads) leads,(SELECT count(*)::int FROM estimates) est,(SELECT count(*)::int FROM tasks) tasks,(SELECT count(*)::int FROM work_orders) wo,(SELECT max(estimate_number) FROM estimates) maxest`);
console.log('AFTER:', JSON.stringify(c.rows[0]));
process.exit(0);
