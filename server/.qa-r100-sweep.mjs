// Run 100 (s1-api-test) — CONSOLIDATED SWEEP. Recovers the coverage Run 99 lost to max_turns.
// Phases: A GET(real ids) | B POST/DELETE(dead id, empty body) | C PATCH/PUT(dead id)
//         D PATCH/PUT(REAL id, empty body) | E PATCH/PUT(REAL id, unknown field only)
// D and E are ZERO-WRITE BY CONSTRUCTION: neither body carries a whitelisted field, so a
// correct handler 400s before building any SET clause. A 500 here IS the defect.
// EXCLUSIONS are safety-critical: /import/i (trigger-import = real bulk import, hyphen not
// slash), geocode (costs money), send/email/sms/webhook (outbound), auth state changes.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const I = JSON.parse(fs.readFileSync('C:/tmp/qa-r85-ids.json', 'utf8'));
const DEAD = '00000000-0000-4000-8000-000000000000';
const SKIP = /import|geocode|\/send|email|\/sms|webhook|skip-trace\/(run|start)|logout|login|register|refresh|score-all|correct-all|mark-all-read|\/complete|alerts\/test/i;

const byPath = [[/\/leads\//,'lead'],[/\/estimates\//,'estimate'],[/\/invoices\//,'invoice'],
  [/\/contracts\//,'contract'],[/\/work-orders\//,'workOrder'],[/\/expenses\//,'expense'],
  [/\/subcontractors\//,'subcontractor'],[/\/canvass-pins\//,'canvassPin'],
  [/\/territories\//,'territory'],[/\/team\//,'user'],[/\/properties\//,'property'],
  [/\/material-orders\//,'materialOrder'],[/\/storm-events\//,'stormEvent'],
  [/\/tasks\//,'task'],[/\/documents\//,'document'],[/\/contacts\//,'contact'],
  [/\/drip-sequences\//,'dripSequence'],[/\/automations\//,'automation'],
  [/\/notifications\//,'notification'],[/\/custom-fields\//,'customField'],
  [/\/financing\/plans\//,'financingPlan'],[/\/financing\/lenders\//,'financingLender'],
  [/\/financing\/applications\//,'financingApp'],[/\/payments\//,'payment'],
  [/\/alert-configs\//,'alertConfig'],[/\/tenants\//,'tenantId']];

function resolve(path, dead) {
  let p = path;
  for (const m of [...path.matchAll(/:(\w+)/g)].map(x => x[1])) {
    let v = DEAD;
    if (!dead) {
      if (/^contractToken$/i.test(m)) v = I.contractToken || DEAD;
      else if (/token/i.test(m)) v = I.estimateToken || DEAD;
      else if (/^(userId|memberId)$/.test(m)) v = I.user || DEAD;
      else if (/^leadId$/.test(m)) v = I.lead || DEAD;
      else if (/^(woId|workOrderId)$/.test(m)) v = I.workOrder || DEAD;
      else { for (const [re, k] of byPath) { if (re.test(path) && I[k]) { v = I[k]; break; } } }
    }
    p = p.replace(':' + m, v);
  }
  return p;
}

// Run 112: a row-count snapshot CANNOT see an UPDATE (the Run 100 lesson). Also snapshot
// max(updated_at) per table so a mutation with no row-count change is still visible.
const snapAll = async () => {
  const r = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
  const withUpd = new Set((await pool.query("SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='updated_at'")).rows.map(x => x.table_name));
  const c = {};
  for (const { tablename } of r) {
    try { c[tablename] = (await pool.query(`SELECT count(*)::int n FROM "${tablename}"`)).rows[0].n; } catch {}
    if (withUpd.has(tablename)) {
      try { c[tablename + '#upd'] = String((await pool.query(`SELECT max(updated_at) m FROM "${tablename}"`)).rows[0].m); } catch {}
    }
  }
  return c;
};

async function hit(method, path, dead, body) {
  const url = resolve(path, dead);
  try {
    const res = await fetch(BASE + url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { st: res.status, url, body: (await res.text()).slice(0, 300) };
  } catch (e) { return { st: 'THREW', url, body: String(e).slice(0, 250) }; }
}

const phases = [
  { id: 'A', label: 'GET  real ids',                 methods: ['GET'],           dead: false, body: undefined },
  { id: 'B', label: 'POST/DELETE dead id empty body', methods: ['POST','DELETE'], dead: true,  body: {} },
  { id: 'C', label: 'PATCH/PUT dead id empty body',   methods: ['PATCH','PUT'],   dead: true,  body: {} },
  { id: 'D', label: 'PATCH/PUT REAL id empty body',   methods: ['PATCH','PUT'],   dead: false, body: {} },
  { id: 'E', label: 'PATCH/PUT REAL id unknown field',methods: ['PATCH','PUT'],   dead: false, body: { __qa_r100_unknown__: 1 } },
];

const before = await snapAll();
const all = [], defects = [];
for (const ph of phases) {
  const targets = inv.filter(r => ph.methods.includes(r.method));
  const run = targets.filter(r => !SKIP.test(r.path));
  const skipped = targets.length - run.length;
  const counts = {};
  for (const r of run) {
    const body = r.method === 'DELETE' ? undefined : ph.body;
    const res = await hit(r.method, r.path, ph.dead, body);
    counts[res.st] = (counts[res.st] || 0) + 1;
    all.push({ ph: ph.id, m: r.method, path: r.path, st: res.st });
    if ((typeof res.st === 'number' && res.st >= 500) || res.st === 'THREW')
      defects.push({ ph: ph.id, m: r.method, path: r.path, ...res });
  }
  console.log(`[${ph.id}] ${ph.label.padEnd(32)} ran ${String(run.length).padStart(3)} | excl ${String(skipped).padStart(2)} | ${JSON.stringify(counts)}`);
}
const after = await snapAll();
const drift = Object.keys(after).filter(t => before[t] !== after[t]).map(t => `${t}: ${before[t]}->${after[t]}`);

console.log(`\nTOTAL requests: ${all.length}`);
console.log(`DB DRIFT: ${drift.length ? drift.join(' | ') : 'NONE (0 net writes)'}`);
console.log(`\n5xx / THREW DEFECTS: ${defects.length}`);
for (const d of defects) console.log(`  [${d.ph}] ${d.m} ${d.path}\n        -> ${d.url}\n        ${d.st}  ${d.body.replace(/\n/g, ' ')}`);
fs.writeFileSync('C:/tmp/qa-r100-sweep.json', JSON.stringify({ all, defects, drift }, null, 1));
await pool.end();
