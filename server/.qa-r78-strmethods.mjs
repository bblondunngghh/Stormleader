// Run 78 s1 — find query params that have a STRING METHOD called on them without coercion.
// A repeated query param (?p=a&p=b) arrives as an ARRAY; an object param (?p[k]=v) as an OBJECT.
// Either one turns `p.toUpperCase()` into a TypeError -> 500.
import fs from 'fs';
import path from 'path';

const files = [];
(function walk(d) {
  try {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js') && !e.name.endsWith('.bak')) files.push(p);
    }
  } catch {}
})('src');

const qp = JSON.parse(fs.readFileSync('C:/tmp/qa-r78-qparams.json', 'utf8'));
const known = new Set(qp.all);

const STR = 'toUpperCase|toLowerCase|split|trim|replace|replaceAll|startsWith|endsWith|padStart|padEnd|charAt|match|matchAll|localeCompare|normalize|repeat|codePointAt';
const hits = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  // which query params does THIS file bring into scope?
  const local = new Set();
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:req\.query|query|filters|opts|params)\b/g))
    for (const raw of m[1].split(',')) {
      const parts = raw.split(':');
      const src_name = parts[0].split('=')[0].trim();
      const bound = (parts[1] ?? parts[0]).split('=')[0].trim();  // handle {a: b} renames
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(bound) && known.has(src_name)) local.add(bound);
    }
  for (const m of src.matchAll(/req\.query\.([A-Za-z_][A-Za-z0-9_]*)/g)) local.add(m[1]);

  lines.forEach((line, i) => {
    // direct: req.query.X.method()
    for (const m of line.matchAll(new RegExp('req\\.query\\.([A-Za-z_][A-Za-z0-9_]*)\\s*\\.\\s*(' + STR + ')\\s*\\(', 'g')))
      hits.push({ file: f, line: i + 1, param: m[1], method: m[2], via: 'req.query.X', code: line.trim().slice(0, 130) });
    // destructured: X.method()
    for (const m of line.matchAll(new RegExp('\\b([A-Za-z_][A-Za-z0-9_]*)\\s*\\.\\s*(' + STR + ')\\s*\\(', 'g'))) {
      if (!local.has(m[1])) continue;
      if (/req\.query\./.test(line.slice(Math.max(0, m.index - 12), m.index + 1))) continue; // already counted
      hits.push({ file: f, line: i + 1, param: m[1], method: m[2], via: 'destructured', code: line.trim().slice(0, 130) });
    }
  });
}

console.log('=== QUERY PARAMS WITH AN UNCOERCED STRING METHOD:', hits.length, '===\n');
const byFile = {};
for (const h of hits) (byFile[h.file] ||= []).push(h);
for (const [f, hs] of Object.entries(byFile)) {
  console.log(f);
  for (const h of hs) console.log(`   :${String(h.line).padEnd(5)} ${h.param}.${h.method}()   ${h.via}\n            ${h.code}`);
}
fs.writeFileSync('C:/tmp/qa-r78-strmethods.json', JSON.stringify(hits, null, 1));
