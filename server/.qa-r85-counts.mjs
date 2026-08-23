// Row counts per tenant for the entity families the id-resolver failed to resolve.
// Purpose: distinguish "table is legitimately empty" from "the resolver query is wrong".
import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const tables = [
  'tasks', 'documents', 'contacts', 'drip_sequences', 'automations', 'notifications',
  'financing_applications', 'financing_plans', 'financing_lenders', 'contract_templates',
  'prospect_lists', 'payments', 'drip_sequence_steps', 'pipeline_stages', 'prospect_list_items',
  'estimates', 'leads', 'invoices', 'contracts', 'work_orders',
];
for (const t of tables) {
  try {
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [t]);
    if (!cols.rows.length) { console.log(`${t.padEnd(24)} NO SUCH TABLE`); continue; }
    const names = cols.rows.map(r => r.column_name);
    const all = await pool.query(`SELECT count(*)::int n FROM ${t}`);
    let scoped = 'n/a';
    if (names.includes('tenant_id')) {
      const s = await pool.query(`SELECT count(*)::int n FROM ${t} WHERE tenant_id=$1`, [T]);
      scoped = s.rows[0].n;
    }
    console.log(`${t.padEnd(24)} total=${String(all.rows[0].n).padEnd(6)} tenant=${String(scoped).padEnd(6)} created_at=${names.includes('created_at')}  id=${names.includes('id')}`);
  } catch (e) { console.log(`${t.padEnd(24)} ERR ${e.code} ${e.message.slice(0, 80)}`); }
}
await pool.end();
