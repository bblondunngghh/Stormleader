// Run 131 (s4) — read-only: baseline counts + cross-tenant fixture ids for re-verification
import pool from './src/db/pool.js';
const q = async (sql, p) => (await pool.query(sql, p)).rows;

const me = (await q(`SELECT id, slug FROM tenants WHERE slug='waterloo'`))[0];
const other = (await q(`SELECT id, slug FROM tenants WHERE id <> $1 ORDER BY created_at LIMIT 1`, [me.id]))[0];

const out = { me, other };
out.counts = (await q(`
  SELECT (SELECT count(*) FROM estimates) estimates,
         (SELECT count(*) FROM invoices) invoices,
         (SELECT count(*) FROM contracts) contracts,
         (SELECT count(*) FROM work_orders) work_orders,
         (SELECT count(*) FROM work_order_subcontractors) wo_subs,
         (SELECT count(*) FROM subcontractors) subcontractors,
         (SELECT count(*) FROM expenses) expenses,
         (SELECT count(*) FROM leads) leads`))[0];

out.foreign_lead     = (await q(`SELECT id, contact_name FROM leads      WHERE tenant_id=$1 LIMIT 1`, [other.id]))[0] || null;
out.foreign_estimate = (await q(`SELECT id FROM estimates        WHERE tenant_id=$1 LIMIT 1`, [other.id]))[0] || null;
out.foreign_sub      = (await q(`SELECT id, name FROM subcontractors WHERE tenant_id=$1 LIMIT 1`, [other.id]))[0] || null;
out.my_lead      = (await q(`SELECT id, contact_name FROM leads     WHERE tenant_id=$1 LIMIT 1`, [me.id]))[0] || null;
out.my_estimate  = (await q(`SELECT id, lead_id, estimate_number FROM estimates WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1`, [me.id]))[0] || null;
out.my_invoice   = (await q(`SELECT id, lead_id FROM invoices  WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1`, [me.id]))[0] || null;
out.my_contract  = (await q(`SELECT id, lead_id FROM contracts WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1`, [me.id]))[0] || null;
out.my_expense   = (await q(`SELECT id, lead_id FROM expenses  WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1`, [me.id]))[0] || null;
out.my_workorder = (await q(`SELECT id, title FROM work_orders WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1`, [me.id]))[0] || null;
out.my_sub       = (await q(`SELECT id, name FROM subcontractors WHERE tenant_id=$1 LIMIT 1`, [me.id]))[0] || null;

console.log(JSON.stringify(out, null, 1));
await pool.end();
