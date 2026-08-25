import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const q=async(l,s)=>{try{console.log(l,(await pool.query(s,[T])).rows[0].n);}catch(e){console.log(l,'ERR',e.code);}};
await q('total:                        ',`SELECT count(*)::int n FROM leads WHERE tenant_id=$1`);
await q('assigned_rep_id IS NULL:      ',`SELECT count(*)::int n FROM leads WHERE tenant_id=$1 AND assigned_rep_id IS NULL`);
await q('next_follow_up <= now():      ',`SELECT count(*)::int n FROM leads WHERE tenant_id=$1 AND next_follow_up <= now()`);
await q('next_follow_up IS NOT NULL:   ',`SELECT count(*)::int n FROM leads WHERE tenant_id=$1 AND next_follow_up IS NOT NULL`);
await pool.end();
