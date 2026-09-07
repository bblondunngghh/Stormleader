import pool from './src/db/pool.js';
const tables = ['users','leads','estimates','tasks','activities','work_orders','contracts','invoices','expenses'];
const { rows } = await pool.query(
  `SELECT table_name, column_name FROM information_schema.columns
   WHERE table_schema='public' AND column_name='tenant_id' AND table_name = ANY($1)`, [tables]);
const have = new Set(rows.map(r=>r.table_name));
console.log('HAS tenant_id:', [...have].sort().join(', '));
console.log('MISSING tenant_id:', tables.filter(t=>!have.has(t)).join(', ') || '(none)');
const c = await pool.query(`SELECT (SELECT count(*) FROM leads) leads, (SELECT count(*) FROM tasks) tasks, (SELECT count(*) FROM activities) acts, (SELECT count(*) FROM work_orders) wos, (SELECT count(*) FROM estimates) ests, (SELECT count(*) FROM contracts) contracts, (SELECT count(*) FROM invoices) invs, (SELECT count(*) FROM expenses) exps`);
console.log('BASELINE COUNTS:', JSON.stringify(c.rows[0]));
const t = await pool.query(`SELECT id, slug FROM tenants ORDER BY slug`);
console.log('TENANTS:', JSON.stringify(t.rows));
await pool.end();
