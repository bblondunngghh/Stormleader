import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const q=async(l,s,p=[])=>{try{const r=await pool.query(s,p);console.log(l,JSON.stringify(r.rows).slice(0,800));}catch(e){console.log(l,'ERR',e.code,e.message.slice(0,90));}};
await q('leads touched today :',`SELECT count(*)::int n, min(updated_at) mn, max(updated_at) mx FROM leads WHERE tenant_id=$1 AND updated_at > '2026-08-28'`,[T]);
await q('total leads         :',`SELECT count(*)::int n FROM leads WHERE tenant_id=$1`,[T]);
await q('lead score cols     :',`SELECT column_name FROM information_schema.columns WHERE table_name='leads' AND (column_name ILIKE '%score%' OR column_name='updated_at')`);
await pool.end();
