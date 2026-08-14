import pool from './src/db/pool.js';
const t = await pool.query(`SELECT id FROM tenants WHERE slug='waterloo'`);
const tid = t.rows[0].id;
const r = await pool.query(`
  SELECT stage, COUNT(*) n,
    MIN(updated_at) min_upd, MAX(updated_at) max_upd,
    MIN(created_at) min_created, MAX(created_at) max_created,
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW()-updated_at))/86400),2) avg_days_upd,
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW()-created_at))/86400),2) avg_days_created
  FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL AND stage NOT IN ('sold','lost')
  GROUP BY stage ORDER BY n DESC`, [tid]);
console.table(r.rows.map(x=>({stage:x.stage,n:x.n,avg_days_upd:x.avg_days_upd,avg_days_created:x.avg_days_created,max_upd:String(x.max_upd).slice(0,19),min_upd:String(x.min_upd).slice(0,19)})));
console.log('NOW:', new Date().toISOString());
const c = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='leads' AND column_name ILIKE '%stage%' OR (table_name='leads' AND column_name ILIKE '%_at')`);
console.log('lead date/stage cols:', c.rows.map(x=>x.column_name).join(', '));
await pool.end();
