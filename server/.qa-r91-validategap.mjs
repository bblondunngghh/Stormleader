// Run 91 (s2) — SET DIFFERENCE: route path params vs the params validateId() actually guards.
// Bug class: `validateId(...names)` defaults to ['id'] when called bare, so a route whose
// params are :leadId/:woId/:contactId but that calls a bare validateId() guards NOTHING —
// the loop reads req.params.id, gets undefined, and falls through to next().
import fs from 'fs'; import path from 'path';
const dir = 'src/routes';
const rows = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const re = /router\.(get|post|patch|put|delete)\(\s*'([^']+)'\s*,\s*([^)]*?)\)?\s*,?\s*async/g;
  let m;
  const lineOf = (i) => src.slice(0, i).split('\n').length;
  const re2 = /router\.(get|post|patch|put|delete)\(\s*'([^']+)'([\s\S]{0,220}?)async\s*\(req/g;
  while ((m = re2.exec(src))) {
    const [, verb, route, middle] = m;
    const pathParams = [...route.matchAll(/:(\w+)/g)].map(x => x[1]);
    if (!pathParams.length) continue;
    const vm = middle.match(/validateId\(([^)]*)\)/);
    const guarded = vm === null ? null
      : (vm[1].trim() === '' ? ['id'] : [...vm[1].matchAll(/'(\w+)'/g)].map(x => x[1]));
    const unguarded = guarded === null ? pathParams : pathParams.filter(p => !guarded.includes(p));
    rows.push({ file: f, line: lineOf(m.index), verb: verb.toUpperCase(), route, pathParams, guarded, unguarded });
  }
}
const noValidator = rows.filter(r => r.guarded === null);
const partial = rows.filter(r => r.guarded !== null && r.unguarded.length);
const bareMismatch = partial.filter(r => r.guarded.length === 1 && r.guarded[0] === 'id' && !r.pathParams.includes('id'));

console.log(`routes with path params: ${rows.length}`);
console.log(`\n=== A. bare validateId() but NO :id param -> guards NOTHING (${bareMismatch.length}) ===`);
bareMismatch.forEach(r => console.log(`  ${r.file}:${r.line} ${r.verb} ${r.route}  params=[${r.pathParams}]`));
console.log(`\n=== B. validateId present but some params unguarded (${partial.length - bareMismatch.length}) ===`);
partial.filter(r => !bareMismatch.includes(r)).forEach(r => console.log(`  ${r.file}:${r.line} ${r.verb} ${r.route}  guarded=[${r.guarded}] UNGUARDED=[${r.unguarded}]`));
console.log(`\n=== C. no validateId at all (${noValidator.length}) ===`);
noValidator.forEach(r => console.log(`  ${r.file}:${r.line} ${r.verb} ${r.route}  params=[${r.pathParams}]`));
