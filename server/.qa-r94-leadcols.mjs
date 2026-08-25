import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const c=(await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='leads' ORDER BY 1`)).rows.map(r=>r.column_name);
console.log('lead cols matching assign/follow/next:', c.filter(x=>/assign|follow|next|contact/i.test(x)).join(', '));
const q=async(l,s)=>{try{console.log(l, (await pool.query(s,[T])).rows[0].n);}catch(e){console.log(l,'ERR',e.code,e.message.slice(0,60));}};
await q('total leads:            ',`SELECT count(*)::int n FROM leads WHERE tenant_id=$1`);
await q('assigned_to IS NULL:    ',`SELECT count(*)::int n FROM leads WHERE tenant_id=$1 AND assigned_to IS NULL`);
await q('next_followup_at <= now:',`SELECT count(*)::int n FROM leads WHERE tenant_id=$1 AND next_followup_at <= now()`);
await pool.end();
