// Run 76 s1 — assess exactly what the empty-body write sweep mutated. READ ONLY.
import pool from './src/db/pool.js';
const q = async (s, p) => (await pool.query(s, p)).rows;

const since = `NOW() - INTERVAL '30 minutes'`;

console.log('=== ROWS CREATED IN THE LAST 30 MIN ===');
for (const t of ['estimates', 'invoices', 'work_orders', 'contracts', 'leads', 'notifications',
  'tasks', 'expenses', 'work_order_milestones', 'activities']) {
  try {
    const r = await q(`SELECT COUNT(*)::int n FROM ${t} WHERE created_at > ${since}`);
    if (r[0].n) console.log(`  ${t.padEnd(24)} ${r[0].n} new`);
  } catch (e) { console.log(`  ${t}: ${e.code}`); }
}

console.log('\n=== ROWS UPDATED IN THE LAST 30 MIN ===');
for (const t of ['estimates', 'invoices', 'work_orders', 'contracts', 'leads', 'tenants',
  'work_order_milestones', 'notifications']) {
  try {
    const r = await q(`SELECT COUNT(*)::int n FROM ${t} WHERE updated_at > ${since}`);
    if (r[0].n) console.log(`  ${t.padEnd(24)} ${r[0].n} updated`);
  } catch (e) { console.log(`  ${t}: ${e.code}`); }
}

console.log('\n=== THE CONTRACT I VOIDED ===');
console.log(await q(`SELECT id, contract_number, status, updated_at FROM contracts
                     WHERE id = '9f5aea47-9c97-4c98-9358-0205e3f41867'`));

console.log('\n=== THE WORK ORDER I COMPLETED ===');
console.log(await q(`SELECT id, wo_number, status, updated_at FROM work_orders
                     WHERE id = '9c1794cc-793d-447d-90dc-2807566fe749'`));

console.log('\n=== NEW estimates/invoices/work_orders detail ===');
console.log(await q(`SELECT id, estimate_number, status, created_at FROM estimates WHERE created_at > ${since} ORDER BY created_at`));
console.log(await q(`SELECT id, invoice_number, status, total, created_at FROM invoices WHERE created_at > ${since} ORDER BY created_at`));
console.log(await q(`SELECT id, wo_number, status, created_at FROM work_orders WHERE created_at > ${since} ORDER BY created_at`));

console.log('\n=== tenant settings / branding sanity (PUT with empty body) ===');
console.log(await q(`SELECT id, name, slug, updated_at,
    (branding IS NULL) AS branding_null,
    COALESCE(jsonb_typeof(branding),'-') AS branding_type,
    CASE WHEN branding IS NOT NULL THEN (SELECT COUNT(*)::int FROM jsonb_object_keys(branding)) ELSE 0 END AS branding_keys
  FROM tenants ORDER BY updated_at DESC NULLS LAST LIMIT 5`));

console.log('\n=== notifications read-state ===');
console.log(await q(`SELECT read_at IS NULL AS unread, COUNT(*)::int n FROM notifications GROUP BY 1`));
await pool.end();
