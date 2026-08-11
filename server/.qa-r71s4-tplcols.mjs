import pool from './src/db/pool.js';
console.log((await pool.query(`select column_name from information_schema.columns where table_name='contract_templates' order by ordinal_position`)).rows.map(r=>r.column_name).join(', '));
console.log((await pool.query(`select id,name,type,tenant_id is null as global from contract_templates`)).rows.map(r=>`${r.id.slice(0,8)} ${r.type} global=${r.global}`).join('\n'));
await pool.end();
