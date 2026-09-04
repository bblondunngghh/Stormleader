// Run 122-s1 — the class the POST {} sweep is STRUCTURALLY BLIND TO.
// `if (!x) return 400` only proves the field is PRESENT. A truthy value of the
// WRONG TYPE (42, true, [], {}) passes it, and then any string/array method on
// x throws TypeError -> 500. Static set difference:
//   guarded-by-truthy-only  MINUS  guarded-by-an-explicit-type-check
// then intersected with "x is used with a string/array method somewhere".
// Read-only. Emits probe candidates for a targeted API pass.
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Projects/stormleads/server/src';
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js') && !e.name.endsWith('.bak')) files.push(p);
  }
})(ROOT);

const STR_METHODS = /\.(trim|replace|replaceAll|toLowerCase|toUpperCase|split|padStart|padEnd|slice|substring|charAt|startsWith|endsWith|includes|match|normalize)\s*\(/;
const ARR_METHODS = /\.(map|filter|forEach|reduce|some|every|find|findIndex|join|flat|sort)\s*\(/;

const findings = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  const rel = f.replace('C:/Projects/stormleads/', '').replace(/\\/g, '/');

  for (let i = 0; i < lines.length; i++) {
    // truthy-only presence guard on a body field
    const m = lines[i].match(/if\s*\(\s*!\s*([A-Za-z_$][\w$.]*)\s*\)\s*(?:\{)?\s*(?:return\s+)?res\.status\((4\d\d)\)/);
    if (!m) continue;
    const varName = m[1].replace(/^req\.body\./, '');
    const bare = varName.split('.').pop();
    if (!bare || bare.length < 2) continue;

    // is this var sourced from req.body anywhere in the file?
    const fromBody = new RegExp(`(?:const|let)\\s*\\{[^}]*\\b${bare}\\b[^}]*\\}\\s*=\\s*req\\.body|req\\.body\\.${bare}\\b`).test(src);
    if (!fromBody) continue;

    // is there an EXPLICIT type check on it anywhere in the file?
    const typed = new RegExp(
      `typeof\\s+${bare}\\b|Array\\.isArray\\(\\s*${bare}\\b|${bare}\\s*instanceof|typeof\\s+req\\.body\\.${bare}\\b|Array\\.isArray\\(\\s*req\\.body\\.${bare}\\b`
    ).test(src);

    // is it later used with a string/array method (in this file)?
    const uses = [];
    for (let j = i + 1; j < Math.min(lines.length, i + 60); j++) {
      const L = lines[j];
      const re = new RegExp(`\\b${bare}\\s*\\.(\\w+)\\s*\\(`);
      const um = L.match(re);
      if (um && (STR_METHODS.test('.' + um[1] + '(') || ARR_METHODS.test('.' + um[1] + '('))) {
        uses.push({ line: j + 1, method: um[1], text: L.trim().slice(0, 120) });
      }
      if (/^router\.(get|post|put|patch|delete)/.test(L)) break; // next handler
    }

    // does it get handed to a service? then scan services for the same name
    findings.push({
      file: rel, line: i + 1, field: bare, status: m[2], typed,
      guard: lines[i].trim().slice(0, 120),
      uses: uses.slice(0, 4),
    });
  }
}

// candidates = truthy-only (no explicit type check) AND used with a str/arr method
const cand = findings.filter(f => !f.typed && f.uses.length);
const untypedNoUse = findings.filter(f => !f.typed && !f.uses.length);

fs.writeFileSync('C:/tmp/qa-r122-truthyguards.json', JSON.stringify({ findings, cand }, null, 1));
console.log('truthy-only presence guards on req.body fields:', findings.length);
console.log('  ...with an explicit type check too (SAFE):', findings.filter(f => f.typed).length);
console.log('  ...untyped, no str/arr use in the same handler:', untypedNoUse.length);
console.log('  ...UNTYPED + used with a string/array method  == PROBE THESE:', cand.length);
console.log();
for (const c of cand) {
  console.log(`>> ${c.file}:${c.line}  field=${c.field}`);
  console.log(`     guard: ${c.guard}`);
  c.uses.forEach(u => console.log(`     use  : :${u.line} .${u.method}()  ${u.text}`));
}
console.log('\n--- untyped, no local use (field is probably passed to a service; check there) ---');
untypedNoUse.forEach(f => console.log(`  ${f.file}:${f.line} ${f.field}`));
