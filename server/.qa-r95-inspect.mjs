import pool from './src/db/pool.js';
const id='f8a24416';
const {rows}=await pool.query(`SELECT id, status, completed_at, pg_typeof(line_items) AS ty, line_items::text AS raw, jsonb_typeof(line_items) AS jty FROM work_orders WHERE id::text LIKE $1||'%'`,[id]);
for(const r of rows) console.log(JSON.stringify({id:r.id,status:r.status,completed_at:r.completed_at,ty:r.ty,jty:r.jty,raw:String(r.raw).slice(0,300)},null,1));
console.log('--- notifications columns ---');
const {rows:c}=await pool.query(`SELECT column_name,data_type FROM information_schema.columns WHERE table_name='notifications' ORDER BY ordinal_position`);
console.log(c.map(x=>x.column_name+':'+x.data_type).join(', '));
await pool.end();
