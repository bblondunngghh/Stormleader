import pool from './src/db/pool.js';
const r = await pool.query(`SELECT estimate_number, tenant_id, created_at, updated_at, line_items FROM estimates WHERE estimate_number IN ('EST-082','EST-083') ORDER BY estimate_number, created_at`);
console.table(r.rows.map(x => ({ n: x.estimate_number, tenant: String(x.tenant_id).slice(0,8), created: String(x.created_at).slice(0,19), updated: String(x.updated_at).slice(0,19), items: JSON.stringify(x.line_items).slice(0,40) })));
const d = await pool.query(`SELECT estimate_number, COUNT(*)::int c, COUNT(DISTINCT tenant_id)::int t FROM estimates GROUP BY estimate_number HAVING COUNT(*)>1 ORDER BY c DESC LIMIT 5`);
console.log('duplicate estimate_numbers:'); console.table(d.rows);
await pool.end();
