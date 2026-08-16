// Run 76 s5 — READ ONLY. Confirm what QA residue is still in the DB so the
// report states facts, not guesses. Contains no INSERT/UPDATE/DELETE.
import pool from './src/db/pool.js';

const q = async (label, sql, params = []) => {
  try {
    const r = await pool.query(sql, params);
    console.log(`--- ${label} ---`);
    if (!r.rows.length) console.log('   (none)');
    else r.rows.forEach(row => console.log('   ' + JSON.stringify(row)));
  } catch (e) {
    console.log(`--- ${label} --- ERROR ${e.code || ''} ${e.message.slice(0, 120)}`);
  }
};

console.log('=== s1 EMPTY-BODY WRITE SWEEP WINDOW (2026-08-15 05:00-05:15 local) ===');
for (const t of ['estimates', 'invoices', 'work_orders', 'work_order_milestones', 'contracts', 'leads', 'tasks', 'notifications']) {
  await q(`${t}: created in window`,
    `SELECT count(*)::int AS n FROM ${t} WHERE created_at >= '2026-08-15 09:55:00+00' AND created_at <= '2026-08-15 10:20:00+00'`);
}
for (const t of ['estimates', 'invoices', 'work_orders', 'contracts', 'leads', 'tenants']) {
  await q(`${t}: updated in window (not created then)`,
    `SELECT count(*)::int AS n FROM ${t} WHERE updated_at >= '2026-08-15 09:55:00+00' AND updated_at <= '2026-08-15 10:20:00+00'`);
}

console.log('\n=== THE CONTRACT s1 VOIDED ===');
await q('contract 9f5aea47 status',
  `SELECT id, status, updated_at FROM contracts WHERE id = '9f5aea47-9c97-4c98-9358-0205e3f41867'`);

console.log('\n=== s2 PROBE TASK (never deleted — no DELETE route exists) ===');
await q('tasks LIKE QA%', `SELECT id, title, priority, status, created_at FROM tasks WHERE title ILIKE 'QA%' OR title ILIKE '%probe%' ORDER BY created_at DESC LIMIT 20`);

console.log('\n=== STANDING FUZZ RESIDUE IN LEADS (carried from Run 75) ===');
await q('leads with junk addresses',
  `SELECT id, first_name, last_name, address, stage FROM leads
   WHERE address IN ('true','12345','True') OR address LIKE '{%'
      OR first_name ILIKE 'QA%' OR first_name ILIKE 'Probe%' OR last_name ILIKE '%Probe%'
   ORDER BY created_at DESC LIMIT 40`);

console.log('\n=== NEW ESTIMATES/INVOICES/WORK ORDERS FROM THE SWEEP (identifying detail) ===');
await q('recent estimates', `SELECT id, estimate_number, status, total, created_at FROM estimates ORDER BY created_at DESC LIMIT 8`);
await q('recent invoices', `SELECT id, invoice_number, status, total, created_at FROM invoices ORDER BY created_at DESC LIMIT 5`);
await q('recent work orders', `SELECT id, wo_number, status, created_at FROM work_orders ORDER BY created_at DESC LIMIT 5`);

await pool.end();
