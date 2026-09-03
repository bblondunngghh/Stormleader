// Run 120 s4 — VERIFY the four fixes committed tonight (4e3352b..HEAD).
// This file covers the SERVER-side one (1849a13, PG 22023 -> 400) plus the
// regression question that matters for it: does widening PG_BAD_INPUT_CODES
// mask anything that should still be a 500?
//
// Write safety: every probe here is expected to FAIL at the SQL boundary, so the
// UPDATE/INSERT never commits. updated_at is snapshotted before and after to
// prove it. No row is created, none is modified.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const T = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();

const req = async (m, p, b) => {
  const r = await fetch(BASE + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T },
    body: b === undefined ? undefined : JSON.stringify(b),
  });
  let body;
  try { body = await r.json(); } catch { body = null; }
  return { st: r.status, body };
};

const out = [];
const log = (s) => { out.push(s); console.log(s); };

// ---- fixture -------------------------------------------------------------
const wo = await pool.query(
  `select id, scheduled_time_start, scheduled_time_end, updated_at
     from work_orders order by created_at limit 1`
);
if (!wo.rows.length) { console.log('NO WORK ORDER FIXTURE'); process.exit(1); }
const W = wo.rows[0];
const beforeCount = (await pool.query('select count(*)::int c from work_orders')).rows[0].c;
log(`fixture work_order ${W.id}  time_start=${W.scheduled_time_start}  updated_at=${W.updated_at.toISOString()}`);
log(`work_orders rows before: ${beforeCount}`);

const lead = (await pool.query('select id from leads limit 1')).rows[0];

// ---- V1: the 22023 case that used to 500 --------------------------------
// The trigger is narrow: a time string with a hyphen/space whose trailing token
// is not a real zone name. These are the exact shapes from the 1849a13 commit.
const T22023 = ['not-a-time', 'a-b', '10:00 not-a-zone', 'foo-bar-baz'];
log('\n== V1  PATCH /crm/work-orders/:id  scheduled_time_start (22023 shapes) ==');
for (const v of T22023) {
  const r = await req('PATCH', `/api/crm/work-orders/${W.id}`, { scheduled_time_start: v });
  const ok = r.st === 400;
  log(`  ${ok ? 'PASS' : 'FAIL'}  ${JSON.stringify(v).padEnd(22)} -> ${r.st}  ${JSON.stringify(r.body)}`);
}

log('\n== V1b POST /crm/work-orders (create path, same column) ==');
for (const v of ['not-a-time', 'a-b']) {
  const r = await req('POST', '/api/crm/work-orders',
    { title: 'qa-r120-should-never-exist', lead_id: lead.id, scheduled_time_start: v });
  const ok = r.st === 400;
  log(`  ${ok ? 'PASS' : 'FAIL'}  ${JSON.stringify(v).padEnd(22)} -> ${r.st}  ${JSON.stringify(r.body)}`);
}

// ---- V2: the codes that were ALREADY handled must still be handled -------
log('\n== V2  regression: pre-existing datetime codes still 400 ==');
const T_OLD = ['abc', '1', 'true', '', 'x y z', '25:99', '99:99:99'];
for (const v of T_OLD) {
  const r = await req('PATCH', `/api/crm/work-orders/${W.id}`, { scheduled_time_start: v });
  const ok = r.st >= 400 && r.st < 500;
  log(`  ${ok ? 'PASS' : 'FAIL'}  ${JSON.stringify(v).padEnd(12)} -> ${r.st}  ${JSON.stringify(r.body).slice(0, 110)}`);
}

// ---- V3: other error codes must NOT have been swallowed ------------------
log('\n== V3  other bad-input codes still map to 4xx (not masked, not 500) ==');
const OTHER = [
  ['22P02 bad uuid',      'PATCH', `/api/crm/work-orders/${W.id}`, { assigned_to: 'not-a-uuid' }],
  ['23503 fk violation',  'PATCH', `/api/crm/work-orders/${W.id}`, { lead_id: '00000000-0000-0000-0000-000000000000' }],
  ['23514/enum status',   'PATCH', `/api/crm/work-orders/${W.id}`, { status: 'bogus_status' }],
  ['22007 bad date',      'PATCH', `/api/crm/work-orders/${W.id}`, { scheduled_date: 'not-a-date' }],
  ['22023 time_end',      'PATCH', `/api/crm/work-orders/${W.id}`, { scheduled_time_end: 'not-a-time' }],
];
for (const [name, m, p, b] of OTHER) {
  const r = await req(m, p, b);
  const ok = r.st >= 400 && r.st < 500;
  log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(20)} -> ${r.st}  ${JSON.stringify(r.body).slice(0, 110)}`);
}

// ---- V4: nothing was written --------------------------------------------
const after = await pool.query(
  `select scheduled_time_start, scheduled_time_end, updated_at from work_orders where id = $1`, [W.id]);
const afterCount = (await pool.query('select count(*)::int c from work_orders')).rows[0].c;
const A = after.rows[0];
log('\n== V4  write safety ==');
log(`  rows: ${beforeCount} -> ${afterCount}  ${beforeCount === afterCount ? 'PASS' : 'FAIL'}`);
log(`  updated_at: ${W.updated_at.toISOString()} -> ${A.updated_at.toISOString()}  ${W.updated_at.getTime() === A.updated_at.getTime() ? 'PASS (untouched)' : 'FAIL (row moved)'}`);
log(`  time_start: ${W.scheduled_time_start} -> ${A.scheduled_time_start}  ${String(W.scheduled_time_start) === String(A.scheduled_time_start) ? 'PASS' : 'FAIL'}`);
const junk = await pool.query(`select count(*)::int c from work_orders where title like 'qa-r120%'`);
log(`  junk rows created: ${junk.rows[0].c}  ${junk.rows[0].c === 0 ? 'PASS' : 'FAIL'}`);

fs.writeFileSync('C:/tmp/qa-r120-s4-api.txt', out.join('\n'));
await pool.end();
