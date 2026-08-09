// Run 71 — JSONB stored-shape survey. READ ONLY. Zero writes.
// Carried-forward priority #1: JSONB stores any shape verbatim, so a bad write
// persists and crashes a CONSUMER later. Find the bad shapes already stored.
import pool from './src/db/pool.js';

const COLS = [
  ['activities', 'metadata'], ['automations', 'action_config'], ['automations', 'trigger_config'],
  ['content_library', 'content'], ['contract_templates', 'content'], ['contracts', 'content'],
  ['county_data_sources', 'field_map'], ['custom_field_definitions', 'options'],
  ['documents', 'tags'], ['drip_sequence_steps', 'action_config'], ['drip_sequences', 'trigger_config'],
  ['estimates', 'financing_plan_ids'], ['estimates', 'insurance_details'], ['estimates', 'line_items'],
  ['estimates', 'upgrades'], ['financing_lenders', 'config'], ['invoices', 'line_items'],
  ['leads', 'custom_fields'], ['leads', 'lead_score_factors'], ['material_orders', 'items'],
  ['prospect_list_items', 'skip_trace_data'], ['roof_measurement_usage', 'raw_response'],
  ['storm_events', 'drift_vector_m'], ['storm_events', 'raw_data'],
  ['subscription_plans', 'features'], ['tenants', 'branding'], ['work_orders', 'line_items'],
];

function shape(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) {
    if (v.length === 0) return 'array(empty)';
    const kinds = [...new Set(v.map(e =>
      e === null ? 'NULL' : Array.isArray(e) ? 'array' : typeof e))];
    return `array[${kinds.sort().join('|')}] n=${v.length}`;
  }
  return typeof v;
}

// Element shapes that will break a consumer doing item.foo or item.map/join
function isDangerous(v) {
  if (Array.isArray(v)) {
    return v.some(e => e === null || typeof e === 'number' || typeof e === 'boolean'
      || (typeof e === 'string' && v.some(x => x && typeof x === 'object')));
  }
  return false;
}

const report = [];
for (const [table, col] of COLS) {
  let rs;
  try {
    rs = await pool.query(`SELECT id, ${col} AS v FROM ${table} WHERE ${col} IS NOT NULL`);
  } catch (e) {
    // some tables key on something other than id
    try { rs = await pool.query(`SELECT ${col} AS v FROM ${table} WHERE ${col} IS NOT NULL`); }
    catch (e2) { report.push({ table, col, error: e2.message.slice(0, 80) }); continue; }
  }
  const shapes = {};
  const bad = [];
  for (const r of rs.rows) {
    const s = shape(r.v);
    shapes[s] = (shapes[s] || 0) + 1;
    if (isDangerous(r.v)) bad.push({ id: r.id, shape: s, sample: JSON.stringify(r.v).slice(0, 160) });
  }
  report.push({ table, col, rows: rs.rows.length, shapes, bad });
}

console.log('='.repeat(78));
console.log('JSONB STORED-SHAPE SURVEY  (read only, 0 writes)');
console.log('='.repeat(78));
for (const r of report) {
  if (r.error) { console.log(`\n${r.table}.${r.col}  -- SKIP: ${r.error}`); continue; }
  if (r.rows === 0) { console.log(`\n${r.table}.${r.col}  (0 non-null rows)`); continue; }
  console.log(`\n${r.table}.${r.col}   rows=${r.rows}`);
  for (const [s, n] of Object.entries(r.shapes).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(4)}  ${s}`);
  }
  if (r.bad.length) {
    console.log(`    *** ${r.bad.length} DANGEROUS ROW(S):`);
    r.bad.slice(0, 6).forEach(b => console.log(`        id=${b.id}  ${b.shape}\n          ${b.sample}`));
  }
}
const totalBad = report.reduce((a, r) => a + ((r.bad && r.bad.length) || 0), 0);
console.log('\n' + '='.repeat(78));
console.log('TOTAL DANGEROUS STORED ROWS:', totalBad);
await pool.end();
