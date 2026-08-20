import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const r=await pool.query(`SELECT id,title,status,completed_at,created_at FROM tasks WHERE tenant_id=$1 ORDER BY created_at`,[T]);
r.rows.forEach(x=>console.log(x.title.padEnd(24), 'status=',String(x.status).padEnd(10),'completed_at=',x.completed_at));
console.log('--- status enum ---');
const e=await pool.query(`SELECT column_name,data_type,udt_name FROM information_schema.columns WHERE table_name='tasks' AND column_name IN ('status','completed_at','priority')`);
console.log(JSON.stringify(e.rows));
await pool.end();
