import pool from './src/db/pool.js';
const e=(await pool.query(`SELECT t.typname tn, e.enumlabel l FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid ORDER BY t.typname, e.enumsortorder`)).rows;
const M={}; for(const r of e){(M[r.tn] ||= []).push(r.l);}
for(const k of Object.keys(M)) console.log(' ',k+':',M[k].join('|'));
console.log('\n=== the 4 real enum-column call sites ===');
const CHECKS=[
 ['work_order_status',['completed'],'workOrderService.js:212,392  status != / SET status ='],
 ['invoice_status',['sent'],'invoiceService.js:156  SET status = '],
 ['notification_type',['stale_lead'],'notificationService.js:189  n.type = '],
 ['activity_type',['call','email','text','door_knock'],'leadService.js:198,199  a.type IN (...)'],
];
let bad=0;
for(const [t,lits,where] of CHECKS){
  const labels=M[t]||[];
  const missing=lits.filter(l=>!labels.includes(l));
  console.log(`  ${missing.length?'*** 22P02 RISK':'ok           '}  ${t}  literals=[${lits.join(',')}]  missing=[${missing.join(',')}]  <- ${where}`);
  if(missing.length)bad++;
}
console.log('\nreal 22P02 risks found:',bad);
await pool.end();
