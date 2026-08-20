import pool from './src/db/pool.js';
import fs from 'fs';
const e=await pool.query(`
 SELECT t.typname, string_agg(l.enumlabel, chr(124) ORDER BY l.enumsortorder) labels
 FROM pg_type t JOIN pg_enum l ON l.enumtypid=t.oid GROUP BY 1 ORDER BY 1`);
const c=await pool.query(`
 SELECT c.table_name, c.column_name, c.udt_name, c.column_default
 FROM information_schema.columns c
 JOIN pg_type t ON t.typname=c.udt_name
 JOIN pg_enum l ON l.enumtypid=t.oid
 WHERE c.table_schema='public'
 GROUP BY 1,2,3,4 ORDER BY 1,2`);
// also CHECK constraints acting as pseudo-enums
const k=await pool.query(`
 SELECT rel.relname tbl, con.conname, pg_get_constraintdef(con.oid) def
 FROM pg_constraint con JOIN pg_class rel ON rel.oid=con.conrelid
 JOIN pg_namespace n ON n.oid=rel.relnamespace
 WHERE con.contype='c' AND n.nspname='public' AND pg_get_constraintdef(con.oid) ILIKE '%ANY (ARRAY%'
 ORDER BY 1`);
console.log('===== ENUM TYPES =====');
for(const r of e.rows) console.log(`${r.typname.padEnd(28)} ${r.labels}`);
console.log('\n===== ENUM COLUMNS =====');
for(const r of c.rows) console.log(`${(r.table_name+'.'+r.column_name).padEnd(46)} ${r.udt_name.padEnd(26)} default=${r.column_default||'-'}`);
console.log('\n===== CHECK-CONSTRAINT PSEUDO-ENUMS =====');
for(const r of k.rows) console.log(`${r.tbl}.${r.conname}: ${r.def.replace(/\s+/g,' ').slice(0,220)}`);
fs.writeFileSync('C:/tmp/qa-r82-enums.json',JSON.stringify({types:e.rows,cols:c.rows,checks:k.rows},null,1));
await pool.end();
