// Phase 1 evidence: is the pagination overlap REPRODUCIBLE, and is it caused by
// rows TIED on a non-unique ORDER BY key?
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { Authorization: `Bearer ${TOKEN}` };
const get = async p => (await fetch(BASE + p, { headers: H })).json();

const TENANT = (await pool.query(
  `SELECT id FROM tenants WHERE slug = 'waterloo'`)).rows[0].id;
console.log('tenant', TENANT);

// ---------- 1. Are the sort keys actually tied? ----------
console.log('\n=== SUBCONTRACTORS: duplicate names (ORDER BY name ASC has no tiebreaker) ===');
const dupNames = await pool.query(
  `SELECT name, COUNT(*) n, array_agg(id::text ORDER BY id) ids
     FROM subcontractors WHERE tenant_id = $1
    GROUP BY name HAVING COUNT(*) > 1 ORDER BY n DESC`, [TENANT]);
console.log('rows total:', (await pool.query(
  `SELECT COUNT(*) c FROM subcontractors WHERE tenant_id=$1`, [TENANT])).rows[0].c);
console.log('duplicate-name groups:', dupNames.rowCount);
for (const r of dupNames.rows.slice(0, 10)) console.log(`  "${r.name}" x${r.n}`);

console.log('\n=== TASKS: ties on (completed_at, due_date) ===');
const taskTies = await pool.query(
  `SELECT completed_at, due_date, COUNT(*) n
     FROM tasks WHERE tenant_id = $1
    GROUP BY completed_at, due_date HAVING COUNT(*) > 1 ORDER BY n DESC`, [TENANT]);
console.log('rows total:', (await pool.query(
  `SELECT COUNT(*) c FROM tasks WHERE tenant_id=$1`, [TENANT])).rows[0].c);
console.log('tie groups:', taskTies.rowCount);
for (const r of taskTies.rows.slice(0, 10))
  console.log(`  completed_at=${r.completed_at} due_date=${r.due_date} -> x${r.n}`);

// ---------- 2. Is the API-level defect reproducible? ----------
// The real user harm: page through the WHOLE list and see whether every row appears
// exactly once. A missing row is a row the user can never reach.
async function walk(path, key, pageSize, total) {
  const seen = [];
  for (let off = 0; off < total; off += pageSize) {
    const r = await get(`${path}?limit=${pageSize}&offset=${off}`);
    for (const row of (r[key] || [])) seen.push(row.id);
  }
  const uniq = new Set(seen);
  return { fetched: seen.length, distinct: uniq.size,
           dupes: seen.length - uniq.size, ids: uniq };
}

for (const [path, key, table] of [
  ['/api/crm/subcontractors', 'subcontractors', 'subcontractors'],
  ['/api/crm/tasks', 'tasks', 'tasks'],
]) {
  const truth = await pool.query(
    `SELECT id::text FROM ${table} WHERE tenant_id=$1`, [TENANT]);
  const truthIds = new Set(truth.rows.map(r => r.id));
  console.log(`\n=== ${path} — walk the whole list in pages of 10 (DB truth: ${truthIds.size} rows) ===`);
  for (const trial of [1, 2, 3]) {
    const w = await walk(path, key, 10, truthIds.size + 10);
    const never = [...truthIds].filter(id => !w.ids.has(id));
    console.log(`  trial ${trial}: fetched=${w.fetched} distinct=${w.distinct} ` +
                `duplicatesAcrossPages=${w.dupes} ROWS_NEVER_SHOWN=${never.length}`);
    if (never.length) console.log('     unreachable ids:', never.slice(0, 5));
  }
}

await pool.end();
