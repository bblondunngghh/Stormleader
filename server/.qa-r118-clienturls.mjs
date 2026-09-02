// Run 118-s2: SET DIFFERENCE — every URL the client requests vs every route the server mounts.
// A client call to a path the server does not expose is a silently-dead feature: the page
// renders fine, the button is live, and the request 404s behind a generic toast.
// Read-only: parses source only, issues no requests.
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Projects/stormleads';
const SRV = path.join(ROOT, 'server/src');
const CLI = path.join(ROOT, 'client/src');
const BT = String.fromCharCode(96); // backtick

// ---------- 1. server side: derive mounts from routes/index.js, then read each router ----------
const idx = fs.readFileSync(path.join(SRV, 'routes/index.js'), 'utf8');
const importRe = /import\s+(\w+)\s+from\s+['"]\.\/([\w.]+?)(?:\.js)?['"]/g;
const modByName = {};
let m;
while ((m = importRe.exec(idx))) modByName[m[1]] = m[2] + '.js';

const useRe = /router\.use\(\s*['"]([^'"]+)['"]\s*,\s*([\s\S]{0,200}?)(\w+)\s*\)/g;
const mounts = [];
while ((m = useRe.exec(idx))) {
  const prefix = m[1];
  const ident = m[3];
  if (modByName[ident]) mounts.push({ prefix, file: modByName[ident] });
}

// app-level mounts (server/src/index.js) — e.g. app.use('/api', routes)
const appSrc = fs.readFileSync(path.join(SRV, 'index.js'), 'utf8');
const appUse = [...appSrc.matchAll(/app\.use\(\s*['"](\/[^'"]*)['"]\s*,/g)].map((x) => x[1]);

const routeRe = new RegExp(
  'router\\.(get|post|put|patch|delete)\\(\\s*[\'"' + BT + ']([^\'"' + BT + ']*)[\'"' + BT + ']',
  'g'
);

const serverRoutes = [];
const missingFiles = [];
for (const { prefix, file } of mounts) {
  const fp = path.join(SRV, 'routes', file);
  if (!fs.existsSync(fp)) { missingFiles.push(file); continue; }
  const src = fs.readFileSync(fp, 'utf8');
  routeRe.lastIndex = 0;
  let r;
  while ((r = routeRe.exec(src))) {
    const p = r[2];
    const full = ('/api' + prefix + (p === '/' ? '' : p)).replace(/\/+$/, '') || '/api';
    serverRoutes.push({ method: r[1].toUpperCase(), path: full, file });
  }
}

// ---------- 2. client side: every URL literal handed to the axios client / fetch ----------
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp, acc);
    else if (/\.(js|jsx)$/.test(e.name) && !/\.backup$/.test(e.name)) acc.push(fp);
  }
  return acc;
}

const callRe = new RegExp(
  '(?:client|api|axios)\\s*\\.\\s*(get|post|put|patch|delete)\\s*\\(\\s*[\'"' + BT + ']([^\'"' + BT + ']*)[\'"' + BT + ']',
  'g'
);
const fetchRe = new RegExp('fetch\\(\\s*[\'"' + BT + ']([^\'"' + BT + ']*)[\'"' + BT + ']', 'g');
// a call whose first arg is NOT a literal (a variable / concatenation) — unresolvable statically
const dynRe = /(?:client|api|axios)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*([A-Za-z_$][\w$.]*)\s*[,)]/g;

const clientCalls = [];
const dynamic = [];
for (const fp of walk(CLI)) {
  const src = fs.readFileSync(fp, 'utf8');
  const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
  const lineOf = (i) => src.slice(0, i).split('\n').length;
  callRe.lastIndex = 0;
  let c;
  while ((c = callRe.exec(src))) {
    clientCalls.push({ method: c[1].toUpperCase(), raw: c[2], file: rel, line: lineOf(c.index), kind: 'client' });
  }
  fetchRe.lastIndex = 0;
  while ((c = fetchRe.exec(src))) {
    if (!c[1].includes('/api')) continue;
    clientCalls.push({ method: 'GET', raw: c[1], file: rel, line: lineOf(c.index), kind: 'fetch' });
  }
  dynRe.lastIndex = 0;
  while ((c = dynRe.exec(src))) {
    dynamic.push({ method: c[1].toUpperCase(), expr: c[2], file: rel, line: lineOf(c.index) });
  }
}

// --selftest: plant known positives + negative controls to prove the matcher can fail
if (process.argv.includes('--selftest')) {
  clientCalls.push(
    { method: 'GET', raw: '/crm/does-not-exist', file: 'SELFTEST', line: 1, kind: 'client' },      // expect: unmatched
    { method: 'GET', raw: `/crm/leads/\${id}/ghost`, file: 'SELFTEST', line: 2, kind: 'client' },  // expect: unmatched
    { method: 'DELETE', raw: '/dashboard/stats', file: 'SELFTEST', line: 3, kind: 'client' },      // expect: method mismatch
    { method: 'GET', raw: '/dashboard/stats', file: 'SELFTEST-NEG', line: 4, kind: 'client' },     // expect: silent
    { method: 'GET', raw: `/crm/leads/\${id}`, file: 'SELFTEST-NEG', line: 5, kind: 'client' }     // expect: silent
  );
}

// ---------- 3. normalise ----------
function normClient(raw, kind) {
  let u = raw.split('?')[0];
  u = u.replace(/\$\{[^}]*\}/g, ':p');       // template holes -> a param segment
  if (kind === 'fetch') {
    u = u.replace(/^https?:\/\/[^/]+/, '');
  } else if (!u.startsWith('/api/') && u !== '/api') {
    u = '/api' + (u.startsWith('/') ? u : '/' + u);
  }
  return u.replace(/\/+$/, '') || '/api';
}
const segs = (p) => p.split('/').filter(Boolean);

function matches(cli, srv) {
  const a = segs(cli), b = segs(srv);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const A = a[i], B = b[i];
    if (B.startsWith(':')) continue;          // server param eats anything
    if (A.startsWith(':')) continue;          // client interpolation could be anything
    if (A !== B) return false;
  }
  return true;
}

const unmatched = [];
const methodOnly = [];
for (const c of clientCalls) {
  const url = normClient(c.raw, c.kind);
  const pathHits = serverRoutes.filter((s) => matches(url, s.path));
  if (pathHits.length === 0) { unmatched.push({ ...c, url }); continue; }
  if (!pathHits.some((s) => s.method === c.method)) {
    methodOnly.push({ ...c, url, serverHas: [...new Set(pathHits.map((s) => s.method))].join(',') });
  }
}

// ---------- 4. report ----------
const out = {
  serverRouteCount: serverRoutes.length,
  mountCount: mounts.length,
  missingRouteFiles: missingFiles,
  appLevelMounts: appUse,
  clientCallCount: clientCalls.length,
  dynamicFirstArgCount: dynamic.length,
  unmatchedCount: unmatched.length,
  methodMismatchCount: methodOnly.length,
  unmatched,
  methodOnly,
  dynamic,
};
fs.writeFileSync('C:/tmp/r118-clienturls.json', JSON.stringify(out, null, 1));

console.log('server routes:', serverRoutes.length, 'from', mounts.length, 'mounts');
if (missingFiles.length) console.log('!! route files not found:', missingFiles.join(', '));
console.log('client calls (literal url):', clientCalls.length, '| dynamic first arg:', dynamic.length);
console.log('');
console.log('=== NO SERVER ROUTE AT ALL (' + unmatched.length + ') ===');
for (const u of unmatched) console.log(`  ${u.method.padEnd(6)} ${u.url.padEnd(52)} ${u.file}:${u.line}`);
console.log('');
console.log('=== PATH EXISTS, WRONG METHOD (' + methodOnly.length + ') ===');
for (const u of methodOnly) console.log(`  ${u.method.padEnd(6)} ${u.url.padEnd(46)} server has ${u.serverHas.padEnd(12)} ${u.file}:${u.line}`);
console.log('');
console.log('=== DYNAMIC FIRST ARG — not statically checkable (' + dynamic.length + ') ===');
for (const d of dynamic) console.log(`  ${d.method.padEnd(6)} ${d.expr.padEnd(30)} ${d.file}:${d.line}`);
