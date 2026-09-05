// Run 123-s1 — CHARTER ITEM: "test with missing required fields — should return 400, not crash".
// Sends {} to every COLLECTION-level POST/PUT (no :id in the path), i.e. every required field
// absent. Action routes are excluded BY SEMANTICS (Run 100 lesson: an empty body FIRES an
// action route rather than neutralising it). Snapshots per-table row counts before and after
// so any row a permissive create leaves behind is visible and can be cleaned up.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const T = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${T}` };
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

const SKIP = /import|geocode|\/send|email|\/sms|webhook|skip-trace|logout|login|register|refresh|score-all|correct-all|mark-all-read|\/complete|alerts\/test|\/pdf|stripe|connect|checkout|payment|measure|roof-measurement|onboarding|test-email/i;
const TABLES = ['leads', 'estimates', 'invoices', 'contracts', 'work_orders', 'subcontractors',
  'expenses', 'documents', 'tasks', 'material_orders', 'automations', 'drip_sequences',
  'drip_sequence_steps', 'prospect_lists', 'prospect_list_items', 'financing_applications',
  'financing_lenders', 'financing_plans', 'canvass_pins', 'canvass_territories', 'payments',
  'notifications', 'activities', 'contacts', 'properties', 'estimate_templates',
  'contract_templates', 'custom_field_definitions', 'alert_configs', 'work_order_milestones',
  'drift_calibrations', 'outreach_log'];

const snap = async () => {
  const o = {};
  for (const t of TABLES) {
    try { o[t] = (await pool.query(`SELECT count(*)::int c, max(created_at) m FROM ${t}`)).rows[0]; }
    catch { try { o[t] = (await pool.query(`SELECT count(*)::int c FROM ${t}`)).rows[0]; } catch (e) { o[t] = { c: `ERR:${e.code}` }; } }
  }
  return o;
};

const before = await snap();
const targets = inv.filter((r) => ['POST', 'PUT'].includes(r.method) && !/:/.test(r.path) && !SKIP.test(r.path));
console.log(`probing ${targets.length} collection-level POST/PUT routes with {}\n`);

const out = [];
for (const r of targets) {
  let st, body = '';
  try {
    const res = await fetch(BASE + r.path, { method: r.method, headers: H, body: '{}' });
    st = res.status; body = (await res.text()).slice(0, 160).replace(/\s+/g, ' ');
  } catch (e) { st = 'ERR'; body = e.message; }
  out.push({ m: r.method, p: r.path, st, body });
  console.log(`${String(st).padEnd(4)} ${r.method.padEnd(5)} ${r.path.padEnd(42)} ${body}`);
}

const after = await snap();
console.log('\n=== ROW COUNT DRIFT ===');
let drift = 0;
for (const t of TABLES) {
  const b = before[t]?.c, a = after[t]?.c;
  if (b !== a) { console.log(`  ${t}: ${b} -> ${a}`); drift++; }
}
if (!drift) console.log('  none — 0 rows created');

console.log('\n=== 5xx (defects) ===');
const bad = out.filter((o) => typeof o.st === 'number' && o.st >= 500);
bad.forEach((o) => console.log(`${o.st} ${o.m} ${o.p} :: ${o.body}`));
console.log(bad.length ? '' : '  none');
console.log('\n=== 2xx on empty body (created something / no validation) ===');
out.filter((o) => o.st >= 200 && o.st < 300).forEach((o) => console.log(`${o.st} ${o.m} ${o.p} :: ${o.body}`));
fs.writeFileSync('C:/tmp/qa-r123-emptycreate.json', JSON.stringify({ out, before, after }, null, 1));
await pool.end();
