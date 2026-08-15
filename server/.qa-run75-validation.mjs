// Run 75 s1 — VALIDATION sweep over every write route.
// Charter: "missing required fields should return 400, not crash."
// Improvement over Runs 70/73: POST/PATCH/PUT use a REAL id, so the handler runs
// past the id lookup instead of 404ing before any logic. DELETE uses a dead uuid
// on purpose — a real id would destroy live data.
//
// STRUCTURALLY UNABLE TO FIND: bugs needing a WELL-FORMED body (this sends {} and
// junk), races, multi-tenant leaks, browser-only flows, paid-key paths.
import fs from 'fs';
import pool from './src/db/pool.js';
import { req, summarize } from './.qa-r73-lib.mjs';

const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const DEAD = '00000000-0000-0000-0000-000000000000';
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

// Routes that cost money, start bulk jobs, or send outbound mail — never probe.
const FORBIDDEN = /import|trigger-import|skip-trace|geocode|send-email|\/sync/i;

const one = async (sql, a = [T]) => { try { const { rows } = await pool.query(sql, a); return rows[0] ? Object.values(rows[0])[0] : null; } catch { return null; } };
const ids = {
  lead: await one(`SELECT id FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL LIMIT 1`),
  estimate: await one(`SELECT id FROM estimates WHERE tenant_id=$1 LIMIT 1`),
  invoice: await one(`SELECT id FROM invoices WHERE tenant_id=$1 LIMIT 1`),
  workOrder: await one(`SELECT id FROM work_orders WHERE tenant_id=$1 LIMIT 1`),
  contract: await one(`SELECT id FROM contracts WHERE tenant_id=$1 AND status='draft' LIMIT 1`),
  task: await one(`SELECT id FROM tasks WHERE tenant_id=$1 LIMIT 1`),
  expense: await one(`SELECT id FROM expenses WHERE tenant_id=$1 LIMIT 1`),
  sub: await one(`SELECT id FROM subcontractors WHERE tenant_id=$1 LIMIT 1`),
  user: await one(`SELECT id FROM users WHERE tenant_id=$1 LIMIT 1`),
  property: await one(`SELECT id FROM properties LIMIT 1`, []),
  milestone: await one(`SELECT id FROM work_order_milestones LIMIT 1`, []),
  contact: await one(`SELECT id FROM contacts WHERE tenant_id=$1 LIMIT 1`),
  pin: await one(`SELECT id FROM canvass_pins WHERE tenant_id=$1 LIMIT 1`),
  storm: await one(`SELECT id FROM storm_events LIMIT 1`, []),
  county: await one(`SELECT id FROM county_data_sources LIMIT 1`, []),
  notification: await one(`SELECT id FROM notifications WHERE tenant_id=$1 LIMIT 1`),
};

function fill(path, useReal) {
  if (!useReal) return path.replace(/:[A-Za-z_]+/g, DEAD);
  let p = path;
  for (const raw of path.match(/:[A-Za-z_]+/g) || []) {
    const n = raw.slice(1);
    let v = null;
    if (n === 'leadId') v = ids.lead;
    else if (n === 'estimateId') v = ids.estimate;
    else if (n === 'workOrderId' || n === 'woId' || n === 'jobId') v = ids.workOrder;
    else if (n === 'milestoneId') v = ids.milestone;
    else if (n === 'subcontractorId') v = ids.sub;
    else if (n === 'propertyId') v = ids.property;
    else if (n === 'stormEventId') v = ids.storm;
    else if (n === 'contactId') v = ids.contact;
    else if (n === 'userId') v = ids.user;
    else if (n === 'token') v = 'qa-dead-token';
    else if (path.includes('/leads')) v = ids.lead;
    else if (path.includes('/estimates')) v = ids.estimate;
    else if (path.includes('/invoices')) v = ids.invoice;
    else if (path.includes('/work-orders')) v = ids.workOrder;
    else if (path.includes('/contracts')) v = ids.contract;
    else if (path.includes('/tasks')) v = ids.task;
    else if (path.includes('/expenses')) v = ids.expense;
    else if (path.includes('/subcontractors')) v = ids.sub;
    else if (path.includes('/notifications')) v = ids.notification;
    else if (path.includes('/canvass-pins')) v = ids.pin;
    else if (path.includes('/counties')) v = ids.county;
    else if (path.includes('/properties')) v = ids.property;
    p = p.replace(raw, v || DEAD);
  }
  return p;
}

// three hostile bodies per route
const BODIES = [{}, { name: null, id: null }, { name: { deep: [1, null] }, amount: 'not-a-number' }];

const rows = [];
let n5xx = 0;
for (const r of inv) {
  if (r.method === 'GET') continue;
  if (FORBIDDEN.test(r.path)) { rows.push({ ...r, status: 'SKIP', note: 'forbidden (cost/mail/bulk)' }); continue; }
  // DELETE gets a dead uuid so it cannot destroy live data
  const useReal = r.method !== 'DELETE';
  const path = fill(r.path, useReal);
  for (const body of BODIES) {
    const out = await req(r.method, path, body);
    const bad = out.status >= 500 || out.status === 0;
    if (bad) {
      n5xx++;
      console.log(`*** ${out.status} ${r.method} ${r.path}\n    body=${JSON.stringify(body)}\n    ${JSON.stringify(out.body).slice(0, 300)}`);
    }
    rows.push({ file: r.file, method: r.method, route: r.path, status: out.status, body: JSON.stringify(body).slice(0, 40), resp: summarize(out.body).slice(0, 60) });
  }
}

fs.writeFileSync('C:/tmp/validation-sweep.json', JSON.stringify(rows, null, 1));
const tally = rows.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
console.log('\nVALIDATION SWEEP:', rows.length, 'requests over', new Set(rows.map((r) => r.route)).size, 'routes');
console.log('TALLY:', JSON.stringify(tally));
console.log('5xx:', n5xx);
await pool.end();
