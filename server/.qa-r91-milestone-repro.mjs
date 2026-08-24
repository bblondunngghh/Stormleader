// Run 91 (s1-api-test) — REPRODUCTION for the milestone `completed` wipe.
//
// DEFECT: workOrderService.updateMilestone (workOrderService.js:186) does
//     SET completed = $3
// unconditionally, where $3 is `req.body.completed` destructured at
// workOrders.js:187. When the body omits `completed`, node-postgres binds
// `undefined` as NULL, so ANY partial PATCH wipes the flag to NULL — and
// `completed_at` follows via the CASE, so the timestamp is lost too.
//
// THIS IS A LIVE USER PATH, not a synthetic one:
//   WorkOrdersView.jsx:97 -> updateWorkOrderMilestone(wo.id, milestoneId, { photo_url: photoUrl })
// Uploading a photo to an already-completed milestone marks it incomplete.
//
// Run BEFORE the fix -> steps 2 and 4 FAIL. Run AFTER -> all PASS.
// The original row is captured up front and restored at exit, with the restore VERIFIED.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = process.argv[2] || 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();

const q = async (sql, p = []) => (await pool.query(sql, p)).rows;

// A milestone whose photo_required is false, so step 1 is not blocked by the 422 guard.
const [ms] = await q(
  `SELECT m.*, m.work_order_id FROM work_order_milestones m
   JOIN work_orders w ON w.id = m.work_order_id
   WHERE COALESCE(m.photo_required, false) = false
   LIMIT 1`
);
if (!ms) { console.log('no usable milestone'); await pool.end(); process.exit(1); }

const WO = ms.work_order_id;
const MS = ms.id;
const ORIGINAL = { ...ms };
console.log(`target milestone: ${MS} ("${ms.name}")  work order ${WO}`);
console.log(`ORIGINAL: completed=${ORIGINAL.completed}  completed_at=${ORIGINAL.completed_at}  photo_url=${ORIGINAL.photo_url}\n`);

const patch = async (body) => {
  const r = await fetch(`${BASE}/api/crm/work-orders/${WO}/milestones/${MS}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  let j = null; try { j = await r.json(); } catch { /* none */ }
  return { status: r.status, body: j };
};
const readCompleted = async () => (await q('SELECT completed, completed_at, photo_url FROM work_order_milestones WHERE id = $1', [MS]))[0];

const results = [];
const step = async (label, body, expect) => {
  const res = await patch(body);
  const row = await readCompleted();
  const pass = row.completed === expect;
  results.push({ label, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}`);
  console.log(`      sent ${JSON.stringify(body)} -> ${res.status}; completed=${row.completed} (expected ${expect}), completed_at=${row.completed_at ? 'set' : 'null'}`);
  return row;
};

console.log('--- steps ---');
await step('1. explicit {completed:true} marks it complete', { completed: true }, true);
await step('2. photo-only PATCH must NOT clear completed  <-- the defect', { photo_url: 'https://qa.example/r91.jpg' }, true);
await step('3. explicit {completed:false} marks it incomplete', { completed: false }, false);
await step('4. empty {} PATCH must NOT change completed', {}, false);

// ---------- restore, and VERIFY the restore ----------
await pool.query(
  `UPDATE work_order_milestones
   SET completed = $1, completed_at = $2, photo_url = $3
   WHERE id = $4`,
  [ORIGINAL.completed, ORIGINAL.completed_at, ORIGINAL.photo_url, MS]
);
const [back] = await q('SELECT completed, completed_at, photo_url FROM work_order_milestones WHERE id = $1', [MS]);
const restored =
  back.completed === ORIGINAL.completed &&
  String(back.completed_at) === String(ORIGINAL.completed_at) &&
  back.photo_url === ORIGINAL.photo_url;
console.log(`\nRESTORE ${restored ? 'VERIFIED' : 'FAILED'} -> completed=${back.completed} completed_at=${back.completed_at} photo_url=${back.photo_url}`);

const nulls = (await q('SELECT count(*)::int n FROM work_order_milestones WHERE completed IS NULL'))[0].n;
console.log(`milestones with completed IS NULL: ${nulls} (must be 0)`);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} steps pass`);
if (failed.length) console.log('FAILING:', failed.map((f) => f.label).join(' | '));

await pool.end();
