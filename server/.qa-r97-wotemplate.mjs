// Run 97 (s1-api-test) — site 2 of the prototype-key lookup class.
//
// services/workOrderService.js:150
//   const template = MILESTONE_TEMPLATES[templateKey] || MILESTONE_TEMPLATES.default;
//   const defs = template.milestones;      // undefined for an inherited key
//   defs.map(...)                          // TypeError => 500
//
// templateKey is body-controlled: createWorkOrder passes `milestone_template` straight in
// (workOrderService.js:320). The work_orders INSERT happens BEFORE createMilestones, so the
// 500 leaves an ORPHAN work order with zero milestones.
//
// DB COST: creates at most 2 work orders (1 control + 1 probe), both deleted before exit.
// Net writes = 0. Verified by a count before/after.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

const post = async (path, body) => {
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  let j = null;
  try { j = await r.json(); } catch { /* non-json */ }
  return { status: r.status, body: j };
};

const { rows: [t] } = await pool.query("SELECT id FROM tenants WHERE slug = 'waterloo'");
const TID = t.id;
const countWO = async () => (await pool.query('SELECT count(*)::int AS n FROM work_orders WHERE tenant_id = $1', [TID])).rows[0].n;

const before = await countWO();
console.log('work_orders before:', before);

const mk = (tmpl) => ({ title: `QA-R97 proto probe ${tmpl}`, milestone_template: tmpl });

console.log('\n--- control: a template key that does NOT exist (ordinary junk) ---');
const ctl = await post('/api/crm/work-orders', mk('no_such_template_xyz'));
console.log(`  ${ctl.status >= 500 ? 'DEFECT' : '  ok  '} ${ctl.status}  milestone_template=no_such_template_xyz  (should fall back to default)`);
const ctlId = ctl.body?.id || null;
if (ctlId) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM work_order_milestones WHERE work_order_id = $1', [ctlId]);
  console.log(`          milestones created: ${rows[0].n}  (default template = 7)`);
}

console.log('\n--- probe: an INHERITED Object.prototype key ---');
const defects = [];
for (const key of ['constructor', '__proto__', 'toString', 'valueOf']) {
  const r = await post('/api/crm/work-orders', mk(key));
  const bad = r.status >= 500;
  if (bad) defects.push({ key, status: r.status });
  console.log(`  ${bad ? 'DEFECT' : '  ok  '} ${r.status}  milestone_template=${key}`);
  if (bad) console.log('           ', JSON.stringify(r.body || {}).slice(0, 200));
}

// Did the 500 leave orphan work orders behind?
const { rows: orph } = await pool.query(
  `SELECT w.id, w.title, (SELECT count(*)::int FROM work_order_milestones m WHERE m.work_order_id = w.id) AS milestones
   FROM work_orders w WHERE w.tenant_id = $1 AND w.title LIKE 'QA-R97%' ORDER BY w.created_at`,
  [TID]
);
console.log('\n--- rows actually created ---');
for (const o of orph) console.log(`  ${o.title}  -> ${o.milestones} milestones`);
const orphans = orph.filter((o) => o.milestones === 0);
console.log(`  ORPHANS (row created, 0 milestones, request 500'd): ${orphans.length}`);

console.log('\n=== cleanup ===');
await pool.query("DELETE FROM work_order_milestones WHERE work_order_id IN (SELECT id FROM work_orders WHERE tenant_id = $1 AND title LIKE 'QA-R97%')", [TID]);
await pool.query("DELETE FROM work_orders WHERE tenant_id = $1 AND title LIKE 'QA-R97%'", [TID]);
const after = await countWO();
console.log(`work_orders after: ${after}  | net writes: ${after - before}`);

console.log(`\n5xx DEFECTS: ${defects.length}`);
await pool.end();
