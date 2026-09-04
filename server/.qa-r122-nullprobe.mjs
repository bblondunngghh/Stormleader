// Run 122-s1 — empirical probe of the 23502 hypothesis, plus the fixture gaps.
// WRITE SAFETY: a NOT NULL violation aborts the whole UPDATE statement, so a
// `{field: null}` PATCH changes zero rows by construction. Each target row is
// snapshotted before/after anyway.
// Also: creates the ONE `tasks` fixture the charter asks for (tasks had 0 rows,
// leaving PATCH /crm/tasks/:id unexercisable), probes it, then DELETEs it by SQL
// (there is no DELETE route for tasks), and re-probes the GET routes that sweep 1
// could not resolve an id for.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const T = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const TENANT = '791bb51d-3293-4839-92e9-bd4d4f873af2';

const req = async (m, p, b) => {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(BASE + p, {
      method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T },
      body: b === undefined ? undefined : JSON.stringify(b), signal: ctl.signal,
    });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (_) {}
    return { st: r.status, body: t.slice(0, 200), json: j };
  } catch (e) { return { st: 0, body: 'ERR ' + e.name, json: null }; } finally { clearTimeout(to); }
};
const q = async (sql, p = []) => { try { return (await pool.query(sql, p)).rows; } catch (e) { return [{ __err: e.code + ' ' + e.message.slice(0, 70) }]; } };
const one = async (t, w = 'tenant_id = $1') => { const r = await q(`SELECT id FROM ${t} WHERE ${w} LIMIT 1`, w.includes('$1') ? [TENANT] : []); return r[0] && !r[0].__err ? r[0].id : null; };

// ---------- create the tasks fixture ----------
const mk = await req('POST', '/api/crm/tasks', { title: 'QA r122 fixture — delete me', priority: 'warm' });
console.log('POST /api/crm/tasks ->', mk.st, mk.body.slice(0, 120));
const taskId = mk.json && mk.json.id;
if (!taskId) { console.log('!! no task fixture; task probes will be skipped'); }

const ids = {
  task: taskId,
  expense: await one('expenses'),
  invoice: await one('invoices'),
  subcontractor: await one('subcontractors'),
  workOrder: await one('work_orders'),
  contractTemplate: await one('contract_templates', 'true'),
  territory: await one('canvass_territories'),
  estTemplate: await one('estimate_templates'),
  matOrder: await one('material_orders'),
  stormEvent: await one('storm_events', 'true'),
  milestone: await one('work_order_milestones', 'true'),
  lead: await one('leads'),
};

// ---------- P1: null on NOT NULL whitelisted columns ----------
const TARGETS = [
  { t: 'tasks', id: ids.task, url: id => `/api/crm/tasks/${id}`, fields: ['title', 'status'] },
  { t: 'expenses', id: ids.expense, url: id => `/api/crm/expenses/${id}`, fields: ['category', 'amount', 'date'] },
  { t: 'invoices', id: ids.invoice, url: id => `/api/crm/invoices/${id}`, fields: ['line_items', 'subtotal', 'total'] },
  { t: 'subcontractors', id: ids.subcontractor, url: id => `/api/crm/subcontractors/${id}`, fields: ['name', 'specialty', 'status'] },
  { t: 'work_orders', id: ids.workOrder, url: id => `/api/crm/work-orders/${id}`, fields: ['title'] },
  { t: 'contract_templates', id: ids.contractTemplate, url: id => `/api/crm/contracts/templates/${id}`, fields: ['name', 'type'] },
];

const results = [];
for (const tgt of TARGETS) {
  if (!tgt.id) { results.push({ table: tgt.t, field: '*', st: 'NO_FIXTURE' }); continue; }
  const cols = tgt.fields.join(', ');
  const rowBefore = (await q(`SELECT ${cols}, updated_at FROM ${tgt.t} WHERE id = $1`, [tgt.id]))[0];
  for (const f of tgt.fields) {
    const res = await req('PATCH', tgt.url(tgt.id), { [f]: null });
    const rowAfter = (await q(`SELECT ${cols}, updated_at FROM ${tgt.t} WHERE id = $1`, [tgt.id]))[0];
    const moved = JSON.stringify(rowBefore) !== JSON.stringify(rowAfter);
    results.push({ table: tgt.t, field: f, st: res.st, moved, body: res.body.slice(0, 130) });
    if (moved) console.log('  !! ROW MOVED', tgt.t, f, JSON.stringify(rowBefore), '->', JSON.stringify(rowAfter));
  }
}

console.log('\n=== null -> NOT NULL whitelisted column ===');
const h = {}; results.forEach(r => h[r.st] = (h[r.st] || 0) + 1);
console.log('status histogram:', JSON.stringify(h));
results.forEach(r => console.log(`  ${String(r.st).padStart(4)}  ${r.table}.${r.field}${r.moved ? '  ROW MOVED!' : ''}  ${r.body || ''}`));

// ---------- P2: the GET routes sweep 1 had no fixture for ----------
const GETS = [
  ['/api/crm/tasks (list)', '/api/crm/tasks'],
  ['/api/crm/territories/:id', `/api/crm/territories/${ids.territory}`],
  ['/api/crm/territories/:id/pins', `/api/crm/territories/${ids.territory}/pins`],
  ['/api/estimates/templates/:id', `/api/estimates/templates/${ids.estTemplate}`],
  ['/api/materials/orders/:id', `/api/materials/orders/${ids.matOrder}`],
  ['/api/crm/contracts/templates/:id', `/api/crm/contracts/templates/${ids.contractTemplate}`],
  ['/api/drift/:stormEventId', `/api/drift/${ids.stormEvent}`],
  ['/api/properties/in-swath/:stormEventId', `/api/properties/in-swath/${ids.stormEvent}`],
  ['/api/properties/in-swath/:id/count', `/api/properties/in-swath/${ids.stormEvent}/count`],
  ['/api/crm/work-orders/:id/milestones', `/api/crm/work-orders/${ids.workOrder}/milestones`],
  ['/api/crm/leads/:id (detail)', `/api/crm/leads/${ids.lead}`],
];
console.log('\n=== GET routes that had no fixture in sweep 1 ===');
const getRes = [];
for (const [label, url] of GETS) {
  if (/\/(null|undefined)(\/|$)/.test(url)) { console.log('  NO_FIXTURE', label); getRes.push({ label, st: 'NO_FIXTURE' }); continue; }
  const r = await req('GET', url);
  getRes.push({ label, url, st: r.st, body: r.st >= 400 ? r.body : '' });
  console.log(`  ${String(r.st).padStart(4)}  ${label}  ${r.st >= 400 ? '| ' + r.body.slice(0, 110) : ''}`);
}

// ---------- P3: exercise the task fixture properly, then remove it ----------
console.log('\n=== tasks fixture round-trip ===');
if (taskId) {
  const probes = [
    ['valid patch', { description: 'qa r122' }],
    ['bad priority', { priority: 'urgent' }],
    ['priority wrong type', { priority: 42 }],
    ['due_date bad', { due_date: 'not-a-date' }],
    ['assigned_to bad uuid', { assigned_to: 'abc' }],
    ['completed true', { completed: true }],
    ['completed false', { completed: false }],
    ['unknown field only', { bogus_field: 1 }],
    ['empty body', {}],
  ];
  for (const [label, body] of probes) {
    const r = await req('PATCH', `/api/crm/tasks/${taskId}`, body);
    console.log(`  ${String(r.st).padStart(4)}  ${label.padEnd(22)} ${r.body.slice(0, 110)}`);
  }
  const del = await q('DELETE FROM tasks WHERE id = $1 AND tenant_id = $2', [taskId, TENANT]);
  const left = await q('SELECT count(*)::int c FROM tasks');
  console.log('  fixture deleted; tasks rows now =', left[0].c, '(was 0 before this run)');
}
fs.writeFileSync('C:/tmp/qa-r122-nullprobe.json', JSON.stringify({ ids, results, getRes }, null, 1));
await pool.end();
