import pool from './src/db/pool.js';
const q = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='skip_trace_usage' ORDER BY ordinal_position`);
console.log('skip_trace_usage columns:'); q.rows.forEach(r=>console.log('  ',r.column_name, r.data_type));
const c = await pool.query(`SELECT tenant_id, job_id, provider, records_requested, records_returned, created_at FROM skip_trace_usage ORDER BY created_at DESC LIMIT 10`);
console.log('rows:', c.rowCount); c.rows.forEach(r=>console.log('  ', JSON.stringify(r)));
const t = await pool.query(`SELECT id, slug FROM tenants ORDER BY created_at LIMIT 5`);
console.log('tenants:'); t.rows.forEach(r=>console.log('  ', r.id, r.slug));
await pool.end();
