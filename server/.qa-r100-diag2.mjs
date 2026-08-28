import pool from './src/db/pool.js';
const WO='5b9b4ed9-2b8e-467c-a4bf-0251550c0f66';
const q=async(l,s,p=[])=>{try{const r=await pool.query(s,p);console.log(l,JSON.stringify(r.rows).slice(0,900));}catch(e){console.log(l,'ERR',e.code,e.message.slice(0,90));}};
await q('enum labels :',`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='work_order_status' ORDER BY enumsortorder`);
await q('wo cols     :',`SELECT column_name FROM information_schema.columns WHERE table_name='work_orders' ORDER BY ordinal_position`);
await q('ms cols     :',`SELECT column_name FROM information_schema.columns WHERE table_name='work_order_milestones' ORDER BY ordinal_position`);
await q('the WO      :',`SELECT id,status,completed_at,created_at,updated_at FROM work_orders WHERE id=$1`,[WO]);
await q('activities  :',`SELECT activity_type,description,created_at FROM activities WHERE description ILIKE '%work order%' ORDER BY created_at DESC LIMIT 5`);
await pool.end();
