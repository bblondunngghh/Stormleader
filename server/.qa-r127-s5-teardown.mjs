import pool from './src/db/pool.js';
// s4 capped before writing its teardown. Remove ONLY the rows it actually inserted.
// client_status_tokens 283bbfdd is NOT deleted: ON CONFLICT (lead_id) DO UPDATE hit a
// pre-existing row (created_at 2026-07-30, count unchanged at 4). Its token was rotated;
// deleting the row would destroy live data.
const a = await pool.query('DELETE FROM activities WHERE id = ANY($1) RETURNING id',
  [['8fbb611a-bc95-4332-9402-4b8f7df77d15','b99447bb-48fa-48ca-be73-ee8740aae000']]);
const t = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id',
  ['cc3973a9-3106-43c1-8bf5-04db01aa7d32']);
console.log('deleted activities:', a.rowCount, 'tasks:', t.rowCount);
const now = (await pool.query(
  'SELECT (SELECT count(*) FROM tasks)::int tasks,(SELECT count(*) FROM activities)::int acts,' +
  '(SELECT count(*) FROM client_status_tokens)::int toks')).rows[0];
console.log('BASELINE(s4) {"tasks":0,"acts":2,"toks":4}');
console.log('AFTER        ' + JSON.stringify(now));
const net = now.tasks === 0 && now.acts === 2 && now.toks === 4;
console.log(net ? 'DB NET ZERO: PASS' : 'DB NET ZERO: FAIL');
// no QA-named leftovers anywhere
const junk = await pool.query(
  "SELECT 'tasks' t, id::text FROM tasks WHERE title ILIKE '%QA-R127%' " +
  "UNION ALL SELECT 'activities', id::text FROM activities WHERE subject ILIKE '%QA-R127%'");
console.log('QA-R127-named leftovers:', junk.rowCount);
await pool.end();
