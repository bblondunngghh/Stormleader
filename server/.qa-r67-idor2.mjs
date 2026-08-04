// Run 67 — IDOR probe, pass 2. Disambiguate the three 200s from pass 1.
// Pass 1 used rows that may have had NO child data, so an empty body proves nothing.
// Here: pick parents that DEMONSTRABLY have children, and add a random-UUID control
// to separate "cross-tenant leak" from "route just never 404s".
import jwt from 'jsonwebtoken';
import pool from './src/db/pool.js';

const BASE = process.env.QA_BASE || 'http://localhost:3098';
const SECRET = process.env.JWT_SECRET || 'qa-r67-known-secret';
const A = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const B = 'e3961fce-802b-4c68-99c0-1f52bcaabe20';
const RANDOM = '00000000-0000-4000-8000-000000000000';

const users = await pool.query(`SELECT id,email,tenant_id,role FROM users WHERE tenant_id=ANY($1)`, [[A, B]]);
const ua = users.rows.find(u => u.tenant_id === A && u.role === 'admin');
const ub = users.rows.find(u => u.tenant_id === B);
const mint = u => jwt.sign({ id: u.id, tenantId: u.tenant_id, email: u.email, role: u.role }, SECRET, { expiresIn: '1h' });
const tokA = mint(ua), tokB = mint(ub);

// --- find parents that ACTUALLY have children -------------------------------
const q = async (sql) => (await pool.query(sql, [A])).rows[0] || null;
const leadWithActivities = await q(
  `SELECT l.id, count(a.id)::int n FROM leads l JOIN activities a ON a.lead_id=l.id
   WHERE l.tenant_id=$1 GROUP BY l.id ORDER BY n DESC LIMIT 1`);
const leadWithExpenses = await q(
  `SELECT l.id, count(e.id)::int n, sum(e.amount)::float total FROM leads l JOIN expenses e ON e.lead_id=l.id
   WHERE l.tenant_id=$1 GROUP BY l.id ORDER BY n DESC LIMIT 1`);
const woWithSubs = await q(
  `SELECT w.id, count(s.id)::int n FROM work_orders w JOIN subcontractor_assignments s ON s.work_order_id=w.id
   WHERE w.tenant_id=$1 GROUP BY w.id ORDER BY n DESC LIMIT 1`).catch(() => null);

console.log('PARENTS WITH REAL CHILD DATA (tenant A):');
console.log('  lead with activities :', leadWithActivities ? `${leadWithActivities.id} (${leadWithActivities.n} activities)` : 'NONE FOUND');
console.log('  lead with expenses   :', leadWithExpenses ? `${leadWithExpenses.id} (${leadWithExpenses.n} expenses, $${leadWithExpenses.total})` : 'NONE FOUND');
console.log('  work order with subs :', woWithSubs ? `${woWithSubs.id} (${woWithSubs.n} assignments)` : 'NONE FOUND');
console.log();

async function hit(path, tok) {
  const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${tok}` } });
  return { status: r.status, body: (await r.text()).slice(0, 200) };
}

const CASES = [];
if (leadWithActivities) CASES.push(['GET /crm/leads/:id/activities', `/api/crm/leads/${leadWithActivities.id}/activities`, `/api/crm/leads/${RANDOM}/activities`]);
if (leadWithExpenses)   CASES.push(['GET /crm/expenses/summary/:leadId', `/api/crm/expenses/summary/${leadWithExpenses.id}`, `/api/crm/expenses/summary/${RANDOM}`]);
if (woWithSubs)         CASES.push(['GET /crm/subcontractors/work-order/:id', `/api/crm/subcontractors/work-order/${woWithSubs.id}`, `/api/crm/subcontractors/work-order/${RANDOM}`]);

for (const [name, realPath, randomPath] of CASES) {
  const a = await hit(realPath, tokA);
  const b = await hit(realPath, tokB);
  const rnd = await hit(randomPath, tokB);
  console.log('='.repeat(90));
  console.log(name);
  console.log(`  A owns it        -> ${a.status}  ${a.body}`);
  console.log(`  B (other tenant) -> ${b.status}  ${b.body}`);
  console.log(`  B random uuid    -> ${rnd.status}  ${rnd.body}`);
  const sameAsRandom = b.status === rnd.status && b.body === rnd.body;
  const gotData = b.status < 300 && b.body !== rnd.body;
  console.log(`  VERDICT: ${gotData ? '*** DATA LEAK — B sees content A owns ***'
    : sameAsRandom ? 'NO LEAK — response identical to a nonexistent id (no oracle, no data)'
    : 'NO DATA, but response differs from random id — EXISTENCE ORACLE'}`);
}
await pool.end();
