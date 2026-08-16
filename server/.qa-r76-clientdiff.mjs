// Run 76 s1 — SET DIFFERENCE over code: every API path the CLIENT calls
// vs every route the SERVER actually mounts.
//
// Why this and not another black-box sweep: a sweep can only find routes that
// exist. A client call to a path that was renamed/never built returns 404 at
// runtime and is invisible to a server-side sweep, and invisible to a UI sweep
// unless that exact code path is triggered. Two sets that should be equal.
import fs from 'fs';
import path from 'path';

const CLIENT_SRC = 'C:/Projects/stormleads/client/src';
const routes = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

// ---- collect client call sites -------------------------------------------
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(e.name)) files.push(p);
  }
})(CLIENT_SRC);

const BT = String.fromCharCode(96);
// client.get('...'), client.post(`...`), axios.post('/api/...'), api.delete(...)
const callRe = new RegExp(
  '\\b(?:client|api|axios)\\s*\\.\\s*(get|post|put|patch|delete)\\s*\\(\\s*([' + BT + "'\"])([^" + BT + "'\"]*)\\2",
  'g'
);

const calls = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  callRe.lastIndex = 0;
  let m;
  while ((m = callRe.exec(src))) {
    const method = m[1].toUpperCase();
    let raw = m[3];
    if (!raw.startsWith('/')) continue;              // computed / relative — skip
    const line = src.slice(0, m.index).split('\n').length;
    // strip query string
    let p = raw.split('?')[0];
    // template placeholders ${x} -> :param
    p = p.replace(/\$\{[^}]*\}/g, ':p');
    // axios.post('/api/auth/refresh') already carries /api; client.* does not
    const full = p.startsWith('/api/') ? p : '/api' + p;
    calls.push({ file: path.relative(CLIENT_SRC, f).replace(/\\/g, '/'), line, method, raw, path: full, src: lines[line - 1]?.trim().slice(0, 120) });
  }
}

// ---- express-style matcher ------------------------------------------------
function toRe(routePath) {
  const parts = routePath.split('/').filter(Boolean);
  const body = parts.map((s) => (s.startsWith(':') ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/');
  return new RegExp('^/' + body + '/?$');
}
const compiled = routes.map((r) => ({ ...r, re: toRe(r.path) }));

function matches(call) {
  // a client segment that is a literal must match a literal or a :param;
  // a client :p may only match a server :param OR a literal (we substitute a
  // wildcard, so ':p' would wrongly match a literal — guard that explicitly)
  const cs = call.path.split('/').filter(Boolean);
  return compiled.filter((r) => {
    if (r.method !== call.method) return false;
    const rs = r.path.split('/').filter(Boolean);
    if (rs.length !== cs.length) return false;
    for (let i = 0; i < rs.length; i++) {
      const rseg = rs[i];
      const cseg = cs[i];
      if (rseg.startsWith(':')) continue;            // server param eats anything
      if (cseg === ':p') return false;               // client interpolates where server wants a literal
      if (rseg !== cseg) return false;
    }
    return true;
  });
}

const unique = new Map();
for (const c of calls) {
  const k = c.method + ' ' + c.path;
  if (!unique.has(k)) unique.set(k, { ...c, sites: [] });
  unique.get(k).sites.push(`${c.file}:${c.line}`);
}

const orphans = [];
const matched = new Set();
for (const [k, c] of unique) {
  const hits = matches(c);
  if (hits.length === 0) orphans.push({ k, c });
  else hits.forEach((h) => matched.add(h.method + ' ' + h.path));
}

console.log('client call sites:', calls.length, '| unique method+path:', unique.size);
console.log('server routes:', routes.length, '| hit by client:', matched.size);
console.log('\n=== CLIENT CALLS WITH NO MATCHING SERVER ROUTE (' + orphans.length + ') ===');
for (const o of orphans) {
  console.log(o.k);
  console.log('     raw:', o.c.raw);
  console.log('     at :', o.c.sites.join(', '));
}

const unused = routes.filter((r) => !matched.has(r.method + ' ' + r.path));
console.log('\n=== SERVER ROUTES NEVER CALLED BY THE CLIENT (' + unused.length + ') ===');
for (const r of unused) console.log(`${r.method.padEnd(6)} ${r.path.padEnd(58)} ${r.file}`);

fs.writeFileSync('C:/tmp/qa-r76-clientdiff.json', JSON.stringify({ orphans, unused, calls: [...unique.values()] }, null, 1));
