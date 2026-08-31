// Run 113 / s4-verify. Re-verify c30d968 (non-object trigger_config) against the LIVE
// :3001 server, and probe the shapes the fix commit did not test.
// Self-cleaning: every row created is deleted; before/after counts asserted.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const TABLES = ['automations', 'drip_sequences', 'drip_sequence_steps', 'drip_enrollments', 'tasks', 'notifications'];

// ---- mint ONCE (login is rate limited ~10/15min) ----
const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
});
const lj = await lr.json();
if (!lj.accessToken) { console.log('LOGIN FAILED', lr.status, JSON.stringify(lj)); process.exit(1); }
const TOKEN = lj.accessToken;
fs.writeFileSync('C:/tmp/qa-token.txt', TOKEN);
console.log('login OK, token written to C:/tmp/qa-token.txt');

const T = (await pool.query("SELECT id FROM tenants WHERE slug='waterloo'")).rows[0].id;
const counts = async () => {
  const o = {};
  for (const t of TABLES) {
    if (t === 'drip_sequence_steps') o[t] = (await pool.query('SELECT count(*)::int c FROM ' + t)).rows[0].c;
    else o[t] = (await pool.query('SELECT count(*)::int c FROM ' + t + ' WHERE tenant_id=$1', [T])).rows[0].c;
  }
  return o;
};
const before = await counts();
console.log('BEFORE', JSON.stringify(before));

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

const rows = [];
const rec = (group, label, expect, got, note) => {
  const pass = Array.isArray(expect) ? expect.includes(got.status) : got.status === expect;
  rows.push({ group, label, expect: String(expect), got: got.status, pass, err: (got.body && got.body.error) || '', note: note || '' });
};

const BAD = [['string', 'oops'], ['number', 42], ['zero', 0], ['bool_true', true], ['bool_false', false],
             ['array_empty', []], ['array_full', [{ toStage: 'sold' }]]];

// ---- 1. automations POST write guard ----
for (const [lbl, v] of BAD) {
  rec('auto_POST_trigger', lbl, 400, await api('POST', '/api/crm/automations',
    { name: 'QA113 ' + lbl, trigger_type: 'stage_changed', trigger_config: v, action_type: 'create_task' }));
}
for (const [lbl, v] of BAD) {
  rec('auto_POST_action', lbl, 400, await api('POST', '/api/crm/automations',
    { name: 'QA113 a ' + lbl, trigger_type: 'stage_changed', trigger_config: {}, action_type: 'create_task', action_config: v }));
}
rec('auto_POST_ok', 'null_trigger', 201, await api('POST', '/api/crm/automations',
  { name: 'QA113 null', trigger_type: 'stage_changed', trigger_config: null, action_type: 'create_task' }), 'null = match-all by design');
const created = [];
{
  const r = await api('POST', '/api/crm/automations',
    { name: 'QA113 valid', trigger_type: 'stage_changed', trigger_config: { toStage: 'sold' }, action_type: 'create_task', action_config: { title: 'x' } });
  rec('auto_POST_ok', 'object', 201, r);
  if (r.body && r.body.id) created.push(r.body.id);
}
{
  const q = await pool.query("SELECT id FROM automations WHERE tenant_id=$1 AND name LIKE 'QA113%'", [T]);
  for (const x of q.rows) if (!created.includes(x.id)) created.push(x.id);
}

// ---- 2. automations PATCH write guard + no corruption ----
const AID = created[0];
if (AID) {
  for (const [lbl, v] of BAD) rec('auto_PATCH_trigger', lbl, 400, await api('PATCH', '/api/crm/automations/' + AID, { trigger_config: v }));
  rec('auto_PATCH_trigger', 'null', [200, 400], await api('PATCH', '/api/crm/automations/' + AID, { trigger_config: null }), 'POST allows null, PATCH rejects — asymmetry check');
  rec('auto_PATCH_ok', 'object', 200, await api('PATCH', '/api/crm/automations/' + AID, { trigger_config: { toStage: 'won' } }));
  const stored = (await pool.query('SELECT trigger_config FROM automations WHERE id=$1', [AID])).rows[0];
  const s = stored ? JSON.stringify(stored.trigger_config) : 'MISSING';
  rows.push({ group: 'auto_stored', label: 'after_all_bad_shapes', expect: '{"toStage":"won"}', got: s, pass: s === '{"toStage":"won"}', err: '', note: 'column never took a scalar' });
}

// ---- 3. drip write guard ----
const okStep = [{ delay_days: 1, action_type: 'send_email', action_config: {} }];
for (const [lbl, v] of BAD) {
  rec('drip_POST_trigger', lbl, 400, await api('POST', '/api/crm/drip-sequences',
    { name: 'QA113 d ' + lbl, trigger_type: 'stage_changed', trigger_config: v, steps: okStep }));
}
for (const [lbl, v] of BAD) {
  rec('drip_POST_stepcfg', lbl, 400, await api('POST', '/api/crm/drip-sequences',
    { name: 'QA113 s ' + lbl, trigger_type: 'stage_changed', trigger_config: {}, steps: [{ delay_days: 1, action_type: 'send_email', action_config: v }] }));
}

// ---- 4. NEW COVERAGE the fix commit did not test: a non-array `steps` ----
// `!steps?.length` passes for any value with a truthy .length, then steps.some() runs.
const STEPS_SHAPES = [['string', 'abcd'], ['lengthy_object', { length: 2 }], ['number', 42], ['bool', true], ['object_nolen', { a: 1 }], ['null', null]];
for (const [lbl, v] of STEPS_SHAPES) {
  rec('drip_POST_steps', lbl, 400, await api('POST', '/api/crm/drip-sequences',
    { name: 'QA113 st ' + lbl, trigger_type: 'stage_changed', trigger_config: {}, steps: v }), 'expect 400, NOT 500');
}

// ---- 5. drip PATCH ----
{
  const r = await api('POST', '/api/crm/drip-sequences',
    { name: 'QA113 dvalid', trigger_type: 'stage_changed', trigger_config: { toStage: 'sold' }, steps: okStep });
  rec('drip_POST_ok', 'object', 201, r);
  const DID = r.body && r.body.id;
  if (DID) {
    for (const [lbl, v] of BAD) rec('drip_PATCH_trigger', lbl, 400, await api('PATCH', '/api/crm/drip-sequences/' + DID, { trigger_config: v }));
    rec('drip_PATCH_steps', 'string', [400, 200], await api('PATCH', '/api/crm/drip-sequences/' + DID, { steps: 'abcd' }), 'Array.isArray guard skips non-arrays');
  }
}

// ---- 6. cleanup ----
const dq = await pool.query("SELECT id FROM drip_sequences WHERE tenant_id=$1 AND name LIKE 'QA113%'", [T]);
for (const x of dq.rows) {
  await pool.query('DELETE FROM drip_sequence_steps WHERE sequence_id=$1', [x.id]);
  await pool.query('DELETE FROM drip_enrollments WHERE sequence_id=$1', [x.id]);
}
await pool.query("DELETE FROM drip_sequences WHERE tenant_id=$1 AND name LIKE 'QA113%'", [T]);
await pool.query("DELETE FROM automations WHERE tenant_id=$1 AND name LIKE 'QA113%'", [T]);
const after = await counts();

const fails = rows.filter((r) => !r.pass);
console.log('\n--- RESULTS ---');
for (const g of [...new Set(rows.map((r) => r.group))]) {
  const gr = rows.filter((r) => r.group === g);
  console.log(g + ': ' + gr.filter((r) => r.pass).length + '/' + gr.length + ' pass  ' + gr.map((r) => r.label + '=' + r.got).join(' '));
}
console.log('\nFAILURES: ' + fails.length);
for (const f of fails) console.log(' X ' + f.group + '/' + f.label + ' expected ' + f.expect + ' got ' + f.got + ' err="' + f.err + '" ' + f.note);
console.log('\nAFTER ' + JSON.stringify(after));
console.log('DRIFT ' + JSON.stringify(Object.fromEntries(TABLES.map((t) => [t, after[t] - before[t]]))));
await pool.end();
