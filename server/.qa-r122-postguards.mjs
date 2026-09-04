// Run 122-s1: static extraction of every param-less POST handler's opening lines,
// to decide which are SAFE to probe with an empty/partial body (i.e. provably
// `return res.status(4xx)` BEFORE any INSERT) vs which are action routes that
// would fire a real side effect. Read-only; writes JSON to C:/tmp.
import fs from 'fs';
import path from 'path';

const ROUTES = 'C:/Projects/stormleads/server/src/routes';
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const posts = inv.filter(r => r.method === 'POST' && !/:/.test(r.path));

// mount prefix per file, derived from index.js
const idx = fs.readFileSync(path.join(ROUTES, 'index.js'), 'utf8');
const mounts = {};
for (const m of idx.matchAll(/router\.use\('([^']+)',\s*(\w+)Router\)/g)) {
  mounts[m[2]] = m[1];
}

const out = [];
for (const r of posts) {
  const src = fs.readFileSync(path.join(ROUTES, r.file), 'utf8');
  const lines = src.split('\n');
  // sub-path inside the file = full path minus '/api' minus mount prefix
  const rel = r.path.replace(/^\/api/, '');
  // find router.post('<sub>' whose resolved path equals rel
  let found = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/router\.post\(\s*'([^']*)'/);
    if (!m) continue;
    const sub = m[1];
    if (rel.endsWith(sub === '/' ? '' : sub) || sub === rel) {
      found = i;
      // prefer the tightest match
      if (rel === sub || rel.endsWith(sub)) break;
    }
  }
  if (found === null) { out.push({ ...r, handler: null }); continue; }
  const body = lines.slice(found, found + 30).join('\n');
  // classify
  const guards = [];
  for (const g of body.matchAll(/status\((4\d\d)\)[\s\S]{0,80}?error:\s*['"`]([^'"`]{0,70})/g)) {
    guards.push(g[1] + ' ' + g[2]);
  }
  const hasEarly4xx = /status\(4\d\d\)/.test(body.split('\n').slice(1, 14).join('\n'));
  out.push({
    method: r.method, path: r.path, file: r.file, line: found + 1,
    guards: guards.slice(0, 4),
    hasEarly4xx,
    snippet: lines.slice(found, found + 14).map(s => s.trim()).filter(Boolean).slice(0, 12).join(' | ').slice(0, 420),
  });
}

fs.writeFileSync('C:/tmp/qa-r122-postguards.json', JSON.stringify(out, null, 1));
console.log('POST param-less routes analysed:', out.length);
console.log('with an early 4xx guard:', out.filter(o => o.hasEarly4xx).length);
console.log('NO early guard (action / unconditional):', out.filter(o => o && !o.hasEarly4xx).map(o => o.path).join('\n  '));
