// Run 66 s4 — READ-ONLY. Does the EstimatesView KPI scope bug reproduce today?
// The list fetches limit:50; the KPI cards derive from that page, while the
// "Total Estimates" card uses the server's full count. If any tenant holds >50
// estimates the row is provably self-inconsistent.
import pool from './src/db/pool.js';

const { rows } = await pool.query(`
  SELECT t.slug,
         COUNT(*)                                              AS total,
         COUNT(*) FILTER (WHERE e.status = 'accepted')         AS accepted,
         COUNT(*) FILTER (WHERE e.status IN ('sent','viewed')) AS sent,
         COUNT(*) FILTER (WHERE e.status = 'draft')            AS draft
    FROM estimates e JOIN tenants t ON t.id = e.tenant_id
   GROUP BY t.slug ORDER BY total DESC`);

console.log('estimates per tenant:');
for (const r of rows) {
  console.log(`  ${r.slug}: total=${r.total} accepted=${r.accepted} sent=${r.sent} draft=${r.draft}` +
    (Number(r.total) > 50 ? '   <-- EXCEEDS THE 50 PAGE SIZE: cards under-report' : ''));
}
if (!rows.length) console.log('  (none)');
await pool.end();
