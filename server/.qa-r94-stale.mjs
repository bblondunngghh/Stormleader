// The SELECT throws before the INSERT loop is reached -> zero writes either way.
import pool from './src/db/pool.js';
const before=(await pool.query(`SELECT count(*)::int n FROM notifications`)).rows[0].n;
console.log('notifications before:',before);
try{
  const m=await import('./src/services/notificationService.js');
  const r=await m.checkStaleLeads();
  console.log('checkStaleLeads() returned:',JSON.stringify(r));
}catch(e){
  console.log('*** THREW:',e.code,'-',e.message.slice(0,140));
  if(e.code==='22P02')console.log('    CONFIRMED 22P02 — invalid input value for enum notification_type');
}
const after=(await pool.query(`SELECT count(*)::int n FROM notifications`)).rows[0].n;
console.log('notifications after: ',after,after===before?'(0 net writes)':'*** WROTE ROWS');
console.log('distinct types present:',(await pool.query(`SELECT DISTINCT type::text t FROM notifications`)).rows.map(r=>r.t).join(', ')||'(none)');
await pool.end();
