// Resolve REAL ids for the routes the Run 100 fixture set could not reach, then re-hit
// them. A dead-uuid 404 proves nothing about handler logic (Run 74 lesson).
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const T = (await pool.query(`SELECT id FROM tenants WHERE slug='waterloo'`)).rows[0].id;

const LOOKUPS = [
  ['dripSequence',  `SELECT id FROM drip_sequences WHERE tenant_id=$1 LIMIT 1`],
  ['financingApp',  `SELECT id FROM financing_applications WHERE tenant_id=$1 LIMIT 1`],
  ['prospectList',  `SELECT id FROM prospect_lists WHERE tenant_id=$1 LIMIT 1`],
  ['skipTraceJob',  `SELECT id FROM skip_trace_jobs WHERE tenant_id=$1 LIMIT 1`],
  ['stormEvent',    `SELECT id FROM storm_events LIMIT 1`],
  ['materialOrder', `SELECT id FROM material_orders WHERE tenant_id=$1 LIMIT 1`],
  ['automation',    `SELECT id FROM automations WHERE tenant_id=$1 LIMIT 1`],
  ['document',      `SELECT id FROM documents WHERE tenant_id=$1 LIMIT 1`],
  ['contentLib',    `SELECT id FROM content_library WHERE tenant_id=$1 LIMIT 1`],
];
const ids = {};
for (const [k, q] of LOOKUPS) {
  try { ids[k] = (await pool.query(q, [T])).rows[0]?.id ?? null; }
  catch (e) { ids[k] = `_ERR_${e.code}`; }
}
console.log('resolved:', JSON.stringify(ids, null, 1));

const TARGETS = [
  ['GET', '/api/crm/drip-sequences/{dripSequence}'],
  ['GET', '/api/crm/financing/applications/{financingApp}'],
  ['GET', '/api/crm/prospect-lists/{prospectList}/items'],
  ['GET', '/api/skip-trace/job/{skipTraceJob}'],
  ['GET', '/api/drift/{stormEvent}'],
  ['GET', '/api/storms/{stormEvent}'],
  ['GET', '/api/materials/orders/{materialOrder}'],
  ['GET', '/api/crm/automations'],
  ['GET', '/api/documents/{document}'],
];
const out = [];
for (const [m, tpl] of TARGETS) {
  const key = tpl.match(/\{(\w+)\}/)?.[1];
  if (key && (!ids[key] || String(ids[key]).startsWith('_ERR'))) {
    out.push([m, tpl, `SKIP no fixture (${ids[key]})`]); continue;
  }
  const url = tpl.replace(/\{(\w+)\}/, (_, k) => ids[k]);
  const r = await fetch(BASE + url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const body = (await r.text()).slice(0, 110).replace(/\s+/g, ' ');
  out.push([m, url, `${r.status} ${body}`]);
}
for (const [m, u, s] of out) console.log(`${m} ${u}\n    -> ${s}`);
fs.writeFileSync('C:/tmp/qa-r108-fixtures.json', JSON.stringify({ ids, out }, null, 1));
await pool.end();
