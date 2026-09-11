// Run 131 (s4) — re-verify tonight's four fix commits against the LIVE restarted server.
// DB discipline: 2 planted foreign rows + 3 created rows, ALL removed at the end;
// every field mutated on an existing row is restored to its captured original.
import fs from 'fs';
import pool from './src/db/pool.js';

const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const API = 'http://localhost:3001';
const ME    = '791bb51d-3293-4839-92e9-bd4d4f873af2'; // waterloo (the caller)
const OTHER = 'dbeb300e-414f-4dac-9aeb-d8adf8d9ca34'; // waterloo-roofco-2 (the victim)
const FOREIGN_ESTIMATE = '1a6d63d8-ed9c-4fb9-967b-0ad58fda76d4'; // real, tenant stormleads-test

const req = async (method, path, body) => {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
};
const q = async (sql, p) => (await pool.query(sql, p)).rows;
const results = [];
const rec = (commit, name, pass, detail) => results.push({ commit, name, pass, detail });

// ---------- plant the two foreign fixtures ----------
const planted = {};
planted.lead = (await q(
  "INSERT INTO leads (tenant_id, contact_name, contact_phone, contact_email, address, stage, priority)" +
  " VALUES ($1,'ZZ-R131-VICTIM-LEAD','555-0131','victim131@rival.example','1 Victim Way','new','cold')" +
  " RETURNING id", [OTHER]))[0].id;
planted.sub = (await q(
  "INSERT INTO subcontractors (tenant_id, name, company, phone, email, specialty, status)" +
  " VALUES ($1,'ZZ-R131-VICTIM-SUB','Rival Roofing R131','555-0132','victimsub131@rival.example','roofing','active')" +
  " RETURNING id", [OTHER]))[0].id;

const created = { estimates: [], invoices: [], contracts: [] };

try {
  // ========== fb9f9ba : create routes must accept a NULL lead_id ==========
  const e = await req('POST', '/api/estimates', { title: 'ZZ-R131 verify', line_items: [], status: 'draft' });
  rec('fb9f9ba', 'POST /api/estimates with no lead_id', e.status === 201, e.status + ' ' + JSON.stringify(e.body).slice(0, 110));
  if (e.status === 201 && e.body && e.body.id) created.estimates.push(e.body.id);

  const i = await req('POST', '/api/crm/invoices', { line_items: [], status: 'draft' });
  rec('fb9f9ba', 'POST /api/crm/invoices with no lead_id', i.status === 201, i.status + ' ' + JSON.stringify(i.body).slice(0, 110));
  if (i.status === 201 && i.body && i.body.id) created.invoices.push(i.body.id);

  const c = await req('POST', '/api/crm/contracts', { title: 'ZZ-R131 verify', content: {} });
  rec('fb9f9ba', 'POST /api/crm/contracts with no lead_id', c.status === 201, c.status + ' ' + JSON.stringify(c.body).slice(0, 110));
  if (c.status === 201 && c.body && c.body.id) created.contracts.push(c.body.id);

  // the UUID-format half of 3577c4a must still hold (zero write)
  const fmt = [['estimates', '/api/estimates'], ['invoices', '/api/crm/invoices'], ['contracts', '/api/crm/contracts']];
  for (const [label, path] of fmt) {
    const r = await req('POST', path, { lead_id: 'not-a-uuid', title: 'ZZ-R131', line_items: [], content: {} });
    const good = r.status === 400 && /Invalid lead_id format/i.test((r.body && r.body.error) || '');
    rec('fb9f9ba', 'POST ' + label + ' malformed lead_id still 400', good, r.status + ' ' + (r.body && r.body.error));
  }

  // ========== e75f7dd : UPDATE paths reject a FOREIGN lead_id / estimate_id ==========
  const myEstimate = (await q("SELECT id, lead_id FROM estimates WHERE tenant_id=$1 AND id <> ALL($2::uuid[]) ORDER BY created_at DESC LIMIT 1", [ME, created.estimates]))[0];
  const myInvoice  = (await q("SELECT id, lead_id, estimate_id FROM invoices  WHERE tenant_id=$1 AND id <> ALL($2::uuid[]) ORDER BY created_at DESC LIMIT 1", [ME, created.invoices]))[0];
  const myContract = (await q("SELECT id, lead_id, estimate_id FROM contracts WHERE tenant_id=$1 AND id <> ALL($2::uuid[]) ORDER BY created_at DESC LIMIT 1", [ME, created.contracts]))[0];
  const myExpense  = (await q("SELECT id, lead_id FROM expenses WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1", [ME]))[0];

  const updates = [
    ['estimate', '/api/estimates/' + myEstimate.id,      { lead_id: planted.lead }],
    ['invoice',  '/api/crm/invoices/' + myInvoice.id,    { lead_id: planted.lead }],
    ['contract', '/api/crm/contracts/' + myContract.id,  { lead_id: planted.lead }],
    ['expense',  '/api/crm/expenses/' + myExpense.id,    { lead_id: planted.lead }],
    ['invoice',  '/api/crm/invoices/' + myInvoice.id,    { estimate_id: FOREIGN_ESTIMATE }],
    ['contract', '/api/crm/contracts/' + myContract.id,  { estimate_id: FOREIGN_ESTIMATE }],
  ];
  for (const [label, path, body] of updates) {
    const field = Object.keys(body)[0];
    let r = await req('PUT', path, body);
    if (r.status === 404 || r.status === 405) r = await req('PATCH', path, body);
    rec('e75f7dd', 'update ' + label + ' with foreign ' + field + ' rejected', r.status === 400, r.status + ' ' + JSON.stringify(r.body).slice(0, 90));
  }

  const leaked = await q(
    "SELECT 'estimates' t, count(*) n FROM estimates e JOIN leads l ON l.id=e.lead_id WHERE l.tenant_id<>e.tenant_id" +
    " UNION ALL SELECT 'invoices',  count(*) FROM invoices i JOIN leads l ON l.id=i.lead_id WHERE l.tenant_id<>i.tenant_id" +
    " UNION ALL SELECT 'contracts', count(*) FROM contracts c JOIN leads l ON l.id=c.lead_id WHERE l.tenant_id<>c.tenant_id" +
    " UNION ALL SELECT 'expenses',  count(*) FROM expenses x JOIN leads l ON l.id=x.lead_id WHERE l.tenant_id<>x.tenant_id" +
    " UNION ALL SELECT 'inv.est',   count(*) FROM invoices i JOIN estimates e ON e.id=i.estimate_id WHERE e.tenant_id<>i.tenant_id" +
    " UNION ALL SELECT 'con.est',   count(*) FROM contracts c JOIN estimates e ON e.id=c.estimate_id WHERE e.tenant_id<>c.tenant_id");
  rec('e75f7dd', 'no cross-tenant FK stored anywhere after the probes',
      leaked.every(r => Number(r.n) === 0), JSON.stringify(leaked.map(r => r.t + '=' + r.n)));

  // regression: my OWN lead_id must still be accepted
  const myLead = (await q("SELECT id FROM leads WHERE tenant_id=$1 LIMIT 1", [ME]))[0].id;
  const origLead = myInvoice.lead_id;
  let ok = await req('PUT', '/api/crm/invoices/' + myInvoice.id, { lead_id: myLead });
  if (ok.status === 404 || ok.status === 405) ok = await req('PATCH', '/api/crm/invoices/' + myInvoice.id, { lead_id: myLead });
  rec('e75f7dd', 'REGRESSION: own lead_id still accepted on update', ok.status === 200, String(ok.status));
  await pool.query("UPDATE invoices SET lead_id=$1 WHERE id=$2", [origLead, myInvoice.id]); // restore

  // ========== 151428c : subcontractor assign rejects a FOREIGN subcontractor ==========
  const myWO = (await q("SELECT id FROM work_orders WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1", [ME]))[0].id;
  const a = await req('POST', '/api/crm/subcontractors/assign', { work_order_id: myWO, subcontractor_id: planted.sub });
  rec('151428c', 'assign FOREIGN subcontractor rejected', a.status === 400, a.status + ' ' + JSON.stringify(a.body).slice(0, 90));
  const back = await req('GET', '/api/crm/subcontractors/work-order/' + myWO);
  const names = JSON.stringify(back.body || []);
  rec('151428c', 'read-back does not disclose the foreign crew',
      !/ZZ-R131-VICTIM-SUB|Rival Roofing R131|victimsub131/.test(names), back.status + ' ' + names.slice(0, 150));

  // regression: assigning my OWN subcontractor still works
  const mySub = (await q("SELECT id FROM subcontractors WHERE tenant_id=$1 LIMIT 1", [ME]))[0].id;
  const a2 = await req('POST', '/api/crm/subcontractors/assign', { work_order_id: myWO, subcontractor_id: mySub });
  rec('151428c', 'REGRESSION: own subcontractor still assignable', a2.status === 201 || a2.status === 200, String(a2.status));
  await pool.query("DELETE FROM work_order_subcontractors WHERE work_order_id=$1 AND subcontractor_id=$2 AND created_at > now() - interval '5 minutes'", [myWO, mySub]);
} finally {
  for (const id of created.estimates) await pool.query("DELETE FROM estimates WHERE id=$1", [id]);
  for (const id of created.invoices)  await pool.query("DELETE FROM invoices  WHERE id=$1", [id]);
  for (const id of created.contracts) await pool.query("DELETE FROM contracts WHERE id=$1", [id]);
  await pool.query("DELETE FROM work_order_subcontractors WHERE subcontractor_id=$1", [planted.sub]);
  await pool.query("DELETE FROM subcontractors WHERE id=$1", [planted.sub]);
  await pool.query("DELETE FROM activities WHERE lead_id=$1", [planted.lead]);
  await pool.query("DELETE FROM leads WHERE id=$1", [planted.lead]);
}

const finalCounts = (await q(
  "SELECT (SELECT count(*) FROM estimates) estimates, (SELECT count(*) FROM invoices) invoices," +
  " (SELECT count(*) FROM contracts) contracts, (SELECT count(*) FROM leads) leads," +
  " (SELECT count(*) FROM subcontractors) subcontractors," +
  " (SELECT count(*) FROM work_order_subcontractors) wo_subs"))[0];

console.log(JSON.stringify({
  results, finalCounts,
  summary: results.filter(r => r.pass).length + '/' + results.length + ' PASS',
  failures: results.filter(r => !r.pass),
}, null, 1));
await pool.end();
