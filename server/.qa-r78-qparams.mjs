// Run 78 s1 — inventory every query param the server actually READS.
// Per the standing gotcha: a routes-only grep for req.query.X UNDER-COUNTS, because handlers
// pass req.query straight to a service that destructures the names. Scan services too.
import fs from 'fs';
import path from 'path';

const roots = ['src/routes', 'src/services'];
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js') && !e.name.endsWith('.bak')) files.push(p);
  }
})('src/routes');
walk2('src/services');
function walk2(d) { try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk2(p); else if (e.name.endsWith('.js')) files.push(p); } } catch {} }

const direct = new Map();      // param -> Set(files)   from req.query.X
const destructured = new Map();// param -> Set(files)   from const {a,b} = req.query
const sortish = new Map();     // params that smell like they reach ORDER BY / raw SQL

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/req\.query\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
    if (!direct.has(m[1])) direct.set(m[1], new Set()); direct.get(m[1]).add(f);
  }
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:req\.query|query|filters|opts|params)\b/g)) {
    for (const raw of m[1].split(',')) {
      const name = raw.split(':')[0].split('=')[0].trim();
      if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
      if (!destructured.has(name)) destructured.set(name, new Set()); destructured.get(name).add(f);
    }
  }
  // does this file build SQL with a template literal that mentions ORDER BY / sort?
  for (const m of src.matchAll(/ORDER\s+BY\s*\$\{([^}]+)\}/gi)) {
    if (!sortish.has(f)) sortish.set(f, []); sortish.get(f).push(m[1].trim());
  }
}

const all = new Set([...direct.keys(), ...destructured.keys()]);
console.log('files scanned:', files.length);
console.log('distinct query params read:', all.size);
console.log('  via req.query.X   :', direct.size);
console.log('  via destructuring :', destructured.size);

console.log('\n=== *** ORDER BY BUILT FROM A TEMPLATE LITERAL (raw interpolation into SQL) *** ===');
if (sortish.size === 0) console.log('  none — no `ORDER BY ${...}` anywhere');
for (const [f, exprs] of sortish) console.log(`  ${f}\n      ${exprs.join('\n      ')}`);

const sortNames = [...all].filter(n => /sort|order|by$|dir|asc|desc|column|field/i.test(n));
console.log('\n=== sort/order-ish param names (', sortNames.length, ') ===');
console.log('  ' + sortNames.join(', '));

fs.writeFileSync('C:/tmp/qa-r78-qparams.json', JSON.stringify({
  all: [...all].sort(),
  direct: Object.fromEntries([...direct].map(([k, v]) => [k, [...v]])),
  destructured: Object.fromEntries([...destructured].map(([k, v]) => [k, [...v]])),
  orderByTemplates: Object.fromEntries([...sortish]),
}, null, 1));
