import pool from './src/db/pool.js';
const r=await pool.query(`SELECT column_name,data_type,udt_name,is_nullable FROM information_schema.columns WHERE table_name='activities' ORDER BY ordinal_position`);
console.log('activities columns:');
for(const x of r.rows) console.log('  ', x.column_name.padEnd(20), x.udt_name, x.is_nullable==='NO'?'NOT NULL':'');
await pool.end();
