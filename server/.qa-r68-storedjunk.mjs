// Triage of Run 66 Axis D pass 2: when a write route ACCEPTS a wrong-typed value (201),
// what actually LANDS IN THE COLUMN? Status 201 is not evidence the data is usable.
// Writes exactly one probe row per route, reads it back, then DELETES it. Net writes 0.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const TENANT = (await pool.query(`SELECT id FROM tenants WHERE slug='waterloo'`)).rows[0].id;

async function post(path, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { j = t.slice(0, 120); }
  return { status: r.status, body: j };
}

// route, required field, table, column, extra body needed to satisfy other validators
const CASES = [
  ['/api/crm/tasks',            'title', 'tasks',              'title', {}],
  ['/api/crm/work-orders',      'title', 'work_orders',        'title', {}],
  ['/api/estimates/templates',  'name',  'estimate_templates', 'name',  {}],
  ['/api/crm/subcontractors',   'name',  'subcontractors',     'name',  {}],
];
const SHAPES = [['array', [1, 2, 3]], ['object', { $eq: 1 }], ['number', 12345], ['boolean', true]];

const created = [];
console.log('route                        | shape   | HTTP | STORED VALUE IN COLUMN         | typeof col');
console.log('-----------------------------+---------+------+--------------------------------+-----------');
for (const [path, field, table, col, extra] of CASES) {
  for (const [shapeName, val] of SHAPES) {
    const res = await post(path, { ...extra, [field]: val });
    let stored = '(not created)';
    if (res.status === 201 && res.body && res.body.id) {
      created.push([table, res.body.id]);
      const q = await pool.query(`SELECT ${col} AS v, pg_typeof(${col}) AS t FROM ${table} WHERE id=$1`,
                                 [res.body.id]);
      stored = q.rows.length ? JSON.stringify(q.rows[0].v) : '(row missing)';
      var ptype = q.rows.length ? q.rows[0].t : '?';
    }
    console.log(`${path.padEnd(28)} | ${shapeName.padEnd(7)} | ${String(res.status).padStart(4)} | ` +
                `${String(stored).slice(0, 30).padEnd(30)} | ${ptype || ''}`);
  }
}

// ---- Does the garbage survive a READ BACK through the API? ----
console.log('\n=== read-back through the API (is the junk user-visible?) ===');
const back = await (await fetch(BASE + '/api/crm/tasks?limit=200', { headers: H })).json();
const junk = (back.tasks || []).filter(t =>
  ['12345', 'true', '{"1","2","3"}', '{1,2,3}', '{"$eq":1}'].includes(String(t.title)));
console.log(`GET /api/crm/tasks returns ${junk.length} task(s) whose title is stored garbage:`);
for (const t of junk.slice(0, 6)) console.log(`   title=${JSON.stringify(t.title)}  id=${t.id}`);

// ---- CLEANUP: remove every probe row this script created. Net DB writes must be 0. ----
console.log('\n=== cleanup ===');
let del = 0;
for (const [table, id] of created) {
  const r = await pool.query(`DELETE FROM ${table} WHERE id=$1 AND tenant_id=$2`, [id, TENANT]);
  del += r.rowCount;
}
console.log(`probe rows created: ${created.length}, deleted: ${del}`);
fs.writeFileSync('C:/tmp/qa-r68-storedjunk.json', JSON.stringify({ created: created.length, deleted: del }, null, 1));
await pool.end();
