import pool from './src/db/pool.js';
const q=`SELECT '%s' AS t, COUNT(*)::int c FROM %s WHERE created_at >= '2026-09-07 00:00:00'`;
for(const x of ['leads','subcontractors','tasks','activities','estimates','work_orders','invoices','expenses','users','documents']){
 try{const r=await pool.query(`SELECT COUNT(*)::int c FROM ${x} WHERE created_at >= '2026-09-07 00:00:00'`);
 if(r.rows[0].c>0) console.log('WROTE TONIGHT:',x,r.rows[0].c); }catch(e){}
}
console.log('(no lines above = zero rows created 2026-09-07)');
await pool.end();
