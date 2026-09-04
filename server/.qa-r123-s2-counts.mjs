import pool from './src/db/pool.js';
const t=['leads','estimates','invoices','work_orders','tasks','contracts','expenses','subcontractors','activities','documents','payments','materials_orders','notifications'];
const out={};
for(const x of t){ try{ out[x]=(await pool.query(`SELECT count(*)::int c FROM ${x}`)).rows[0].c; }catch(e){ out[x]='ERR:'+e.code; } }
console.log(JSON.stringify(out));
await pool.end();
