// Run 125-s1 — finds every SQL JOIN onto a TENANT-OWNED table whose ON clause carries no
// tenant predicate. This is the exact shape of the confirmed tasks disclosure (3a3d752).
import fs from 'fs';import path from 'path';
import pool from './src/db/pool.js';
const owned=new Set((await pool.query(
  `SELECT table_name FROM information_schema.columns WHERE column_name='tenant_id' AND table_schema='public'`)).rows.map(r=>r.table_name));
await pool.end();
const files=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name);
  if(e.isDirectory()){if(!/node_modules|\.git/.test(p))walk(p);}
  else if(e.name.endsWith('.js'))files.push(p);}})('src');

const hits=[];
for(const f of files){
  const src=fs.readFileSync(f,'utf8');const lines=src.split('\n');
  lines.forEach((ln,i)=>{
    const m=/\b(LEFT|RIGHT|INNER|FULL)?\s*(?:OUTER\s+)?JOIN\s+([a-z_]+)\s+([a-z_]+)?\s*ON\s+(.*)$/i.exec(ln);
    if(!m)return;
    const tbl=m[2];if(!owned.has(tbl))return;
    // gather the ON clause, possibly continuing onto the next line
    let on=m[4];let j=i+1;
    while(j<lines.length&&!/`|\bWHERE\b|\bJOIN\b|\bORDER\b|\bGROUP\b/i.test(lines[j])&&on.length<200){on+=' '+lines[j].trim();j++;}
    if(/tenant_id/i.test(on))return;
    hits.push({file:f.split(String.fromCharCode(92)).join('/'),line:i+1,table:tbl,sql:ln.trim().slice(0,120)});
  });
}
console.log(`tenant-owned tables: ${owned.size}`);
console.log(`UNSCOPED JOINS ONTO TENANT-OWNED TABLES: ${hits.length}\n`);
const by={};hits.forEach(h=>{(by[h.file]??=[]).push(h);});
for(const [f,hs] of Object.entries(by).sort((a,b)=>b[1].length-a[1].length)){
  console.log(`${f}  (${hs.length})`);
  hs.forEach(h=>console.log(`   :${String(h.line).padEnd(5)} [${h.table}] ${h.sql}`));
}
fs.writeFileSync('C:/tmp/qa-r125-joinscan.json',JSON.stringify(hits,null,1));
