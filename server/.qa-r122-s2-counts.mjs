import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const t=['leads','tasks','estimates','invoices','work_orders','contracts','expenses','subcontractors'];
const o={};
for(const x of t){try{o[x]=(await pool.query(`SELECT count(*)::int c FROM ${x} WHERE tenant_id=$1`,[T])).rows[0].c;}catch(e){o[x]='ERR:'+e.code;}}
console.log(JSON.stringify(o));
await pool.end();
