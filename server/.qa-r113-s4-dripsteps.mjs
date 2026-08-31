// Run 113 / s4. Confirm the non-array `steps` defect on /api/crm/drip-sequences.
// Creates ONE sequence with 3 identifiable steps, probes, then deletes everything.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const T = (await pool.query("SELECT id FROM tenants WHERE slug='waterloo'")).rows[0].id;

const api = async (method, path, body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let j = null;
  try { j = await r.json(); } catch (e) { /* non-json */ }
  return { status: r.status, body: j };
};
const stepRows = async (id) =>
  (await pool.query('SELECT step_order, delay_days, action_type FROM drip_sequence_steps WHERE sequence_id=$1 ORDER BY step_order', [id])).rows;

const before = (await pool.query('SELECT count(*)::int c FROM drip_sequence_steps')).rows[0].c;

// --- build a sequence with 3 DISTINCT, identifiable steps ---
const mk = await api('POST', '/api/crm/drip-sequences', {
  name: 'QA113B victim',
  trigger_type: 'stage_changed',
  trigger_config: {},
  steps: [
    { delay_days: 11, action_type: 'send_email', action_config: {} },
    { delay_days: 22, action_type: 'create_task', action_config: {} },
    { delay_days: 33, action_type: 'send_sms', action_config: {} },
  ],
});
const DID = mk.body && mk.body.id;
console.log('create status', mk.status, 'id', DID);
if (!DID) { console.log('cannot continue', JSON.stringify(mk.body)); await pool.end(); process.exit(1); }
console.log('steps BEFORE patch:', JSON.stringify(await stepRows(DID)));

// --- THE PROBE: PATCH with a non-array `steps` that has a truthy .length ---
const p = await api('PATCH', '/api/crm/drip-sequences/' + DID, { steps: 'abcd' });
console.log('PATCH steps="abcd" ->', p.status);
const afterPatch = await stepRows(DID);
console.log('steps AFTER patch: ', JSON.stringify(afterPatch));
console.log('VERDICT destructive:', JSON.stringify(afterPatch) !== JSON.stringify([
  { step_order: 1, delay_days: 11, action_type: 'send_email' },
  { step_order: 2, delay_days: 22, action_type: 'create_task' },
  { step_order: 3, delay_days: 33, action_type: 'send_sms' },
]));

// --- element-level shapes on POST (array container, junk elements) ---
const ELEM = [['null_elem', [null]], ['scalar_elem', ['a']], ['number_elem', [7]]];
for (const [lbl, v] of ELEM) {
  const r = await api('POST', '/api/crm/drip-sequences', { name: 'QA113B ' + lbl, trigger_type: 'stage_changed', trigger_config: {}, steps: v });
  console.log('POST steps=' + lbl + ' ->', r.status, r.body && r.body.error ? '"' + r.body.error + '"' : '');
}

// --- happy path must still work: a VALID array PATCH still replaces the steps ---
const good = await api('PATCH', '/api/crm/drip-sequences/' + DID, {
  steps: [
    { delay_days: 44, action_type: 'send_email', action_config: { subject: 'x' } },
    { delay_days: 55, action_type: 'create_task', action_config: {} },
  ],
});
const afterGood = await stepRows(DID);
console.log('PATCH valid 2-step array ->', good.status, JSON.stringify(afterGood));
console.log('VERDICT replace still works:', good.status === 200 && afterGood.length === 2 && afterGood[0].delay_days === 44 && afterGood[1].delay_days === 55);
const emptyArr = await api('PATCH', '/api/crm/drip-sequences/' + DID, { steps: [] });
console.log('PATCH steps=[] ->', emptyArr.status, 'rows now', (await stepRows(DID)).length, '(empty array clears — unchanged semantics)');
const noSteps = await api('PATCH', '/api/crm/drip-sequences/' + DID, { name: 'QA113B renamed' });
console.log('PATCH without steps ->', noSteps.status, 'rows now', (await stepRows(DID)).length, '(omitted steps must not touch rows)');

// --- cleanup ---
const dq = await pool.query("SELECT id FROM drip_sequences WHERE tenant_id=$1 AND name LIKE 'QA113B%'", [T]);
for (const x of dq.rows) {
  await pool.query('DELETE FROM drip_sequence_steps WHERE sequence_id=$1', [x.id]);
  await pool.query('DELETE FROM drip_enrollments WHERE sequence_id=$1', [x.id]);
}
await pool.query("DELETE FROM drip_sequences WHERE tenant_id=$1 AND name LIKE 'QA113B%'", [T]);
const after = (await pool.query('SELECT count(*)::int c FROM drip_sequence_steps')).rows[0].c;
console.log('step-row drift:', after - before, '(before ' + before + ' after ' + after + ')');
await pool.end();
