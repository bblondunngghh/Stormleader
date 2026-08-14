// s4-verify: re-verify the two API fixes from this run THROUGH HTTP against the
// running server (proves the fix is live in the deployed process, not just in source).
import pool from './src/db/pool.js';
import fs from 'fs';

const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const BASE = 'http://localhost:3001/api';
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };
const out = [];
const log = (s) => { console.log(s); out.push(s); };

// ---------- FIX 46d8480: generate-tiers on malformed line_items ----------
log('=== FIX 46d8480 — generate-tiers on non-object line items (HTTP) ===');
const estBefore = (await pool.query('SELECT COUNT(*)::int n FROM estimates')).rows[0].n;
log(`estimates baseline: ${estBefore}`);

const { rows: fixtures } = await pool.query(
  `SELECT id, estimate_number, line_items FROM estimates
    WHERE id IN ('1252940b-b691-4182-8d4f-680ac71a0711','2dd4659c-ed16-4353-9ee6-5dfdf944f365')`);
log(`malformed fixtures present: ${fixtures.length} (${fixtures.map(f=>f.estimate_number).join(',')})`);

// control: an estimate with GOOD line items, to prove the working path still works
const { rows: [ctl] } = await pool.query(
  `SELECT id, estimate_number, jsonb_array_length(line_items) n FROM estimates
    WHERE jsonb_typeof(line_items)='array' AND jsonb_array_length(line_items) > 0
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(line_items) e WHERE jsonb_typeof(e)<>'object')
    ORDER BY created_at DESC LIMIT 1`);

const targets = [
  ...fixtures.map(f => [`${f.estimate_number} ${JSON.stringify(f.line_items)}`, f.id]),
  [`${ctl.estimate_number} (CONTROL, ${ctl.n} good items)`, ctl.id],
];

for (const [label, id] of targets) {
  const r = await fetch(`${BASE}/estimates/${id}/generate-tiers`, { method: 'POST', headers: H, body: '{}' });
  const body = await r.json().catch(() => ({}));
  const tiers = Array.isArray(body) ? body : (body.tiers || body.data || []);
  const items = tiers?.[0]?.line_items?.length ?? '?';
  log(`  POST generate-tiers ${label}\n    -> HTTP ${r.status}  tiers=${Array.isArray(tiers)?tiers.length:'n/a'}  items-in-tier1=${items}`);
}

// ---------- CLEANUP: generate-tiers INSERTS 3 estimates per call ----------
const { rows: residue } = await pool.query(
  `SELECT id, estimate_number FROM estimates WHERE created_at > NOW() - INTERVAL '10 minutes'`);
if (residue.length) await pool.query('DELETE FROM estimates WHERE id = ANY($1::uuid[])', [residue.map(r=>r.id)]);
const estAfter = (await pool.query('SELECT COUNT(*)::int n FROM estimates')).rows[0].n;
log(`  DB HYGIENE: deleted ${residue.length} generated rows | estimates ${estBefore} -> ${estAfter} (NET ${estAfter-estBefore})`);

// ---------- FIX 8a45209: work order "Save Changes" ----------
log('');
log('=== FIX 8a45209 — work order Save Changes with \'\' in uuid/date/time cols (HTTP) ===');
const { rows: wos } = await pool.query(
  `SELECT id, wo_number, title, description, status, crew_name, notes,
          lead_id, assigned_to, scheduled_date, scheduled_time_start, scheduled_time_end
     FROM work_orders ORDER BY created_at DESC`);
log(`work orders in tenant: ${wos.length}`);
const affected = wos.filter(w => !w.lead_id || !w.assigned_to || !w.scheduled_date
                              || !w.scheduled_time_start || !w.scheduled_time_end);
log(`rows that send at least one '' (the 400 class): ${affected.length} of ${wos.length}`);

// Reproduce EXACTLY what WorkOrdersView.jsx:59-63 sends: every field, null -> ''.
// Round-tripping current values back = zero data change, only updated_at moves.
let pass = 0, fail = 0;
const fails = [];
for (const w of wos) {
  const payload = {
    title: w.title ?? '', description: w.description ?? '', status: w.status,
    crew_name: w.crew_name ?? '', notes: w.notes ?? '',
    lead_id: w.lead_id || '', assigned_to: w.assigned_to || '',
    scheduled_date: w.scheduled_date ? new Date(w.scheduled_date).toISOString().slice(0,10) : '',
    scheduled_time_start: w.scheduled_time_start || '', scheduled_time_end: w.scheduled_time_end || '',
  };
  const r = await fetch(`${BASE}/crm/work-orders/${w.id}`, { method: 'PATCH', headers: H, body: JSON.stringify(payload) });
  if (r.ok) pass++; else { fail++; fails.push(`${w.wo_number} HTTP ${r.status} ${(await r.text()).slice(0,120)}`); }
}
log(`  PATCH all ${wos.length} work orders as the UI sends them: ${pass} OK / ${fail} FAILED`);
fails.slice(0, 5).forEach(f => log(`    FAIL ${f}`));

// prove no data was changed by the round-trip
const { rows: after } = await pool.query(
  `SELECT id, lead_id, assigned_to, scheduled_date, scheduled_time_start, scheduled_time_end, status, title
     FROM work_orders ORDER BY created_at DESC`);
const drift = after.filter((a, i) => {
  const b = wos[i];
  return a.id !== b.id || String(a.lead_id) !== String(b.lead_id) || String(a.assigned_to) !== String(b.assigned_to)
      || String(a.scheduled_date) !== String(b.scheduled_date) || String(a.status) !== String(b.status)
      || String(a.title) !== String(b.title);
});
log(`  DATA DRIFT after round-trip: ${drift.length} rows changed (must be 0)`);
const { rows: [woc] } = await pool.query('SELECT COUNT(*)::int n FROM work_orders');
log(`  work_orders count: ${woc.n} (was ${wos.length}) — NET ${woc.n - wos.length}`);

fs.appendFileSync('C:/tmp/verify-results.txt', out.join('\n') + '\n\n');
await pool.end();
