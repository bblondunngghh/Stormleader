// Run 85 s5: verify DB hygiene after Run 84's capped stages.
import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';

console.log('=== EST-001 (s1 declined it; pre-state was "viewed") ===');
const est = await pool.query(
  `SELECT estimate_number, status, viewed_at IS NOT NULL AS seen, updated_at
     FROM estimates WHERE tenant_id=$1 AND estimate_number='EST-001'`, [T]);
console.table(est.rows);

console.log('=== work_orders most recently touched ===');
const wo = await pool.query(
  `SELECT id, status, completed_at, updated_at FROM work_orders
     WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 4`, [T]);
console.table(wo.rows.map(r => ({ id: r.id.slice(0, 8), status: r.status, completed_at: r.completed_at, updated_at: r.updated_at })));

console.log('=== rows created in the last 3 hours (QA sweep window) ===');
for (const t of ['estimates', 'invoices', 'work_orders', 'leads', 'contracts', 'tasks', 'canvass_pins', 'activities']) {
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int c FROM ${t} WHERE tenant_id=$1 AND created_at > now() - interval '3 hours'`, [T]);
    if (rows[0].c > 0) console.log(`  ${t}: ${rows[0].c} NEW ROWS`);
  } catch (e) { console.log(`  ${t}: ERR ${e.code}`); }
}

console.log('=== rows whose name looks like QA junk ===');
for (const [t, col] of [['leads', 'first_name'], ['subcontractors', 'name'], ['materials', 'name']]) {
  try {
    const { rows } = await pool.query(
      `SELECT id, ${col} AS v FROM ${t} WHERE tenant_id=$1 AND (${col} ILIKE '%bar%' OR ${col} ILIKE '%foo%' OR ${col} ILIKE '%qa%' OR ${col} ILIKE '%test%') LIMIT 6`, [T]);
    if (rows.length) rows.forEach(r => console.log(`  ${t}.${col}: ${r.id.slice(0, 8)} = ${JSON.stringify(r.v)}`));
  } catch (e) { console.log(`  ${t}: ERR ${e.code}`); }
}

console.log('=== lead stages (s2 flipped one to on_hold/lost, then reverted) ===');
const st = await pool.query(
  `SELECT stage, count(*)::int c FROM leads WHERE tenant_id=$1 GROUP BY stage ORDER BY c DESC`, [T]);
console.table(st.rows);

await pool.end();
