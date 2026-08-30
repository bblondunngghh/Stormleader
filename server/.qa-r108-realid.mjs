// Exercise the detail routes that have NEVER been hit with a real id, because the
// waterloo tenant holds zero rows for those entities. Create ONE fixture per entity,
// drive every route that takes its id, then DELETE it. Net writes: 0.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };
const req = async (m, p, b) => {
  const r = await fetch(BASE + p, { method: m, headers: H, body: b === undefined ? undefined : JSON.stringify(b) });
  const t = await r.text();
  return { st: r.status, t: t.slice(0, 150).replace(/\s+/g, ' '), j: (() => { try { return JSON.parse(t); } catch { return null; } })() };
};
const log = [];
const rec = (m, p, r, note = '') => { log.push({ m, p, st: r.st, note, body: r.t }); console.log(`${String(r.st).padEnd(4)} ${m.padEnd(6)} ${p} ${note} ${r.st >= 500 ? '*** 5xx *** ' + r.t : ''}`); };

// ---- storm event (read-only, already exists) ----
const se = (await pool.query(`SELECT id FROM storm_events LIMIT 1`)).rows[0]?.id;
console.log('storm_event fixture:', se);
if (se) {
  for (const p of [`/api/storms/${se}`, `/api/drift/${se}`]) rec('GET', p, await req('GET', p));
}

// ---- automations: create -> GET/PATCH/toggle -> DELETE ----
console.log('\n--- automations ---');
const aC = await req('POST', '/api/crm/automations', {
  name: 'QA-R108 probe', trigger_type: 'lead_created',
  trigger_config: { source: 'qa' }, action_type: 'create_task',
  action_config: { title: 'QA-R108 task', priority: 'medium' },
});
rec('POST', '/api/crm/automations', aC, 'create');
const aId = aC.j?.id;
if (aId) {
  rec('GET', '/api/crm/automations', await req('GET', '/api/crm/automations'), 'list');
  rec('PATCH', `/api/crm/automations/${aId}`, await req('PATCH', `/api/crm/automations/${aId}`, { name: 'QA-R108 renamed' }), 'valid patch');
  rec('PATCH', `/api/crm/automations/${aId}/toggle`, await req('PATCH', `/api/crm/automations/${aId}/toggle`, {}), 'toggle');
  // type-confusion probes on the two jsonb columns
  for (const [lbl, v] of [['string', 'oops'], ['number', 42], ['bool', true], ['array', [1, 2]], ['null', null]]) {
    rec('PATCH', `/api/crm/automations/${aId}`, await req('PATCH', `/api/crm/automations/${aId}`, { trigger_config: v }), `trigger_config=${lbl}`);
    rec('PATCH', `/api/crm/automations/${aId}`, await req('PATCH', `/api/crm/automations/${aId}`, { action_config: v }), `action_config=${lbl}`);
  }
  rec('GET', `/api/crm/automations`, await req('GET', '/api/crm/automations'), 'consumer read after junk');
  rec('DELETE', `/api/crm/automations/${aId}`, await req('DELETE', `/api/crm/automations/${aId}`), 'cleanup');
}

// ---- drip sequences: create -> GET/PATCH -> DELETE ----
console.log('\n--- drip-sequences ---');
const dC = await req('POST', '/api/crm/drip-sequences', {
  name: 'QA-R108 probe', trigger_type: 'lead_created', trigger_config: { source: 'qa' },
  steps: [{ delay_days: 1, action_type: 'create_task', action_config: { title: 'QA-R108 step', priority: 'medium' } }],
});
rec('POST', '/api/crm/drip-sequences', dC, 'create');
const dId = dC.j?.id;
if (dId) {
  rec('GET', `/api/crm/drip-sequences/${dId}`, await req('GET', `/api/crm/drip-sequences/${dId}`), 'detail');
  rec('PATCH', `/api/crm/drip-sequences/${dId}`, await req('PATCH', `/api/crm/drip-sequences/${dId}`, { name: 'QA-R108 renamed' }), 'valid patch');
  rec('DELETE', `/api/crm/drip-sequences/${dId}`, await req('DELETE', `/api/crm/drip-sequences/${dId}`), 'cleanup');
}

// ---- leftovers check ----
for (const [t, col] of [['automations', 'name'], ['drip_sequences', 'name'], ['tasks', 'title']]) {
  const n = (await pool.query(`SELECT count(*)::int c FROM ${t} WHERE ${col} LIKE 'QA-R108%'`)).rows[0].c;
  console.log(`leftover ${t}: ${n}`);
}
fs.writeFileSync('C:/tmp/qa-r108-realid.json', JSON.stringify(log, null, 1));
console.log(`\n${log.length} requests | 5xx: ${log.filter(r => r.st >= 500).length}`);
await pool.end();
