import pool from './src/db/pool.js';
const q = async (s, p) => (await pool.query(s, p)).rows;
const cf = await q(`SELECT id, field_key, field_type, jsonb_typeof(options) t, left(options::text,60) v FROM custom_field_definitions ORDER BY created_at DESC LIMIT 12`);
console.log('custom_field_definitions.options:'); cf.forEach(r => console.log(' ', r.field_key, '|', r.field_type, '| typeof=', r.t, '|', r.v));
for (const [tbl, col] of [['estimates','signers'],['estimates','discounts'],['estimates','line_items'],['estimates','upgrades'],['invoices','line_items'],['work_orders','line_items'],['material_orders','items'],['documents','tags'],['leads','lead_score_factors'],['contracts','content']]) {
  try {
    const r = await q(`SELECT jsonb_typeof(${col}) t, count(*)::int c FROM ${tbl} GROUP BY 1 ORDER BY 2 DESC`);
    console.log(`${tbl}.${col}:`, r.map(x => `${x.t}=${x.c}`).join(' '));
  } catch (e) { console.log(`${tbl}.${col}: ERR ${e.code}`); }
}
await pool.end();
