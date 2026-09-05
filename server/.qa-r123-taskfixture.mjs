// Run 123-s1 — CLOSES THE `tasks` FIXTURE GAP flagged by Run 117-s1 and Run 122-s1.
// The waterloo tenant holds ZERO tasks, so PATCH /api/crm/tasks/:id has never been hit
// with a real id and its 7 whitelisted fields are the last unprobed typed columns in the
// CRM core. Creates exactly ONE task, probes every field (valid + wrong type + null),
// exercises the three GET /api/crm/tasks filters, then DELETEs the row. Net writes: 0.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const T = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${T}` };
const req = async (m, p, b) => {
  const r = await fetch(BASE + p, { method: m, headers: H, body: b === undefined ? undefined : JSON.stringify(b) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { }
  return { st: r.status, j, t: t.slice(0, 130).replace(/\s+/g, ' ') };
};

const TENANT = (await pool.query(`SELECT id FROM tenants WHERE slug='waterloo'`)).rows[0].id;
const LEAD = (await pool.query(`SELECT id FROM leads WHERE tenant_id=$1 LIMIT 1`, [TENANT])).rows[0].id;
const USER = (await pool.query(`SELECT id FROM users WHERE tenant_id=$1 LIMIT 1`, [TENANT])).rows[0].id;
const before = (await pool.query(`SELECT count(*)::int c FROM tasks`)).rows[0].c;
console.log(`tasks before=${before}  lead=${LEAD}  user=${USER}`);

const cols = (await pool.query(
  `SELECT column_name, data_type, is_nullable FROM information_schema.columns
   WHERE table_name='tasks' ORDER BY ordinal_position`)).rows;
console.log('\ntasks columns:');
cols.forEach((c) => console.log(`  ${c.column_name.padEnd(16)} ${c.data_type.padEnd(28)} null=${c.is_nullable}`));

const FAIL = [], NOTE = [];
const chk = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) FAIL.push(msg); };

// ---- create
const c = await req('POST', '/api/crm/tasks', {
  title: 'QA-R123 fixture', description: 'temporary', lead_id: LEAD,
  assigned_to: USER, due_date: '2026-09-10', priority: 'hot',
});
console.log(`\nPOST /api/crm/tasks -> ${c.st} ${c.t}`);
const id = c.j?.id;
if (!id) { console.log('CANNOT CONTINUE — create failed'); await pool.end(); process.exit(1); }
chk(c.st === 201, `create returns 201 (got ${c.st})`);
chk(c.j.priority === 'hot', `created priority persisted (${c.j.priority})`);
chk(c.j.lead_id === LEAD, `created lead_id persisted`);

// ---- GET list + filters, now that a row exists
const list = await req('GET', '/api/crm/tasks');
chk(list.st === 200 && list.j?.tasks?.length === 1, `GET /tasks -> 1 row (${list.j?.tasks?.length})`);
const t0 = list.j?.tasks?.[0] || {};
NOTE.push('list row keys: ' + Object.keys(t0).join(','));
for (const [q, want, label] of [
  [`lead_id=${LEAD}`, 1, 'lead_id real'],
  [`lead_id=00000000-0000-4000-8000-000000000000`, 0, 'lead_id dead'],
  [`assigned_to=${USER}`, 1, 'assigned_to real'],
  [`assigned_to=00000000-0000-4000-8000-000000000000`, 0, 'assigned_to dead'],
  [`completed=false`, 1, 'completed=false'],
  [`completed=true`, 0, 'completed=true'],
]) {
  const r = await req('GET', `/api/crm/tasks?${q}`);
  const n = r.j?.tasks?.length;
  chk(r.st === 200 && n === want, `GET /tasks?${label} -> ${n} (want ${want})`);
}

// ---- PATCH: valid values for every whitelisted field
const VALID = [
  ['title', 'QA-R123 renamed'], ['description', 'edited'], ['due_date', '2026-09-20'],
  ['assigned_to', USER], ['priority', 'cold'], ['status', 'completed'],
  ['completed_at', '2026-09-04T00:00:00Z'], ['completed', true], ['completed', false],
];
console.log('\n--- PATCH valid ---');
for (const [f, v] of VALID) {
  const r = await req('PATCH', `/api/crm/tasks/${id}`, { [f]: v });
  chk(r.st === 200, `PATCH ${f}=${JSON.stringify(v)} -> ${r.st} ${r.st !== 200 ? r.t : ''}`);
}

// ---- PATCH: wrong types + null (should be 400, never 5xx, never silently stored)
console.log('\n--- PATCH wrong type / null ---');
const WRONG = [['string', 'oops'], ['number', 42], ['bool', true], ['object', { a: 1 }], ['array', [1, 2]], ['null', null]];
for (const f of ['title', 'description', 'due_date', 'assigned_to', 'priority', 'completed_at', 'status']) {
  for (const [lbl, v] of WRONG) {
    const r = await req('PATCH', `/api/crm/tasks/${id}`, { [f]: v });
    const is5 = r.st >= 500;
    if (is5) chk(false, `PATCH ${f}=${lbl} -> ${r.st} ${r.t}`);
    else NOTE.push(`${String(r.st)} PATCH ${f}=${lbl} ${r.st < 300 ? 'ACCEPTED' : ''} ${r.st >= 400 ? r.t : ''}`);
  }
}

// ---- what did the accepted junk actually store?
const row = (await pool.query(`SELECT * FROM tasks WHERE id=$1`, [id])).rows[0];
console.log('\nstored row after junk probes:');
Object.entries(row).forEach(([k, v]) => console.log(`  ${k.padEnd(16)} ${JSON.stringify(v)}`));

// ---- consumer reads must survive the junk
for (const p of ['/api/crm/tasks', '/api/crm/dashboard/tasks-today', '/api/crm/calendar?start=2026-01-01T00:00:00Z&end=2027-01-01T00:00:00Z']) {
  const r = await req('GET', p);
  chk(r.st === 200, `consumer read ${p} -> ${r.st} ${r.st !== 200 ? r.t : ''}`);
}

// ---- cleanup (no DELETE route for tasks)
await pool.query(`DELETE FROM tasks WHERE id=$1`, [id]);
const after = (await pool.query(`SELECT count(*)::int c FROM tasks`)).rows[0].c;
chk(after === before, `tasks count restored ${before} -> ${after}`);

console.log('\n=== NOTES ===');
NOTE.forEach((n) => console.log(n));
console.log(`\n=== ${FAIL.length} FAILURES ===`);
FAIL.forEach((f) => console.log(f));
await pool.end();
