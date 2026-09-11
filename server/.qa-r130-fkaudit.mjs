// Run 130 (s1) — does any row ALREADY hold a cross-tenant FK?
// Scoping a read join is only safe if every legitimate row satisfies the new predicate.
// This also answers the second half of the two-layer doctrine: input validation cannot
// reach a foreign row that is already stored, so if any of these counts is non-zero the
// join predicate is the ONLY thing that closes it.
import pool from './src/db/pool.js';

const checks = [
  ['contracts.estimate_id',  `SELECT count(*) n FROM contracts c JOIN estimates e ON e.id = c.estimate_id WHERE e.tenant_id <> c.tenant_id`],
  ['contracts.lead_id',      `SELECT count(*) n FROM contracts c JOIN leads l ON l.id = c.lead_id WHERE l.tenant_id <> c.tenant_id`],
  ['payments.estimate_id',   `SELECT count(*) n FROM payments p JOIN estimates e ON e.id = p.estimate_id WHERE e.tenant_id <> p.tenant_id`],
  ['invoices.lead_id',       `SELECT count(*) n FROM invoices i JOIN leads l ON l.id = i.lead_id WHERE l.tenant_id <> i.tenant_id`],
  ['invoices.estimate_id',   `SELECT count(*) n FROM invoices i JOIN estimates e ON e.id = i.estimate_id WHERE e.tenant_id <> i.tenant_id`],
  ['expenses.lead_id',       `SELECT count(*) n FROM expenses x JOIN leads l ON l.id = x.lead_id WHERE l.tenant_id <> x.tenant_id`],
  ['estimates.lead_id',      `SELECT count(*) n FROM estimates e JOIN leads l ON l.id = e.lead_id WHERE l.tenant_id <> e.tenant_id`],
  ['work_orders.lead_id',    `SELECT count(*) n FROM work_orders w JOIN leads l ON l.id = w.lead_id WHERE l.tenant_id <> w.tenant_id`],
  ['work_orders.estimate_id',`SELECT count(*) n FROM work_orders w JOIN estimates e ON e.id = w.estimate_id WHERE e.tenant_id <> w.tenant_id`],
  ['tasks.lead_id',          `SELECT count(*) n FROM tasks t JOIN leads l ON l.id = t.lead_id WHERE l.tenant_id <> t.tenant_id`],
  ['activities.lead_id',     `SELECT count(*) n FROM activities a JOIN leads l ON l.id = a.lead_id WHERE l.tenant_id <> a.tenant_id`],
  ['fin_apps.estimate_id',   `SELECT count(*) n FROM financing_applications f JOIN estimates e ON e.id = f.estimate_id WHERE e.tenant_id <> f.tenant_id`],
  ['fin_apps.plan_id',       `SELECT count(*) n FROM financing_applications f JOIN financing_plans p ON p.id = f.plan_id WHERE p.tenant_id <> f.tenant_id`],
  ['wo_subs.subcontractor',  `SELECT count(*) n FROM work_order_subcontractors ws JOIN subcontractors s ON s.id = ws.subcontractor_id JOIN work_orders w ON w.id = ws.work_order_id WHERE s.tenant_id <> w.tenant_id`],
];

const out = {};
for (const [name, sql] of checks) {
  try {
    const { rows } = await pool.query(sql);
    out[name] = Number(rows[0].n);
  } catch (e) {
    out[name] = 'ERR ' + e.message.split('\n')[0];
  }
}
console.log(JSON.stringify(out, null, 2));
const bad = Object.entries(out).filter(([, v]) => typeof v === 'number' && v > 0);
console.log(bad.length ? 'CROSS-TENANT ROWS ALREADY STORED: ' + JSON.stringify(bad) : 'no cross-tenant FK rows stored');
await pool.end();
