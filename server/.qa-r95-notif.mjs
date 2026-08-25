import pool from './src/db/pool.js';
const {rows:[t]}=await pool.query("SELECT id FROM tenants WHERE slug='waterloo'");
const {rows}=await pool.query(`SELECT count(*)::int total, count(*) FILTER (WHERE is_read) ::int rd, count(*) FILTER (WHERE NOT COALESCE(is_read,false))::int unrd FROM notifications WHERE tenant_id=$1`,[t.id]);
console.log('this tenant notifications:', JSON.stringify(rows[0]));
const {rows:g}=await pool.query(`SELECT count(*)::int total FROM notifications`);
console.log('all notifications:', JSON.stringify(g[0]));
await pool.end();
