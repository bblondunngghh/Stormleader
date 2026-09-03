import pool from './src/db/pool.js';
const t = (await pool.query("select id from tenants where slug='waterloo'")).rows[0].id;
const r = await pool.query(
 `select extract(day from now()-updated_at)::int d, count(*)::int c
    from leads where tenant_id=$1 group by d order by d desc limit 6`,[t]);
console.log('days_stale buckets (desc):');
r.rows.forEach(x=>console.log('   ', x.d+'d', '->', x.c, 'leads'));
const top = await pool.query(
 `select count(*)::int c from leads where tenant_id=$1
   and extract(day from now()-updated_at)::int = (select max(extract(day from now()-updated_at)::int) from leads where tenant_id=$1)`,[t]);
console.log('leads tied in the MAX days_stale bucket:', top.rows[0].c);
await pool.end();
