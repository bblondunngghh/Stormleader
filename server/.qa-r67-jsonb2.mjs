import pool from './src/db/pool.js';
const A='791bb51d-3293-4839-92e9-bd4d4f873af2';
for (const [tbl,col] of [['invoices','line_items'],['work_orders','line_items'],['material_orders','items'],['estimates','financing_plan_ids'],['subscription_plans','features']]) {
  const { rows } = await pool.query(
    `SELECT id, ${col} AS v FROM ${tbl}
      WHERE jsonb_typeof(${col}::jsonb)='array'
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(${col}::jsonb) e WHERE jsonb_typeof(e)<>'object')`);
  console.log(`\n${tbl}.${col} — ${rows.length} row(s) with non-object elements:`);
  rows.forEach(r=>console.log(`  ${r.id}  ${JSON.stringify(r.v).slice(0,110)}`));
}
await pool.end();
