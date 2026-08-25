// Run 95 — static hunt for the 5a3978e bug class:
//   UPDATE ... SET col = $n   where $n is a raw destructured PATCH body field.
// Safe shapes: dynamic SET built from present fields; COALESCE($n, col).
import fs from 'fs'; import path from 'path';
const files = [];
const walk = d => fs.readdirSync(d,{withFileTypes:true}).forEach(e=>{
  const p = path.join(d,e.name);
  if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) files.push(p);
});
walk('src/services'); walk('src/routes');

let total=0; const flagged=[];
for (const f of files) {
  const src = fs.readFileSync(f,'utf8');
  // find UPDATE ... SET ... (up to WHERE) inside template literals
  const re = /UPDATE\s+([a-z_]+)[\s\S]{0,60}?\bSET\b([\s\S]*?)(?:\bWHERE\b|`)/gi;
  let m;
  while ((m = re.exec(src))) {
    total++;
    const table = m[1], setBlock = m[2];
    const line = src.slice(0, m.index).split('\n').length;
    // assignments of the form  col = $n   (not COALESCE, not CASE, not expression)
    const assigns = [...setBlock.matchAll(/([a-z_]+)\s*=\s*\$(\d+)\s*(?:,|$)/gim)]
      .map(a=>({col:a[1], idx:+a[2]}));
    if (!assigns.length) continue;
    // is the SET list dynamic (joined from an array)? then it's the safe pattern
    const dynamic = /\$\{[^}]*(join|fields|sets|updates)[^}]*\}/i.test(setBlock);
    if (dynamic) continue;
    flagged.push({file:f, line, table, cols:assigns.map(a=>a.col), raw:setBlock.replace(/\s+/g,' ').trim().slice(0,220)});
  }
}
console.log(`UPDATE statements scanned: ${total}`);
console.log(`static-SET (non-dynamic) with plain col=$n assignments: ${flagged.length}\n`);
for (const f of flagged) console.log(`${f.file}:${f.line}  [${f.table}]  cols=${f.cols.join(',')}\n    ${f.raw}\n`);
