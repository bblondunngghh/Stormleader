import fs from 'fs';
import path from 'path';

const routes = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const CLIENT = 'C:/Projects/stormleads/client/src';

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|jsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = walk(CLIENT);
const calls = [];
const re = /\b(?:client|axios|api)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*(['"`])((?:[^'"`\\]|\\.)*)\2/g;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(src)) !== null) {
    const line = src.slice(0, m.index).split('\n').length;
    calls.push({ file: path.relative(CLIENT, f).split(path.sep).join('/'), line, method: m[1].toUpperCase(), raw: m[3] });
  }
}

function norm(raw) {
  let p = raw.replace(/\$\{[^}]*\}/g, ':p');
  if (!p.startsWith('/')) return null;
  if (!p.startsWith('/api')) p = '/api' + p;
  p = p.split('?')[0].replace(/\/$/, '');
  return p;
}

const serverSet = routes.map(r => ({ ...r, seg: r.path.split('/') }));
function matches(cp, method) {
  const cs = cp.split('/');
  return serverSet.some(r => r.method === method && r.seg.length === cs.length &&
    r.seg.every((s, i) => s.startsWith(':') || cs[i].startsWith(':p') || s === cs[i]));
}
function anyMethod(cp) {
  const cs = cp.split('/');
  return serverSet.filter(r => r.seg.length === cs.length &&
    r.seg.every((s, i) => s.startsWith(':') || cs[i].startsWith(':p') || s === cs[i])).map(r => r.method);
}

const bad = [];
for (const c of calls) {
  const p = norm(c.raw);
  if (!p) continue;
  if (!matches(p, c.method)) bad.push({ ...c, norm: p, serverHasPathWithMethods: anyMethod(p) });
}
console.log('total client API call sites:', calls.length);
console.log('UNMATCHED:', bad.length);
console.log(JSON.stringify(bad, null, 1));
