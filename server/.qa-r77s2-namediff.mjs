// Run 77 s2 — set differences over TWO new kinds of name:
//   (A) navigate('/x') / <Link to="/x"> targets  vs  <Route path> defined in App.jsx
//   (B) query params the CLIENT sends            vs  req.query.* the SERVER reads
// Static candidates only — every hit must be confirmed at runtime before filing.
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
const rel = (f) => f.replace(/\\/g, '/').replace(ROOT + '/', '');

// ---------- (A) ROUTES ----------
const app = fs.readFileSync(`${ROOT}/client/src/App.jsx`, 'utf8');
const defined = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
const definedNorm = defined.map((d) => d.replace(/:[A-Za-z0-9_]+/g, '*'));
const routeMatches = (p) => {
  const c = p.split('?')[0].split('#')[0].replace(/\/$/, '').split('/');
  return definedNorm.some((d) => {
    if (d === '*' || d === '/*') return false; // catch-all: matching it means a SILENT redirect
    const s = d.replace(/\/$/, '').split('/');
    if (s.length !== c.length) return false;
    return s.every((seg, i) => seg === '*' || c[i] === '*' || seg === c[i]);
  });
};

const clientFiles = walk(`${ROOT}/client/src`);
const navHits = [];
for (const f of clientFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const pats = [
    /navigate\(\s*(['`])(\/[^'`]*)\1/g,
    /\bto=\{?\s*(['`])(\/[^'`]*)\1/g,
    /window\.location\.href\s*=\s*(['`])(\/[^'`]*)\1/g,
  ];
  for (const re of pats) {
    for (const m of src.matchAll(re)) {
      const raw = m[2];
      const p = raw.replace(/\$\{[^}]*\}/g, '*');
      if (p.startsWith('/api')) continue; // API URLs, covered by the other diff
      const line = src.slice(0, m.index).split('\n').length;
      if (!routeMatches(p)) navHits.push({ p, raw, file: rel(f), line });
    }
  }
}

// ---------- (B) QUERY PARAMS ----------
// client side: params object literals passed to client.get('/x', { params: {...} }) and ?a=b in URLs
const clientParams = new Map(); // endpointKey -> Set(param)
const addP = (ep, name, file, line) => {
  const k = ep;
  if (!clientParams.has(k)) clientParams.set(k, []);
  clientParams.get(k).push({ name, file, line });
};
for (const f of clientFiles) {
  const src = fs.readFileSync(f, 'utf8');
  // client.get('/path', { params: { a, b: x } })
  for (const m of src.matchAll(/\b(?:client|api)\.get\(\s*(['`])([^'`]+)\1\s*,\s*\{\s*params:\s*\{([^}]*)\}/g)) {
    const ep = m[2].replace(/\$\{[^}]*\}/g, '*').split('?')[0];
    const line = src.slice(0, m.index).split('\n').length;
    for (const kv of m[3].split(',')) {
      const name = kv.split(':')[0].trim().replace(/['"]/g, '');
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) addP(ep, name, rel(f), line);
    }
  }
  // inline query strings: '/path?a=1&b=2'
  for (const m of src.matchAll(/(['`])(\/[A-Za-z0-9_\-/*${}.]+)\?([A-Za-z0-9_=&$%{}.\-*]+)\1/g)) {
    const ep = m[2].replace(/\$\{[^}]*\}/g, '*');
    const line = src.slice(0, m.index).split('\n').length;
    for (const pair of m[3].split('&')) {
      const name = pair.split('=')[0];
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) addP(ep, name, rel(f), line);
    }
  }
  // URLSearchParams append/set
  for (const m of src.matchAll(/\b(?:params|qs|sp|searchParams)\.(?:append|set)\(\s*['`]([A-Za-z0-9_]+)['`]/g)) {
    const line = src.slice(0, m.index).split('\n').length;
    addP('<usp>', m[1], rel(f), line);
  }
}

// server side: every req.query.X and destructured { a, b } = req.query, per route file
const serverFiles = walk(`${ROOT}/server/src/routes`);
const serverParams = new Set();
for (const f of serverFiles) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/req\.query\.([A-Za-z0-9_]+)/g)) serverParams.add(m[1]);
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*req\.query/g)) {
    for (const kv of m[1].split(',')) {
      const name = kv.split(/[:=]/)[0].trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) serverParams.add(name);
    }
  }
  for (const m of src.matchAll(/req\.query\[\s*['`]([A-Za-z0-9_]+)['`]\s*\]/g)) serverParams.add(m[1]);
}
// services also read query-derived filters — include them so we do not over-report
for (const f of walk(`${ROOT}/server/src/services`)) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/req\.query\.([A-Za-z0-9_]+)/g)) serverParams.add(m[1]);
}

const orphanParams = [];
for (const [ep, list] of clientParams) {
  for (const { name, file, line } of list) {
    if (!serverParams.has(name)) orphanParams.push({ ep, name, file, line });
  }
}

const out = { definedRoutes: defined, navUnmatched: navHits, serverParamCount: serverParams.size, orphanParams };
fs.writeFileSync('C:/tmp/r77s2-namediff.json', JSON.stringify(out, null, 2));
console.log('=== (A) navigate/Link targets with NO matching <Route> (would silently redirect to Dashboard) ===');
console.log(navHits.length ? navHits.map((h) => `  ${h.p.padEnd(34)} ${h.file}:${h.line}`).join('\n') : '  none');
console.log(`\n=== (B) query params sent by client but never read by server (${serverParams.size} server params known) ===`);
console.log(orphanParams.length ? orphanParams.map((h) => `  ${h.name.padEnd(20)} -> ${h.ep.padEnd(28)} ${h.file}:${h.line}`).join('\n') : '  none');
