// Run 78 s1 — write-side analogue of the query-param finding:
// body fields that get a STRING METHOD called on them with no type coercion.
// JSON bodies can carry ANY type, so body.email.toLowerCase() with email=123 throws -> 500.
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

const STR = 'toUpperCase|toLowerCase|split|trim|replace|replaceAll|startsWith|endsWith|padStart|padEnd|charAt|match|normalize|repeat';
const hits = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  // body fields brought into scope in this file
  const local = new Set();
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*req\.body\b/g))
    for (const raw of m[1].split(',')) {
      const parts = raw.split(':');
      const bound = (parts[1] ?? parts[0]).split('=')[0].trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(bound)) local.add(bound);
    }

  lines.forEach((line, i) => {
    for (const m of line.matchAll(new RegExp('req\\.body\\.([A-Za-z_][A-Za-z0-9_]*)\\s*\\.\\s*(' + STR + ')\\s*\\(', 'g')))
      hits.push({ file: f, line: i + 1, field: m[1], method: m[2], via: 'req.body.X', code: line.trim().slice(0, 120) });
    for (const m of line.matchAll(new RegExp('\\b([A-Za-z_][A-Za-z0-9_]*)\\s*\\.\\s*(' + STR + ')\\s*\\(', 'g'))) {
      if (!local.has(m[1])) continue;
      if (/req\.body\./.test(line.slice(Math.max(0, m.index - 12), m.index + 1))) continue;
      hits.push({ file: f, line: i + 1, field: m[1], method: m[2], via: 'destructured', code: line.trim().slice(0, 120) });
    }
  });
}
console.log('=== BODY FIELDS WITH AN UNCOERCED STRING METHOD:', hits.length, '===\n');
const byFile = {};
for (const h of hits) (byFile[h.file] ||= []).push(h);
for (const [f, hs] of Object.entries(byFile)) {
  console.log(f);
  for (const h of hs) console.log(`   :${String(h.line).padEnd(5)} ${h.field}.${h.method}()  ${h.code}`);
}
fs.writeFileSync('C:/tmp/qa-r78-bodystr.json', JSON.stringify(hits, null, 1));
