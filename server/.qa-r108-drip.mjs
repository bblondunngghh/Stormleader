// Reproduce: drip_sequence_steps.action_config is free-form jsonb with no type guard,
// and dripService's replaceMergeFields calls .replaceAll() on cfg.subject / cfg.body.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };
const req = async (m, p, b) => {
  const r = await fetch(BASE + p, { method: m, headers: H, body: b === undefined ? undefined : JSON.stringify(b) });
  const t = await r.text();
  return { st: r.status, j: (() => { try { return JSON.parse(t); } catch { return null; } })(), t: t.slice(0, 160) };
};

// --- 1. is a non-string subject/body ACCEPTED by the write path? ---
console.log('--- write path ---');
const created = [];
for (const [lbl, v] of [['number', 42], ['bool', true], ['object', { a: 1 }], ['array', [1, 2]]]) {
  const r = await req('POST', '/api/crm/drip-sequences', {
    name: `QA-R108 ${lbl}`, trigger_type: 'lead_created', trigger_config: {},
    steps: [{ delay_days: 1, action_type: 'send_email', action_config: { subject: v, body: v } }],
  });
  if (r.j?.id) created.push(r.j.id);
  const stored = r.j?.steps?.[0]?.action_config;
  console.log(`  subject=${lbl.padEnd(6)} -> ${r.st}  stored=${JSON.stringify(stored)}`);
}

// --- 2. faithful replay of dripService.js:326-329 against those values ---
console.log('\n--- read path (verbatim replay of dripService.js:326-329) ---');
const mergeMap = { '{{first_name}}': 'A', '{{full_name}}': 'A B' };
const replaceMergeFields = (text) => {
  if (!text) return text;
  return Object.entries(mergeMap).reduce((t, [key, val]) => t.replaceAll(key, val), text);
};
for (const v of ['Hi {{first_name}}', '', null, undefined, 42, true, { a: 1 }, [1, 2], 0, false]) {
  let out;
  try { out = `OK -> ${JSON.stringify(replaceMergeFields(v))}`; }
  catch (e) { out = `*** THROWS *** ${e.constructor.name}: ${e.message}`; }
  console.log(`  ${JSON.stringify(v)}`.padEnd(22) + out);
}

// --- 3. cleanup ---
console.log('\n--- cleanup ---');
for (const id of created) console.log(`  DELETE ${id} -> ${(await req('DELETE', `/api/crm/drip-sequences/${id}`)).st}`);
const left = (await pool.query(`SELECT count(*)::int c FROM drip_sequences WHERE name LIKE 'QA-R108%'`)).rows[0].c;
const leftSteps = (await pool.query(
  `SELECT count(*)::int c FROM drip_sequence_steps s
   LEFT JOIN drip_sequences q ON q.id = s.sequence_id WHERE q.id IS NULL`)).rows[0].c;
console.log(`  leftover sequences: ${left} | orphan steps: ${leftSteps}`);
await pool.end();
