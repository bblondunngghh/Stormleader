// s4-verify: re-verify fix 8a45209 (work order "Save Changes") through HTTP.
import pool from './src/db/pool.js';
import fs from 'fs';

const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const BASE = 'http://localhost:3001/api';
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };
const out = [];
const log = (s) => { console.log(s); out.push(s); };

log('=== FIX 8a45209 — work order Save Changes with \'\' in uuid/date/time cols (HTTP) ===');
const cols = `id, title, description, status, crew_name, notes, lead_id, assigned_to,
              scheduled_date, scheduled_time_start, scheduled_time_end`;
const { rows: wos } = await pool.query(`SELECT ${cols} FROM work_orders ORDER BY created_at DESC`);
log(`work orders in tenant: ${wos.length}`);
const affected = wos.filter(w => !w.lead_id || !w.assigned_to || !w.scheduled_date
                              || !w.scheduled_time_start || !w.scheduled_time_end);
log(`rows that send at least one '' (the 400 class): ${affected.length} of ${wos.length}`);

// Reproduce EXACTLY what WorkOrdersView.jsx:59-63 sends: every field, null -> ''.
// Round-tripping current values back = zero data change, only updated_at moves.
let pass = 0, fail = 0; const fails = [];
for (const w of wos) {
  const payload = {
    title: w.title ?? '', description: w.description ?? '', status: w.status,
    crew_name: w.crew_name ?? '', notes: w.notes ?? '',
    lead_id: w.lead_id || '', assigned_to: w.assigned_to || '',
    scheduled_date: w.scheduled_date ? new Date(w.scheduled_date).toISOString().slice(0, 10) : '',
    scheduled_time_start: w.scheduled_time_start || '', scheduled_time_end: w.scheduled_time_end || '',
  };
  const r = await fetch(`${BASE}/crm/work-orders/${w.id}`, { method: 'PATCH', headers: H, body: JSON.stringify(payload) });
  if (r.ok) pass++; else { fail++; fails.push(`${w.id.slice(0,8)} "${w.title}" HTTP ${r.status} ${(await r.text()).slice(0,140)}`); }
}
log(`  PATCH all ${wos.length} work orders as the UI sends them: ${pass} OK / ${fail} FAILED`);
fails.slice(0, 6).forEach(f => log(`    FAIL ${f}`));

const { rows: after } = await pool.query(`SELECT ${cols} FROM work_orders ORDER BY created_at DESC`);
const key = (r) => [r.id, r.lead_id, r.assigned_to, r.scheduled_date, r.scheduled_time_start,
                    r.scheduled_time_end, r.status, r.title, r.crew_name, r.notes].map(String).join('|');
const drift = after.filter((a, i) => key(a) !== key(wos[i]));
log(`  DATA DRIFT after round-trip: ${drift.length} rows changed (must be 0)`);
drift.slice(0, 3).forEach(d => log(`    DRIFT ${key(d)}`));
log(`  work_orders count: ${after.length} (was ${wos.length}) — NET ${after.length - wos.length}`);

fs.appendFileSync('C:/tmp/verify-results.txt', out.join('\n') + '\n\n');
await pool.end();
