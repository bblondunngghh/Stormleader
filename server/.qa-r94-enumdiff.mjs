// Run 94 s1 — generalize tonight's defect: every SQL comparison of an ENUM column
// against a string literal that the enum does not contain, and that is not cast ::text.
// Postgres raises 22P02 at runtime -> the error handler turns it into a hard 400/500.
// Set difference: literals used in code vs labels the enum actually holds.
import pool from './src/db/pool.js';
import fs from 'fs';
import path from 'path';

const et=(await pool.query(`
  SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) labels
  FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid GROUP BY 1`)).rows;
const enumLabels=Object.fromEntries(et.map(r=>[r.typname,r.labels]));
const cols=(await pool.query(`
  SELECT c.table_name, c.column_name, c.udt_name
  FROM information_schema.columns c
  WHERE c.table_schema='public' AND c.data_type='USER-DEFINED' AND c.udt_name = ANY($1)`,
  [Object.keys(enumLabels)])).rows;
// column name -> set of allowed labels (union across tables using that name)
const colAllowed={};
for(const c of cols){ (colAllowed[c.column_name] ||= new Set()); for(const l of enumLabels[c.udt_name]) colAllowed[c.column_name].add(l); }
console.log('enum types:',Object.keys(enumLabels).length,'| enum columns:',cols.length);
console.log('enum col names:',Object.keys(colAllowed).join(', '));

const files=[];
const walk=(d)=>{for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);
  if(f.isDirectory())walk(p); else if(/\.js$/.test(f.name))files.push(p);}};
walk('src');

const findings=[];
for(const f of files){
  const src=fs.readFileSync(f,'utf8');
  const lines=src.split(/\r?\n/);
  lines.forEach((line,i)=>{
    // col IN ('a','b')  /  col NOT IN (...)  /  col = 'x'  /  col <> 'x'
    const re=/(\w+)\.?(\w+)?\s*(?:NOT\s+)?(?:IN\s*\(([^)]*)\)|(?:=|<>|!=)\s*'([^']*)')/gi;
    let m;
    while((m=re.exec(line))){
      const col = m[2] || m[1];
      if(!colAllowed[col]) continue;
      if(new RegExp(col+'\s*::\s*text','i').test(line)) continue;   // cast -> immune
      const lits = m[3] ? [...m[3].matchAll(/'([^']*)'/g)].map(x=>x[1]) : (m[4]!==undefined?[m[4]]:[]);
      const bad = lits.filter(l=>l && !colAllowed[col].has(l) && !/^\$\d/.test(l));
      if(bad.length) findings.push({f,line:i+1,col,bad,text:line.trim().slice(0,150)});
    }
  });
}
console.log(`\nfiles scanned: ${files.length}`);
console.log(`=== enum-literal mismatches (22P02 risk): ${findings.length} ===`);
for(const x of findings) console.log(`  ${x.f}:${x.line}  col=${x.col}  NOT-IN-ENUM=[${x.bad.join(', ')}]\n     ${x.text}`);
if(!findings.length) console.log('  none — tonight\'s fix was the only instance');
await pool.end();
