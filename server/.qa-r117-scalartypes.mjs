// Run 117 s1 — NEW DIMENSION: SCALAR (non-jsonb) COLUMN TYPE CONFUSION.
// Run 114 closed jsonb container columns. Every OTHER pg type reachable from a
// PATCH body is unmeasured: numeric, int4, bool, date, timestamptz, time, uuid,
// text[] and the five pg ENUMs. A type-invalid value must produce 4xx, never 5xx.
// Method: snapshot the row -> PATCH ONE field with ONE bad value -> read the column
// back -> revert if it moved. Also snapshots side-effect tables and updated_at.
import fs from 'fs';
import pool from './src/db/pool.js';
const BASE = 'http://localhost:3001';
const T = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const I = JSON.parse(fs.readFileSync('C:/tmp/qa-r117-ids.json', 'utf8'));
const TY = JSON.parse(fs.readFileSync('C:/tmp/qa-r117-coltypes.json', 'utf8'));

const req = async (m, p, b) => {
  const r = await fetch(BASE + p, {
    method: m,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T },
    body: b === undefined ? undefined : JSON.stringify(b),
  });
  return { st: r.status, body: (await r.text()).slice(0, 300) };
};

const TARGETS = [
  { n: 'crm.lead', m: 'PATCH', p: '/api/crm/leads/' + I.lead, table: 'leads', id: I.lead,
    f: ['stage', 'priority', 'estimated_value', 'actual_value', 'insurance_company', 'insurance_claim_number',
      'contact_name', 'contact_phone', 'contact_email', 'damage_notes', 'assigned_rep_id', 'source', 'tags',
      'notes', 'next_follow_up', 'lost_reason', 'custom_fields'] },
  { n: 'core.lead', m: 'PATCH', p: '/api/leads/' + I.lead, table: 'leads', id: I.lead,
    f: ['stage', 'priority', 'estimated_value', 'insurance_company', 'insurance_claim_number',
      'contact_name', 'contact_phone', 'contact_email', 'damage_notes', 'assigned_rep_id'] },
  { n: 'task', m: 'PATCH', p: '/api/crm/tasks/' + I.task, table: 'tasks', id: I.task,
    f: ['title', 'description', 'due_date', 'assigned_to', 'priority', 'completed_at', 'status'] },
  { n: 'estimate', m: 'PATCH', p: '/api/estimates/' + I.estimate, table: 'estimates', id: I.estimate,
    f: ['lead_id', 'customer_name', 'customer_address', 'customer_phone', 'customer_email', 'tax_rate',
      'discount_type', 'discount_value', 'scope_of_work', 'terms', 'warranty_info', 'notes', 'valid_until',
      'status', 'financing_enabled', 'estimate_name', 'estimate_date', 'introduction', 'inspection_notes',
      'footer_notes', 'profit_margin', 'discounts', 'signers', 'deposit'] },
  { n: 'invoice', m: 'PATCH', p: '/api/crm/invoices/' + I.invoice, table: 'invoices', id: I.invoice,
    f: ['subtotal', 'tax_rate', 'tax_amount', 'total', 'due_date', 'notes', 'status', 'lead_id'] },
  { n: 'workOrder', m: 'PATCH', p: '/api/crm/work-orders/' + I.workOrder, table: 'work_orders', id: I.workOrder,
    f: ['title', 'description', 'status', 'lead_id', 'assigned_to', 'crew_name', 'scheduled_date',
      'scheduled_time_start', 'scheduled_time_end', 'notes'] },
  { n: 'contract', m: 'PATCH', p: '/api/crm/contracts/' + I.contract, table: 'contracts', id: I.contract,
    f: ['lead_id', 'estimate_id', 'template_type'] },
  { n: 'expense', m: 'PATCH', p: '/api/crm/expenses/' + I.expense, table: 'expenses', id: I.expense,
    f: ['lead_id', 'category', 'amount', 'date', 'notes'] },
  { n: 'subcontr', m: 'PATCH', p: '/api/crm/subcontractors/' + I.subcontractor, table: 'subcontractors', id: I.subcontractor,
    f: ['name', 'company', 'phone', 'email', 'specialty', 'hourly_rate', 'notes', 'status'] },
];

// bad values chosen so pg CANNOT accept them for the target type
const BAD_BY_TYPE = {
  numeric: [['str', 'abc'], ['obj', { a: 1 }], ['arr', [1, 2]], ['bool', true]],
  int4: [['str', 'abc'], ['obj', { a: 1 }], ['arr', [1, 2]], ['bool', true]],
  bool: [['str', 'maybe'], ['obj', { a: 1 }], ['arr', [1, 2]], ['num', 42]],
  date: [['str', 'not-a-date'], ['obj', { a: 1 }], ['arr', [1, 2]], ['num', 42]],
  timestamptz: [['str', 'not-a-date'], ['obj', { a: 1 }], ['arr', [1, 2]], ['num', 42]],
  time: [['str', 'not-a-time'], ['obj', { a: 1 }], ['arr', [1, 2]], ['num', 42]],
  uuid: [['str', 'abc'], ['obj', { a: 1 }], ['arr', [1, 2]], ['num', 42]],
  _text: [['str', 'plain'], ['obj', { a: 1 }], ['num', 42]],
  varchar: [['obj', { a: 1 }], ['arr', [1, 2]], ['num', 42], ['bool', true]],
  text: [['obj', { a: 1 }], ['arr', [1, 2]], ['num', 42], ['bool', true]],
  jsonb: [['str', 'oops'], ['num', 42]], // regression check for f7bb323
};
const ENUMS = { lead_stage: 1, lead_priority: 1, invoice_status: 1, work_order_status: 1, notification_type: 1 };

const litFor = (udt, v) => {
  if (udt === '_text' && Array.isArray(v)) return v;
  if (udt === 'jsonb' || udt === 'json') return v === null ? null : JSON.stringify(v);
  if (v && typeof v === 'object' && !Array.isArray(v)) return JSON.stringify(v);
  return v;
};

const snapRow = async (t, id, cols) => (await pool.query(
  'SELECT ' + cols.map((c) => '"' + c + '"').join(',') + ', updated_at FROM ' + t + ' WHERE id=$1', [id])).rows[0];

const restoreCol = async (t, id, col, udt, val) => {
  await pool.query('UPDATE ' + t + ' SET "' + col + '"=$2 WHERE id=$1', [id, litFor(udt, val)]);
};

const SIDE = ['activities', 'notifications', 'tasks', 'automation_runs', 'lead_stage_history'];
const sideSnap = async () => {
  const o = {};
  for (const t of SIDE) {
    try { o[t] = (await pool.query('SELECT count(*)::int c FROM ' + t)).rows[0].c; } catch { o[t] = 'n/a'; }
  }
  return o;
};

const results = []; const fivexx = []; const accepted = [];
const before = await sideSnap();

for (const tg of TARGETS) {
  if (!tg.id) { results.push({ e: tg.n, skip: 'no fixture id' }); continue; }
  const cols = TY[tg.table] || {};
  const present = tg.f.filter((f) => cols[f]);
  const missing = tg.f.filter((f) => !cols[f]);
  const orig = await snapRow(tg.table, tg.id, present);
  if (!orig) { results.push({ e: tg.n, skip: 'row not found' }); continue; }
  const origUpd = orig.updated_at;
  for (const field of present) {
    const udt = cols[field];
    const isEnum = !!ENUMS[udt];
    const bads = isEnum
      ? [['str', 'bogus_enum_value'], ['obj', { a: 1 }], ['arr', [1, 2]], ['num', 42]]
      : (BAD_BY_TYPE[udt] || [['obj', { a: 1 }], ['num', 42]]);
    for (const [kind, val] of bads) {
      let r;
      try { r = await req(tg.m, tg.p, { [field]: val }); }
      catch (e) { r = { st: 'THREW', body: String(e).slice(0, 200) }; }
      const after = await snapRow(tg.table, tg.id, present);
      const moved = JSON.stringify(after[field]) !== JSON.stringify(orig[field]);
      const rec = { e: tg.n, field, udt: isEnum ? 'enum(' + udt + ')' : udt, bad: kind, st: r.st, moved };
      if (r.st >= 500 || r.st === 'THREW') { rec.err = r.body; fivexx.push(rec); }
      if (r.st < 400 && moved) { rec.stored = JSON.stringify(after[field]).slice(0, 60); accepted.push(rec); }
      results.push(rec);
      if (moved) await restoreCol(tg.table, tg.id, field, udt, orig[field]);
    }
  }
  try { await pool.query('UPDATE ' + tg.table + ' SET updated_at=$2 WHERE id=$1', [tg.id, origUpd]); } catch {}
  const final = await snapRow(tg.table, tg.id, present);
  const dirty = present.filter((c) => JSON.stringify(final[c]) !== JSON.stringify(orig[c]));
  results.push({ e: tg.n, RESTORED: dirty.length === 0, dirty, fieldsProbed: present.length, notColumns: missing });
}
const after = await sideSnap();
const drift = Object.keys(before).filter((t) => before[t] !== after[t]).map((t) => t + ': ' + before[t] + '->' + after[t]);

const out = { total: results.filter((r) => r.st !== undefined).length, fivexx, accepted, drift, before, after, results };
fs.writeFileSync('C:/tmp/qa-r117-scalartypes.json', JSON.stringify(out, null, 1));
console.log('REQUESTS:', out.total);
console.log('5xx / THREW:', fivexx.length);
console.log('ACCEPTED-BUT-WRONG (2xx + column moved):', accepted.length);
console.log('SIDE-TABLE ROW DRIFT:', drift.length ? drift.join(' | ') : 'none');
const byStatus = {};
for (const r of results) if (r.st !== undefined) byStatus[r.st] = (byStatus[r.st] || 0) + 1;
console.log('status histogram:', JSON.stringify(byStatus));
console.log('RESTORE:', results.filter((r) => r.RESTORED !== undefined)
  .map((r) => r.e + ':' + (r.RESTORED ? 'ok' : 'DIRTY ' + r.dirty)).join(' '));
console.log('SKIPS:', results.filter((r) => r.skip).map((r) => r.e + ':' + r.skip).join(' ') || 'none');
if (fivexx.length) {
  console.log('\n--- 5xx DETAIL ---');
  for (const f of fivexx) console.log(f.e + '.' + f.field + ' [' + f.udt + '] <-' + f.bad + '  ' + f.st + '  ' + (f.err || '').replace(/\s+/g, ' ').slice(0, 160));
}
if (accepted.length) {
  console.log('\n--- ACCEPTED-BUT-WRONG ---');
  for (const f of accepted) console.log(f.e + '.' + f.field + ' [' + f.udt + '] <-' + f.bad + '  stored ' + f.stored);
}
await pool.end();
