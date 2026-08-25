import pool from './src/db/pool.js';
const r=await pool.query(`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='lead_stage' ORDER BY e.enumsortorder`);
const vals=r.rows.map(x=>x.enumlabel);
console.log('lead_stage enum ('+vals.length+'):',vals.join(', '));
for(const v of ['closed_won','closed_lost','sold','lost']) console.log(`  '${v}' in enum? ${vals.includes(v)}`);
await pool.end();
