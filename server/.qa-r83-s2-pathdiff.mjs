import fs from 'fs';
import path from 'path';

const BS = String.fromCharCode(92);
const toPosix = (p) => p.split(BS).join('/');

const walk = (d, acc = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|dist|[.]git/.test(p)) walk(p, acc); }
    else if (/[.](jsx?|tsx?)$/.test(e.name)) acc.push(p);
  }
  return acc;
};

// --- CLIENT SIDE: every client.<verb>('<path>') literal (incl. template literals)
const calls = [];
for (const f of walk('client/src')) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((ln, i) => {
    const re = /\bclient\s*\.\s*(get|post|put|patch|delete)\s*\(\s*[`'"]([^`'"]+)[`'"]/g;
    let m;
    while ((m = re.exec(ln))) calls.push({ file: toPosix(f), line: i + 1, verb: m[1].toUpperCase(), p: m[2] });
  });
}

// --- SERVER SIDE: mount prefixes from routes/index.js x router paths in each module
const idx = fs.readFileSync('server/src/routes/index.js', 'utf8');
const mounts = [];
{ const re = /router\.use\(\s*['"]([^'"]+)['"]\s*,\s*(?:[a-zA-Z]+\s*,\s*)*(\w+)\s*\)/g; let m; while ((m = re.exec(idx))) mounts.push({ prefix: m[1], mod: m[2] }); }
const imports = {};
{ const re = /import\s+(\w+)\s+from\s+['"][.]\/([^'"]+)['"]/g; let m; while ((m = re.exec(idx))) imports[m[1]] = m[2]; }

const serverRoutes = [];
const unresolved = [];
for (const mt of mounts) {
  const file = imports[mt.mod];
  if (!file) { unresolved.push(mt); continue; }
  const fp = 'server/src/routes/' + file.replace(/[.]js$/, '') + '.js';
  if (!fs.existsSync(fp)) { unresolved.push(mt); continue; }
  const src = fs.readFileSync(fp, 'utf8');
  const re = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    let full = (mt.prefix + m[2]).replace(/\/+$/, '') || '/';
    serverRoutes.push({ verb: m[1].toUpperCase(), p: full, src: fp });
  }
}

const escape = (s) => s.split('/').join(BS + '/');
const toRe = (p) => new RegExp('^' + escape(p).replace(/:[^/\\]+/g, '[^/]+') + '$');
const norm = (p) => {
  let t = p.split('?')[0];
  t = t.replace(/[$][{][^}]*[}]/g, 'X');
  if (!t.startsWith('/')) t = '/' + t;
  return t.replace(/\/+$/, '') || '/';
};

const misses = [];
for (const c of calls) {
  if (/^https?:/.test(c.p)) continue;
  const target = norm(c.p);
  const hit = serverRoutes.some((r) => r.verb === c.verb && toRe(r.p).test(target));
  if (hit) continue;
  const otherVerbs = serverRoutes.filter((r) => toRe(r.p).test(target)).map((r) => r.verb);
  misses.push({ ...c, target, otherVerbs });
}

console.log('client calls:', calls.length, '| server routes:', serverRoutes.length, '| unresolved mounts:', unresolved.length, '| MISSES:', misses.length);
if (unresolved.length) console.log('UNRESOLVED MOUNTS:', JSON.stringify(unresolved));
for (const m of misses) {
  const kind = m.otherVerbs.length ? 'VERB(has ' + m.otherVerbs.join(',') + ')' : 'NO-PATH';
  console.log(kind.padEnd(22), m.verb.padEnd(6), m.target.padEnd(52), m.file + ':' + m.line);
}
