// Run 77 s2 — SET DIFFERENCE: API paths the CLIENT calls vs routes the SERVER defines.
// New "kind of name" per the Run 76-s3 lesson. Static candidates only; confirm at runtime.
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Projects/stormleads';
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
};

// ---------- 1. SERVER: mount prefixes ----------
const idx = fs.readFileSync(`${ROOT}/server/src/routes/index.js`, 'utf8');
const imports = {};
for (const m of idx.matchAll(/import\s+(\w+)\s+from\s+'\.\/([\w.]+)\.js'/g)) imports[m[1]] = m[2];
const mounts = []; // {prefix, file}
for (const m of idx.matchAll(/router\.use\('([^']+)',\s*(\w+)\)/g)) {
  if (imports[m[2]]) mounts.push({ prefix: m[1], file: imports[m[2]] });
}

// ---------- 2. SERVER: routes per file (incl. nested router.use inside a route file) ----------
const METHODS = 'get|post|put|patch|delete|all';
const routesInFile = (file) => {
  const fp = `${ROOT}/server/src/routes/${file}.js`;
  if (!fs.existsSync(fp)) return { paths: [], nested: [] };
  const src = fs.readFileSync(fp, 'utf8');
  const paths = [];
  for (const m of src.matchAll(new RegExp(`router\\.(${METHODS})\\(\\s*'([^']*)'`, 'g'))) {
    paths.push({ method: m[1].toUpperCase(), p: m[2] });
  }
  const nested = [];
  const nestedImports = {};
  for (const m of src.matchAll(/import\s+(\w+)\s+from\s+'\.\/([\w.]+)\.js'/g)) nestedImports[m[1]] = m[2];
  for (const m of src.matchAll(/router\.use\('([^']+)',\s*(\w+)\)/g)) {
    if (nestedImports[m[2]]) nested.push({ prefix: m[1], file: nestedImports[m[2]] });
  }
  return { paths, nested };
};

const serverRoutes = new Set(); // "METHOD /api/normalized"
const norm = (p) => ('/api' + p).replace(/\/+/g, '/').replace(/:[A-Za-z0-9_]+/g, '*').replace(/\/$/, '') || '/api';
const expand = (prefix, file, depth = 0) => {
  if (depth > 3) return;
  const { paths, nested } = routesInFile(file);
  for (const r of paths) serverRoutes.add(`${r.method} ${norm(prefix + r.p)}`);
  for (const n of nested) expand(prefix + n.prefix, n.file, depth + 1);
};
for (const m of mounts) expand(m.prefix, m.file);

// ---------- 3. CLIENT: every API path called ----------
const clientFiles = walk(`${ROOT}/client/src`);
const calls = [];
const cleanTpl = (s) => s.replace(/\$\{[^}]*\}/g, '*');
for (const f of clientFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  // axios instance: client.get('/x') / client.post(`/x/${id}`) ; also api.get(...)
  const pats = [
    // group1=method group2=quote group3=path
    new RegExp(`\\b(?:client|api|axiosClient)\\.(${METHODS})\\(\\s*(['\`])([^'\`]*)\\2`, 'g'),
    new RegExp(`\\baxios\\.(${METHODS})\\(\\s*(['\`])([^'\`]*)\\2`, 'g'),
  ];
  for (const re of pats) {
    for (const m of src.matchAll(re)) {
      let p = cleanTpl(m[3]);
      if (!p.startsWith('/')) continue;
      if (!p.startsWith('/api')) p = '/api' + p; // axios instance baseURL is /api
      const line = src.slice(0, m.index).split('\n').length;
      calls.push({ method: m[1].toUpperCase(), raw: m[3], p, file: f.replace(ROOT + '\\', ''), line });
    }
  }
  // fetch('/api/...')
  for (const m of src.matchAll(/\bfetch\(\s*(['`])(\/api[^'`]*)\1/g)) {
    const line = src.slice(0, m.index).split('\n').length;
    let p = cleanTpl(m[2]);
    // method from a nearby method: 'X'
    const after = src.slice(m.index, m.index + 400);
    const mm = after.match(/method:\s*['"](\w+)['"]/);
    calls.push({ method: (mm ? mm[1] : 'GET').toUpperCase(), raw: m[2], p, file: f.replace(ROOT + '\\', ''), line });
  }
}

// ---------- 4. DIFF ----------
const stripQuery = (p) => p.split('?')[0].replace(/\/$/, '') || '/api';
const matches = (cp, method) => {
  const c = stripQuery(cp).split('/');
  for (const sr of serverRoutes) {
    const [sm, sp] = sr.split(' ');
    if (sm !== method && sm !== 'ALL') continue;
    const s = sp.split('/');
    if (s.length !== c.length) continue;
    let ok = true;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '*' || c[i] === '*') continue;
      if (s[i] !== c[i]) { ok = false; break; }
    }
    if (ok) return sr;
  }
  return null;
};

const bad = [];
const seen = new Set();
for (const c of calls) {
  const key = `${c.method} ${c.p} ${c.file}:${c.line}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const hit = matches(c.p, c.method);
  if (!hit) bad.push(c);
}

// any-method match? (tells wrong-verb vs wrong-path apart)
for (const b of bad) {
  b.anyMethod = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter((m) => matches(b.p, m));
}

const out = {
  serverRouteCount: serverRoutes.size,
  clientCallCount: seen.size,
  unmatched: bad.sort((a, b) => a.file.localeCompare(b.file)),
};
fs.writeFileSync('C:/tmp/r77s2-apidiff.json', JSON.stringify(out, null, 2));
console.log(`server routes: ${serverRoutes.size}   client calls: ${seen.size}   UNMATCHED: ${bad.length}`);
for (const b of bad) console.log(`  ${b.method.padEnd(6)} ${b.p.padEnd(52)} ${b.file}:${b.line}  ${b.anyMethod.length ? 'exists-as:' + b.anyMethod.join(',') : 'NO-SUCH-PATH'}`);
