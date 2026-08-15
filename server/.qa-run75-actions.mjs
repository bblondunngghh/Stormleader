// Run 75 s1 — ACTION POST sweep with REAL ids.
// This is the shape that broke generate-tiers in Run 74: a POST that runs real
// business logic over a stored row. Dead-uuid sweeps 404 before any of it.
// Every mutation is snapshotted and restored; every created row is deleted.
//
// STRUCTURALLY UNABLE TO FIND: races, anything needing a 2nd tenant, paid-key paths
// (skip-trace/Hearth), and flows whose only trigger is the browser.
import pool from './src/db/pool.js';
import { req, summarize } from './.qa-r73-lib.mjs';

const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const q = (sql, a = []) => pool.query(sql, a).then((r) => r.rows).catch((e) => { console.log('  SQL:', e.message.slice(0, 70)); return []; });
const one = async (sql, a = [T]) => { const r = await q(sql, a); return r[0] ? Object.values(r[0])[0] : null; };

const ids = {
  lead: await one(`SELECT id FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL LIMIT 1`),
  estimate: await one(`SELECT id FROM estimates WHERE tenant_id=$1 LIMIT 1`),
  invoice: await one(`SELECT id FROM invoices WHERE tenant_id=$1 AND status='draft' LIMIT 1`),
  contractDraft: await one(`SELECT id FROM contracts WHERE tenant_id=$1 AND status='draft' LIMIT 1`),
  workOrder: await one(`SELECT id FROM work_orders WHERE tenant_id=$1 LIMIT 1`),
  property: await one(`SELECT id FROM properties LIMIT 1`, []),
  pin: await one(`SELECT id FROM canvass_pins WHERE tenant_id=$1 LIMIT 1`),
  storm: await one(`SELECT id FROM storm_events LIMIT 1`, []),
};
console.log('IDS:', JSON.stringify(ids, null, 0), '\n');

// snapshot rows we are about to mutate so we can put them back exactly
const snap = {};
const takeSnap = async (tbl, id, cols) => {
  const r = await q(`SELECT ${cols.join(',')} FROM ${tbl} WHERE id=$1`, [id]);
  if (r[0]) snap[`${tbl}:${id}`] = r[0];
};
await takeSnap('estimates', ids.estimate, ['status', 'sent_at', 'signed_at', 'signature_data', 'signer_name']);
await takeSnap('invoices', ids.invoice, ['status', 'sent_at']);
await takeSnap('contracts', ids.contractDraft, ['status', 'sent_at']);
await takeSnap('leads', ids.lead, ['lead_score', 'status_token']);

const created = [];
const results = [];
const hit = async (label, method, path, body, opts = {}) => {
  const out = await req(method, path, body);
  const bad = out.status >= 500 || out.status === 0;
  results.push({ label, status: out.status });
  console.log(`${bad ? '*** ' : '    '}${String(out.status).padEnd(4)} ${label}  ${summarize(out.body).slice(0, 95)}`);
  if (bad) console.log('      BODY:', JSON.stringify(out.body).slice(0, 500));
  if (opts.collect && out.body && out.body.id) created.push([opts.collect, out.body.id]);
  return out;
};

console.log('--- read-mostly actions ---');
await hit('estimates/:id/generate-tiers', 'POST', `/api/estimates/${ids.estimate}/generate-tiers`, {});
await hit('leads/:id/score', 'POST', `/api/crm/leads/${ids.lead}/score`, {});
await hit('properties/:id/fema-lookup', 'POST', `/api/properties/${ids.property}/fema-lookup`, {});
await hit('leads/:id/status-token', 'POST', `/api/leads/${ids.lead}/status-token`, {});

console.log('--- status-mutating actions (restored below) ---');
await hit('estimates/:id/send', 'POST', `/api/estimates/${ids.estimate}/send`, {});
await hit('invoices/:id/send', 'POST', `/api/crm/invoices/${ids.invoice}/send`, {});
await hit('invoices/:id/send-email', 'POST', `/api/crm/invoices/${ids.invoice}/send-email`, {});
await hit('contracts/:id/send', 'POST', `/api/crm/contracts/${ids.contractDraft}/send`, {});
await hit('estimates/:id/sign-in-person', 'POST', `/api/estimates/${ids.estimate}/sign-in-person`, { signerName: 'QA75 Probe', signatureData: 'data:image/png;base64,iVBORw0KGgo=' });

console.log('--- row-creating actions (deleted below) ---');
await hit('estimates/:id/duplicate', 'POST', `/api/estimates/${ids.estimate}/duplicate`, {}, { collect: 'estimates' });
await hit('leads/:id/contacts', 'POST', `/api/crm/leads/${ids.lead}/contacts`, { name: 'QA75 Probe', email: 'qa75@example.com' }, { collect: 'contacts' });
await hit('work-orders/:id/milestones', 'POST', `/api/crm/work-orders/${ids.workOrder}/milestones`, { name: 'QA75 Probe Milestone' }, { collect: 'work_order_milestones' });
await hit('invoices/:id/payment', 'POST', `/api/crm/invoices/${ids.invoice}/payment`, { amount: 1, method: 'check', note: 'QA75 probe' }, { collect: 'payments' });
await hit('materials/estimate/:id/auto-order', 'POST', `/api/materials/estimate/${ids.estimate}/auto-order`, {}, { collect: 'material_orders' });
if (ids.pin) await hit('canvass-pins/:id/convert', 'POST', `/api/crm/canvass-pins/${ids.pin}/convert`, {}, { collect: 'leads' });
await hit('drift/:stormEventId/correct', 'POST', `/api/drift/${ids.storm}/correct`, { offsetX: 0, offsetY: 0 });

// ---------------- cleanup ----------------
console.log('\n--- CLEANUP ---');
for (const [tbl, id] of created) {
  const r = await q(`DELETE FROM ${tbl} WHERE id=$1 RETURNING id`, [id]);
  console.log(`  deleted ${tbl} ${id} -> ${r.length ? 'ok' : 'MISS'}`);
}
await q(`DELETE FROM contacts WHERE tenant_id=$1 AND email='qa75@example.com'`, [T]);
await q(`DELETE FROM work_order_milestones WHERE name='QA75 Probe Milestone'`);
await q(`DELETE FROM drift_calibrations WHERE storm_event_id=$1`, [ids.storm]);
for (const [key, row] of Object.entries(snap)) {
  const [tbl, id] = key.split(':');
  const cols = Object.keys(row);
  const sets = cols.map((c, i) => `${c}=$${i + 2}`).join(', ');
  await q(`UPDATE ${tbl} SET ${sets} WHERE id=$1`, [id, ...cols.map((c) => row[c])]);
  console.log(`  restored ${tbl} ${id} (${cols.join(',')})`);
}

const n5xx = results.filter((r) => r.status >= 500 || r.status === 0).length;
console.log(`\nACTION SWEEP: ${results.length} routes, ${n5xx} 5xx`);
console.log('tally:', JSON.stringify(results.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {})));
await pool.end();
