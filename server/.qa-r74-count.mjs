import pool from './src/db/pool.js';
const q = async (s,p=[]) => (await pool.query(s,p)).rows;
const [a] = await q('SELECT COUNT(*)::int AS n, MAX(created_at) AS newest FROM properties');
console.log('properties:', a.n, 'newest:', a.newest);
const recent = await q("SELECT COUNT(*)::int AS n FROM properties WHERE created_at > NOW() - INTERVAL '30 minutes'");
console.log('created in last 30 min:', recent[0].n);
await pool.end();
