// Run 75 s1 — REAL-ID GET sweep (P3 + P4).
// Run 74 lesson: a dead-uuid sweep 404s BEFORE handler logic and is structurally
// incapable of finding stored-shape crashes. This resolves a REAL id for every
// :param from the live DB, so handler bodies actually execute.
//
// STRUCTURALLY UNABLE TO FIND: races, browser-only flows, shapes this tenant lacks,
// anything behind a paid key.
import fs from 'fs';
import pool from './src/db/pool.js';
import { req, summarize } from './.qa-r73-lib.mjs';

const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

// ---- resolve real ids (each wrapped: a missing table must not abort the sweep) ----
const one = async (sql, args = [T]) => {
  try {
    const { rows } = await pool.query(sql, args);
    return rows[0] ? Object.values(rows[0])[0] : null;
  } catch (e) {
    console.log('  resolver miss:', e.message.slice(0, 80));
    return null;
  }
};

const ids = {};
ids.lead = await one(`SELECT id FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL LIMIT 1`);
ids.estimate = await one(`SELECT id FROM estimates WHERE tenant_id=$1 LIMIT 1`);
ids.invoice = await one(`SELECT id FROM invoices WHERE tenant_id=$1 LIMIT 1`);
ids.workOrder = await one(`SELECT id FROM work_orders WHERE tenant_id=$1 LIMIT 1`);
ids.contract = await one(`SELECT id FROM contracts WHERE tenant_id=$1 LIMIT 1`);
ids.task = await one(`SELECT id FROM tasks WHERE tenant_id=$1 LIMIT 1`);
ids.expense = await one(`SELECT id FROM expenses WHERE tenant_id=$1 LIMIT 1`);
ids.subcontractor = await one(`SELECT id FROM subcontractors WHERE tenant_id=$1 LIMIT 1`);
ids.user = await one(`SELECT id FROM users WHERE tenant_id=$1 LIMIT 1`);
ids.property = await one(`SELECT id FROM properties LIMIT 1`, []);
ids.milestone = await one(`SELECT id FROM work_order_milestones LIMIT 1`, []);
ids.contact = await one(`SELECT id FROM contacts WHERE tenant_id=$1 LIMIT 1`);
ids.material = await one(`SELECT id FROM materials WHERE tenant_id=$1 LIMIT 1`);
ids.stormEvent = await one(`SELECT id FROM storm_events LIMIT 1`, []);
ids.job = ids.workOrder;
console.log('RESOLVED IDS:');
for (const [k, v] of Object.entries(ids)) console.log(' ', k.padEnd(15), v || 'NONE');

// ---- fill a path's params with real ids, chosen by param name then route prefix ----
function fill(path) {
  let p = path;
  const pick = (name) => {
    if (name === 'leadId') return ids.lead;
    if (name === 'estimateId') return ids.estimate;
    if (name === 'workOrderId' || name === 'woId' || name === 'jobId') return ids.workOrder;
    if (name === 'milestoneId') return ids.milestone;
    if (name === 'subcontractorId') return ids.subcontractor;
    if (name === 'propertyId') return ids.property;
    if (name === 'stormEventId') return ids.stormEvent;
    if (name === 'contactId') return ids.contact;
    if (name === 'userId') return ids.user;
    if (name === 'token') return 'qa-not-a-real-token';
    // bare :id — decide from the route prefix
    if (path.includes('/leads')) return ids.lead;
    if (path.includes('/estimates')) return ids.estimate;
    if (path.includes('/invoices')) return ids.invoice;
    if (path.includes('/work-orders')) return ids.workOrder;
    if (path.includes('/contracts')) return ids.contract;
    if (path.includes('/tasks')) return ids.task;
    if (path.includes('/expenses')) return ids.expense;
    if (path.includes('/subcontractors')) return ids.subcontractor;
    if (path.includes('/materials')) return ids.material;
    if (path.includes('/properties')) return ids.property;
    if (path.includes('/users')) return ids.user;
    if (path.includes('/contacts')) return ids.contact;
    return null;
  };
  const names = (path.match(/:[A-Za-z_]+/g) || []).map((s) => s.slice(1));
  let unresolved = [];
  for (const n of names) {
    const v = pick(n);
    if (!v) unresolved.push(n);
    p = p.replace(':' + n, v || '00000000-0000-0000-0000-000000000000');
  }
  return { path: p, unresolved };
}

// GETs only in this pass — read paths execute the most handler logic per request
// and cannot mutate the Neon free-tier DB.
const gets = inv.filter((r) => r.method === 'GET');
const results = [];
let n5xx = 0;

for (const r of gets) {
  const { path, unresolved } = fill(r.path);
  // never trigger a real bulk import (Run 74 trap: hyphen, not slash)
  if (/import/i.test(path)) { results.push({ ...r, status: 'SKIP', note: 'import guard' }); continue; }
  const out = await req('GET', path);
  const rec = {
    file: r.file, method: r.method, route: r.path, actual: path,
    status: out.status, ms: out.ms,
    shape: summarize(out.body),
    unresolved: unresolved.join(',') || '',
  };
  if (out.status >= 500 || out.status === 0) {
    n5xx++;
    rec.ERROR = typeof out.body === 'object' ? JSON.stringify(out.body).slice(0, 400) : String(out.body).slice(0, 400);
    console.log(`*** ${out.status} ${r.method} ${path}\n    ${rec.ERROR}`);
  }
  results.push(rec);
}

fs.writeFileSync('C:/tmp/realid-gets.json', JSON.stringify(results, null, 1));

const tally = {};
results.forEach((r) => { tally[r.status] = (tally[r.status] || 0) + 1; });
console.log('\nSTATUS TALLY:', JSON.stringify(tally));
console.log('5xx COUNT:', n5xx, '/', results.length);
console.log('\nNON-2xx (excluding known-intentional):');
results.filter((r) => typeof r.status === 'number' && (r.status < 200 || r.status >= 300))
  .forEach((r) => console.log(`  ${r.status} ${r.route}  [${r.file}] ${r.unresolved ? 'UNRESOLVED:' + r.unresolved : ''}`));
await pool.end();
