import pool from './src/db/pool.js';
const r = await pool.query(`
SELECT tc.table_name AS child, kcu.column_name AS col, ccu.table_name AS parent, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
JOIN information_schema.referential_constraints rc ON rc.constraint_name=tc.constraint_name
WHERE tc.constraint_type='FOREIGN KEY' AND ccu.table_name IN ('leads','estimates')
ORDER BY ccu.table_name, tc.table_name`);
for (const x of r.rows) console.log(`${x.parent} <- ${x.child}.${x.col}  ON DELETE ${x.delete_rule}`);
await pool.end();
