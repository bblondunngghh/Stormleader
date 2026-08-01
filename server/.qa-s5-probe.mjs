import pool from './src/db/pool.js';
const r = await pool.query(`SELECT id, name, type FROM contract_templates WHERE name LIKE 'zz-s5-probe%'`);
console.log('probe rows remaining:', r.rowCount);
for (const x of r.rows) console.log('   ', x.name, '| type =', JSON.stringify(x.type), '| id', x.id);
const all = await pool.query(`SELECT count(*)::int n FROM contract_templates`);
console.log('total contract_templates:', all.rows[0].n);
await pool.end();
