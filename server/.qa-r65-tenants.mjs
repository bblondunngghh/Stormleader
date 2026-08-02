import pool from './src/db/pool.js';
const q = async (sql,p=[]) => (await pool.query(sql,p)).rows;
const tenants = await q('SELECT id, name, slug FROM tenants ORDER BY created_at LIMIT 20');
console.log('TENANTS:', JSON.stringify(tenants,null,1));
await pool.end();
