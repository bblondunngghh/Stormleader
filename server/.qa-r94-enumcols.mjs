import pool from './src/db/pool.js';
const r=(await pool.query(`
  SELECT c.table_name||'.'||c.column_name AS tc, c.udt_name, c.data_type
  FROM information_schema.columns c
  WHERE c.table_schema='public'
    AND c.column_name IN ('status','type','priority','stage')
  ORDER BY 1`)).rows;
console.log('--- ENUM-typed ---');
r.filter(x=>x.data_type==='USER-DEFINED').forEach(x=>console.log('  ',x.tc,'=>',x.udt_name));
console.log('--- TEXT/VARCHAR (immune to 22P02) ---');
console.log('  '+r.filter(x=>x.data_type!=='USER-DEFINED').map(x=>x.tc).join(', '));
const e=(await pool.query(`SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) l FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid GROUP BY 1 ORDER BY 1`)).rows;
console.log('--- enum labels ---');
e.forEach(x=>console.log('  ',x.typname+':',x.l.join('|')));
await pool.end();
