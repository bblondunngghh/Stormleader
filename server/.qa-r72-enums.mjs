import pool from './src/db/pool.js';
const { rows } = await pool.query(`
  SELECT t.typname, string_agg(e.enumlabel, '|' ORDER BY e.enumsortorder) AS labels
  FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
  GROUP BY t.typname ORDER BY t.typname`);
for (const r of rows) console.log(r.typname.padEnd(26), '=', r.labels);
const cols = await pool.query(`
  SELECT table_name, column_name, udt_name FROM information_schema.columns
  WHERE table_schema='public' AND data_type='USER-DEFINED' ORDER BY table_name, column_name`);
console.log('--- enum columns ---');
console.log(cols.rows.map(c=>c.table_name+'.'+c.column_name+' -> '+c.udt_name).join('\n'));
await pool.end();
