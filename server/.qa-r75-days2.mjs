import pool from './src/db/pool.js';
const t = await pool.query(`SELECT id FROM tenants WHERE slug='waterloo'`);
const tid = t.rows[0].id;
const r = await pool.query(`
  SELECT to_char(updated_at,'YYYY-MM-DD HH24:MI:SS.MS') upd, COUNT(*) n
  FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL
  GROUP BY updated_at ORDER BY updated_at DESC LIMIT 12`, [tid]);
console.table(r.rows);
const all = await pool.query(`SELECT COUNT(*) n, MIN(updated_at) mn, MAX(updated_at) mx FROM leads WHERE deleted_at IS NULL`);
console.log('ALL TENANTS leads:', JSON.stringify(all.rows[0]));
const sc = await pool.query(`SELECT COUNT(*) n, COUNT(lead_score_updated_at) scored, MIN(lead_score_updated_at) mn, MAX(lead_score_updated_at) mx FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL`,[tid]);
console.log('score col:', JSON.stringify(sc.rows[0]));
await pool.end();
