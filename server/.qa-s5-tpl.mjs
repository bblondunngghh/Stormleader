import pool from './src/db/pool.js';
const c = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='contract_templates' ORDER BY ordinal_position`);
console.log('COLUMNS:', c.rows.map(r=>r.column_name).join(', '));
const r = await pool.query(`SELECT name, type, is_default, tenant_id FROM contract_templates ORDER BY is_default DESC, name`);
console.log('ROWS:', r.rowCount);
for (const x of r.rows) console.log(`  name=${JSON.stringify(x.name)} type=${JSON.stringify(x.type)} builtin=${x.is_default} tenant=${x.tenant_id ? 'scoped' : 'NULL(global)'}`);
await pool.end();
