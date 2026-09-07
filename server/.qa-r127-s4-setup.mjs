// Makes the four client fix paths observable, then .qa-r127-s4-teardown.mjs reverts
// everything. Every id written here is recorded to C:\tmp\qa-r127-s4-state.json.
import pool from './src/db/pool.js';
import fs from 'fs';
import crypto from 'crypto';

const MINE = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const LEAD = 'dc8135aa-b210-4f33-bbe1-ad8f0997d3dd'; // has the token'd contract + a note activity
const state = { created: [], mutated: [] };

const before = (await pool.query(
  'SELECT (SELECT count(*) FROM tasks)::int tasks,(SELECT count(*) FROM activities)::int acts,' +
  '(SELECT count(*) FROM client_status_tokens)::int toks')).rows[0];
state.before = before;
console.log('BASELINE ' + JSON.stringify(before));

// original stage, so teardown can restore it
const origStage = (await pool.query('SELECT stage FROM leads WHERE id=$1', [LEAD])).rows[0].stage;
state.origStage = origStage;
state.lead = LEAD;
console.log('lead ' + LEAD + ' stage=' + origStage);

// --- 1. public status token (09fa4b5) ---
const token = crypto.randomBytes(32).toString('hex');
const t = await pool.query(
  'INSERT INTO client_status_tokens (tenant_id, lead_id, token) VALUES ($1,$2,$3) ' +
  'ON CONFLICT (lead_id) DO UPDATE SET token=$3 RETURNING id, token',
  [MINE, LEAD, token]);
state.created.push({ table: 'client_status_tokens', id: t.rows[0].id });
state.statusToken = t.rows[0].token;

// --- 2. status_change activities in the real seeded subject forms (09fa4b5 defect 3) ---
for (const [subj, ago] of [
  ['Status changed from New to Contacted', 5],
  ['Status changed from Contacted to Appt Set', 2],
]) {
  const a = await pool.query(
    "INSERT INTO activities (tenant_id, lead_id, type, subject, created_at) " +
    "VALUES ($1,$2,'status_change',$3, now() - ($4 || ' days')::interval) RETURNING id",
    [MINE, LEAD, subj, String(ago)]);
  state.created.push({ table: 'activities', id: a.rows[0].id });
}

// --- 3. a task due today, priority hot, for the calendar label (c7257b7) ---
const task = await pool.query(
  "INSERT INTO tasks (tenant_id, lead_id, title, due_date, priority, status) " +
  "VALUES ($1,$2,'QA-R127-S4 Calendar Task', now(), 'hot', 'pending') RETURNING id",
  [MINE, LEAD]);
state.created.push({ table: 'tasks', id: task.rows[0].id });

// --- 4. contract token already exists on a real row (0b3838a) ---
const c = await pool.query(
  'SELECT token FROM contracts WHERE lead_id = $1 AND token IS NOT NULL LIMIT 1', [LEAD]);
state.contractToken = c.rows[0] && c.rows[0].token;

// a lead whose 'call' activity has a NULL subject exercises the timeline fallback (39dee53)
const nullSubj = await pool.query(
  'SELECT lead_id, type FROM activities WHERE subject IS NULL LIMIT 2');
state.nullSubjectActivities = nullSubj.rows;

fs.writeFileSync('C:\\tmp\\qa-r127-s4-state.json', JSON.stringify(state, null, 1));
console.log(JSON.stringify({
  statusToken: state.statusToken,
  contractToken: state.contractToken,
  lead: LEAD,
  nullSubjectActivities: state.nullSubjectActivities,
}, null, 1));
console.log('created ' + state.created.length + ' rows; state -> C:\\tmp\\qa-r127-s4-state.json');
await pool.end();
