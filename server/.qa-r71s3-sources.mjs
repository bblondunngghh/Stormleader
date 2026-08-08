import pool from './src/db/pool.js';
const t = '791bb51d-4a37-4a0e-8f2f-0e9f7a3b5c21';
const r = await pool.query(`SELECT source, count(*)::int n FROM leads GROUP BY source ORDER BY n DESC`);
console.log('ALL TENANTS leads.source distribution:');
console.table(r.rows);
await pool.end();
