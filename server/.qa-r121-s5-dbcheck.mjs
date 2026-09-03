import pool from './src/db/pool.js';
const ID = 'a85b7ae6-3004-49fb-9f20-62f38fed3d39';
const r = await pool.query('select id, title, scheduled_time_start, scheduled_time_end, updated_at from work_orders where id=$1',[ID]);
const row = r.rows[0];
console.log('probed row:', JSON.stringify(row));
console.log(row && String(row.scheduled_time_start)==='00:30:00' && row.updated_at.toISOString()==='2026-08-20T10:03:44.830Z'
  ? 'REVERT CONFIRMED - row byte-identical to pre-probe state'
  : 'REVERT NOT CONFIRMED');
console.log('work_orders total:', (await pool.query("select count(*)::int c from work_orders")).rows[0].c);
console.log("junk work_orders:", (await pool.query("select count(*)::int c from work_orders where title ilike 'qa-r%' or title ilike 'qa\_%'")).rows[0].c);
await pool.end();
