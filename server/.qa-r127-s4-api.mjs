import pool from './src/db/pool.js';
import fs from 'fs';

const BASE = 'http://localhost:3001/api';
// Mint the token in-process. A file hop is what burned the first attempt: Git Bash's
// /tmp is %LOCALAPPDATA%\Temp but node resolves /tmp to C:\tmp, so the reader picked up
// a 2-day-old login response and every request came back 401.
const lr = await fetch(BASE + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'waterlooconstruction1@gmail.com',
    password: '2Wealth&health',
    tenantSlug: 'waterloo',
  }),
});
const lj = await lr.json();
if (!lj.accessToken) {
  console.log('LOGIN FAILED ' + lr.status + ' ' + JSON.stringify(lj).slice(0, 200));
  process.exit(1);
}
const TOKEN = lj.accessToken;
fs.writeFileSync('C:\\tmp\\qa-token.txt', TOKEN);
const exp = JSON.parse(Buffer.from(TOKEN.split('.')[1], 'base64url').toString()).exp;
console.log('token minted, ' + (exp - Math.floor(Date.now() / 1000)) + 's remaining');
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };
const MINE = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const OTHER = 'dbeb300e-414f-4dac-9aeb-d8adf8d9ca34';
const FOREIGN_EST = '1a6d63d8-ed9c-4fb9-967b-0ad58fda76d4';
const FOREIGN_USER = '9f27e455-d887-4c20-a3f1-95dfa27eea00';
const MY_LEAD = '16486c58-5539-4572-94bd-7a9fef62f00b';
const MY_EST = '03f53295-cfcb-4e6b-8168-620fef5a0bd8';
const MY_USER = '45cc729d-cc5b-44b5-93ca-7c01b427fc26';
const PII_NAME = 'ZZQA-FOREIGN-NAME';
const PII_ADDR = '999 ZZQA Leak Street';

const out = [];
const log = (part, name, pass, detail) => {
  out.push({ part, name, pass, detail });
  console.log((pass ? 'PASS' : 'FAIL') + ' [' + part + '] ' + name + ' :: ' + detail);
};

async function req(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { j = { _raw: t.slice(0, 200) }; }
  return { status: r.status, body: j, text: t };
}

const counts = async () => (await pool.query(
  'SELECT (SELECT count(*) FROM leads)::int leads,(SELECT count(*) FROM tasks)::int tasks,' +
  '(SELECT count(*) FROM activities)::int acts,(SELECT count(*) FROM work_orders)::int wos,' +
  '(SELECT count(*) FROM estimates)::int ests,(SELECT count(*) FROM contracts)::int contracts,' +
  '(SELECT count(*) FROM invoices)::int invs,(SELECT count(*) FROM expenses)::int exps')).rows[0];

let plantedLead = null;
let probeActivity = null;
const created = [];
const before = await counts();
console.log('BASELINE ' + JSON.stringify(before));

try {
  // ---------- PART A: 9ddc61b - pg error text must not leak the column type ----------
  const LEAK = /timestamp|invalid input syntax|character varying|out of range/i;
  const dateProbes = [
    ['22007 malformed date', 'start=notadate&end=notadate'],
    ['22008 out-of-range date', 'start=9999999-01-01&end=9999999-01-02'],
  ];
  for (const [name, qs] of dateProbes) {
    const r = await req('GET', '/crm/calendar?' + qs);
    const msg = JSON.stringify(r.body);
    log('A', name, r.status === 400 && !LEAK.test(msg), r.status + ' ' + msg.slice(0, 160));
  }

  // ---------- plant one foreign lead (only the lead_id attacks need it) ----------
  const p = await pool.query(
    'INSERT INTO leads (tenant_id, contact_name, address) VALUES ($1,$2,$3) RETURNING id',
    [OTHER, PII_NAME, PII_ADDR]);
  plantedLead = p.rows[0].id;
  console.log('planted foreign lead ' + plantedLead + ' in tenant ' + OTHER);

  // ---------- PART B: 96f7ad2 + 83ba6b4 - write boundary rejects foreign FKs ----------
  const attacks = [
    ['activities lead_id', '/crm/activities', { lead_id: plantedLead, type: 'note', subject: 'QA-R127-S4' }, 'activities'],
    ['tasks lead_id', '/crm/tasks', { lead_id: plantedLead, title: 'QA-R127-S4' }, 'tasks'],
    ['tasks assigned_to', '/crm/tasks', { title: 'QA-R127-S4', assigned_to: FOREIGN_USER }, 'tasks'],
    ['contracts lead_id', '/crm/contracts', { lead_id: plantedLead, templateType: 'standard' }, 'contracts'],
    ['contracts estimate_id', '/crm/contracts', { lead_id: MY_LEAD, estimate_id: FOREIGN_EST, templateType: 'standard' }, 'contracts'],
    ['invoices lead_id', '/crm/invoices', { lead_id: plantedLead }, 'invoices'],
    ['invoices estimate_id', '/crm/invoices', { lead_id: MY_LEAD, estimate_id: FOREIGN_EST }, 'invoices'],
    ['expenses lead_id', '/crm/expenses', { lead_id: plantedLead, category: 'Materials', amount: 1, date: '2026-09-06' }, 'expenses'],
    ['work-orders lead_id', '/crm/work-orders', { title: 'QA-R127-S4', lead_id: plantedLead }, 'work_orders'],
    ['work-orders estimate_id', '/crm/work-orders', { title: 'QA-R127-S4', estimate_id: FOREIGN_EST }, 'work_orders'],
    ['work-orders assigned_to', '/crm/work-orders', { title: 'QA-R127-S4', assigned_to: FOREIGN_USER }, 'work_orders'],
    ['estimates lead_id', '/estimates', { lead_id: plantedLead }, 'estimates'],
  ];
  for (const [name, path, body, table] of attacks) {
    const r = await req('POST', path, body);
    if (r.status === 201 || r.status === 200) created.push({ name, table, id: r.body && r.body.id });
    log('B', name, r.status === 400 && /not found/i.test(JSON.stringify(r.body)),
      r.status + ' ' + JSON.stringify(r.body).slice(0, 120));
  }

  // ---------- PART C: 83ba6b4 - read joins must not render a foreign lead's PII ----------
  const a = await pool.query(
    'INSERT INTO activities (tenant_id, lead_id, user_id, type, subject, created_at) ' +
    "VALUES ($1,$2,$3,'call','QA-R127-S4-PROBE', now()) RETURNING id",
    [MINE, plantedLead, MY_USER]);
  probeActivity = a.rows[0].id;
  console.log('planted cross-tenant activity ' + probeActivity);

  const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  const reads = [
    ['calendar (activities + tasks joins)', '/crm/calendar?start=' + day(-2) + '&end=' + day(2)],
    ['crm dashboard/activity (getRecentActivity)', '/crm/dashboard/activity'],
    ['dashboard/activity (getActivity)', '/dashboard/activity'],
    ['documents (listDocuments)', '/crm/documents'],
    ['search (contact search)', '/search?q=ZZQA'],
  ];
  for (const [name, path] of reads) {
    const r = await req('GET', path);
    const leaked = r.text.includes(PII_NAME) || r.text.includes(PII_ADDR);
    log('C', name, r.status < 400 && !leaked, r.status + ' leaked=' + leaked + ' len=' + r.text.length);
  }

  // ---------- PART D: positive regression - owned ids still create ----------
  const positives = [
    ['work-order w/ owned lead+estimate+assignee', '/crm/work-orders',
      { title: 'QA-R127-S4-POS', lead_id: MY_LEAD, estimate_id: MY_EST, assigned_to: MY_USER }, 'work_orders'],
    ['activity w/ owned lead', '/crm/activities',
      { lead_id: MY_LEAD, type: 'note', subject: 'QA-R127-S4-POS' }, 'activities'],
    ['expense w/ NO lead_id (nullable passes)', '/crm/expenses',
      { category: 'Materials', amount: 1, date: '2026-09-06', notes: 'QA-R127-S4-POS' }, 'expenses'],
  ];
  for (const [name, path, body, table] of positives) {
    const r = await req('POST', path, body);
    const ok = r.status === 201 && r.body && r.body.id;
    if (ok) created.push({ name, table, id: r.body.id });
    log('D', name, ok, r.status + ' ' + JSON.stringify(r.body).slice(0, 100));
  }
} finally {
  // ---------- cleanup: remove every planted / created row ----------
  for (const c of created) {
    if (!c.id || !c.table) continue;
    try {
      await pool.query('DELETE FROM ' + c.table + ' WHERE id = $1', [c.id]);
      console.log('cleaned ' + c.table + ' ' + c.id);
    } catch (e) {
      console.log('CLEANUP-FAIL ' + c.table + ' ' + c.id + ' ' + e.message);
    }
  }
  if (probeActivity) await pool.query('DELETE FROM activities WHERE id = $1', [probeActivity]);
  if (plantedLead) {
    await pool.query('DELETE FROM activities WHERE lead_id = $1', [plantedLead]);
    await pool.query('DELETE FROM leads WHERE id = $1', [plantedLead]);
  }
  const after = await counts();
  console.log('AFTER    ' + JSON.stringify(after));
  console.log(JSON.stringify(before) === JSON.stringify(after)
    ? 'DB NET ZERO: yes'
    : 'DB NET ZERO: NO');
  const fails = out.filter((o) => !o.pass);
  console.log('\nSUMMARY ' + (out.length - fails.length) + '/' + out.length + ' passed');
  if (fails.length) {
    console.log('FAILURES:\n' + fails.map((f) => ' - [' + f.part + '] ' + f.name + ': ' + f.detail).join('\n'));
  }
  await pool.end();
}
