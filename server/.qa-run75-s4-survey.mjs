// Run 75 s4 — READ-ONLY survey of QA residue before any cleanup.
// Nothing here writes. Purpose: enumerate exactly what would be deleted, and find
// every foreign key that references those rows so a scoped DELETE cannot cascade
// into real user data.  NOTE: leads uses contact_name (no first/last) and has a
// deleted_at soft-delete column.
import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const q = async (sql, p = []) => (await pool.query(sql, p)).rows;
const show = (label, rows) => {
  console.log(`\n== ${label} (${rows.length}) ==`);
  console.log(JSON.stringify(rows, null, 1).slice(0, 5000));
};

show('LEADS — total, live vs soft-deleted', await q(
  `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE deleted_at IS NULL)::int AS live,
          count(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS soft_deleted
   FROM leads WHERE tenant_id=$1`, [T]));

show('LEADS — fuzz/probe residue (live only)', await q(
  `SELECT id, contact_name, address, city, stage, priority, source, created_at
   FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL AND (
        address IN ('true','12345','{"nested":{"deep":1}}','{"x","y"}')
     OR address ~ '^[{]'
     OR contact_name ILIKE 'QA%' OR contact_name ILIKE '%Probe%'
     OR contact_name ILIKE '%qa2026%' OR city ILIKE 'QA%'
   ) ORDER BY created_at`, [T]));

show('LEADS — every distinct address that is not street-like (live)', await q(
  `SELECT address, count(*)::int AS n FROM leads
   WHERE tenant_id=$1 AND deleted_at IS NULL
     AND (address IS NULL OR address !~ '[0-9]+ +[A-Za-z]')
   GROUP BY address ORDER BY n DESC`, [T]));

show('ESTIMATES created today', await q(
  `SELECT id, estimate_number, status, total, customer_name, lead_id, created_at
   FROM estimates WHERE tenant_id=$1 AND created_at>'2026-08-14' ORDER BY created_at`, [T]));
show('INVOICES created today', await q(
  `SELECT id, invoice_number, status, total, lead_id, created_at
   FROM invoices WHERE tenant_id=$1 AND created_at>'2026-08-14' ORDER BY created_at`, [T]));

show('TASKS — QA residue', await q(
  `SELECT id, title, priority, status, created_at FROM tasks
   WHERE tenant_id=$1 AND (title ILIKE '%QA%' OR title ILIKE '%probe%') ORDER BY created_at`, [T]));
show('TASKS — priority values in use', await q(
  `SELECT priority, count(*)::int AS n FROM tasks WHERE tenant_id=$1 GROUP BY 1 ORDER BY 2 DESC`, [T]));

for (const [tbl, col] of [['work_orders','title'],['contracts','template_type'],['expenses','notes'],['subcontractors','name']]) {
  show(`${tbl} created today`, await q(
    `SELECT id, ${col} AS label, created_at FROM ${tbl}
     WHERE tenant_id=$1 AND created_at>'2026-08-14' ORDER BY created_at LIMIT 30`, [T]));
}

show('FKs referencing estimates/invoices/leads', await q(
  `SELECT tc.table_name AS from_table, kcu.column_name AS from_col,
          ccu.table_name AS to_table, rc.delete_rule
   FROM information_schema.table_constraints tc
   JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
   JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
   JOIN information_schema.referential_constraints rc ON tc.constraint_name=rc.constraint_name
   WHERE tc.constraint_type='FOREIGN KEY'
     AND ccu.table_name IN ('estimates','invoices','leads')
   ORDER BY ccu.table_name, tc.table_name`));

await pool.end();
