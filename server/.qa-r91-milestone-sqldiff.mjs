// Run 91 (s2) — differential proof that the OLD updateMilestone SQL wipes `completed`
// and the NEW SQL preserves it. Runs both statements directly against one existing row
// with the photo-only binding (completed = NULL), restoring the row after each.
import pool from './src/db/pool.js';

const q = async (sql, p = []) => (await pool.query(sql, p)).rows;

const [ms] = await q(
  `SELECT m.* FROM work_order_milestones m
   JOIN work_orders w ON w.id = m.work_order_id
   WHERE COALESCE(m.photo_required,false)=false LIMIT 1`
);
const ORIGINAL = { ...ms };
console.log(`row ${ms.id} ("${ms.name}")  ORIGINAL completed=${ORIGINAL.completed} completed_at=${ORIGINAL.completed_at}\n`);

const OLD = `UPDATE work_order_milestones
   SET completed = $3,
       completed_at = CASE WHEN $3 = true THEN NOW() ELSE NULL END,
       photo_url = COALESCE($4, photo_url)
   WHERE id = $2 AND work_order_id = $1 RETURNING completed, completed_at`;

const NEW = `UPDATE work_order_milestones
   SET completed = COALESCE($3::boolean, completed),
       completed_at = CASE
         WHEN $3::boolean IS NULL THEN completed_at
         WHEN $3::boolean = true THEN NOW()
         ELSE NULL END,
       photo_url = COALESCE($4, photo_url)
   WHERE id = $2 AND work_order_id = $1 RETURNING completed, completed_at`;

const restore = () => pool.query(
  `UPDATE work_order_milestones SET completed=$1, completed_at=$2, photo_url=$3 WHERE id=$4`,
  [ORIGINAL.completed, ORIGINAL.completed_at, ORIGINAL.photo_url, ms.id]);

const trial = async (label, sql) => {
  // set the row to a genuinely completed state first
  await pool.query(`UPDATE work_order_milestones SET completed=true, completed_at=NOW() WHERE id=$1`, [ms.id]);
  // now the photo-only PATCH binding: completed is undefined -> NULL
  const [r] = await q(sql, [ms.work_order_id, ms.id, null, 'https://qa.example/r91-diff.jpg']);
  const ok = r.completed === true && r.completed_at !== null;
  console.log(`${ok ? 'PRESERVES' : 'WIPES    '}  ${label}: completed=${r.completed}  completed_at=${r.completed_at ? 'set' : 'NULL'}`);
  await restore();
  return ok;
};

console.log('--- photo-only PATCH against a COMPLETED milestone ---');
const oldOk = await trial('OLD SQL (pre-fix)', OLD);
const newOk = await trial('NEW SQL (the fix)', NEW);

const [back] = await q('SELECT completed, completed_at, photo_url FROM work_order_milestones WHERE id=$1', [ms.id]);
const restored = back.completed === ORIGINAL.completed
  && String(back.completed_at) === String(ORIGINAL.completed_at)
  && back.photo_url === ORIGINAL.photo_url;
const nulls = (await q('SELECT count(*)::int n FROM work_order_milestones WHERE completed IS NULL'))[0].n;

console.log(`\nRESTORE ${restored ? 'VERIFIED' : 'FAILED'} -> completed=${back.completed} completed_at=${back.completed_at} photo_url=${back.photo_url}`);
console.log(`milestones with completed IS NULL: ${nulls} (must be 0)`);
console.log(`\nDIFFERENTIAL ${!oldOk && newOk ? 'CONFIRMED — old wipes, new preserves' : 'NOT CONFIRMED'}`);
await pool.end();
