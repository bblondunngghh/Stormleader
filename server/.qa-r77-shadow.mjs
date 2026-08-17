// Run 77 s1 — SET DIFFERENCE #1: routes DECLARED vs routes REACHABLE.
//
// Express matches in declaration order. Two ways a declared route becomes unreachable:
//   (a) INTRA-FILE: `router.get('/:id')` declared BEFORE `router.get('/templates')`
//       -> '/templates' is swallowed by ':id' and its handler never runs.
//   (b) INTER-ROUTER: `router.use('/crm', crmRouter)` mounted BEFORE
//       `router.use('/crm/invoices', invoicesRouter)` -> if crmRouter itself answers
//       '/invoices/...', the later, more specific router is dead.
//
// This is a static candidate generator. Every hit MUST then be confirmed at runtime
// (the Run 76 discipline: static over-reports ~5x).
import fs from 'fs';
import path from 'path';

const dir = 'server/src/routes';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && !f.startsWith('.'));

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all'];
const perFile = {};

for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const lines = src.split('\n');
  const routes = [];
  lines.forEach((line, i) => {
    const m = line.match(/router\.(get|post|put|patch|delete|all)\(\s*['"`]([^'"`]*)['"`]/);
    if (m) routes.push({ method: m[1].toUpperCase(), pat: m[2], line: i + 1 });
  });
  if (routes.length) perFile[f] = routes;
}

// ---------- (a) intra-file shadowing ----------
function segsOf(p) { return p.split('/').filter(Boolean); }

const intra = [];
for (const [f, routes] of Object.entries(perFile)) {
  for (let i = 0; i < routes.length; i++) {
    const a = routes[i];
    const aSeg = segsOf(a.pat);
    if (!aSeg.some((s) => s.startsWith(':'))) continue; // only param routes can swallow
    for (let j = i + 1; j < routes.length; j++) {
      const b = routes[j];
      if (b.method !== a.method && a.method !== 'ALL') continue;
      const bSeg = segsOf(b.pat);
      if (bSeg.length !== aSeg.length) continue;
      // does the earlier param pattern match the later literal path?
      let matches = true;
      let literalUnderParam = false;
      for (let k = 0; k < aSeg.length; k++) {
        if (aSeg[k].startsWith(':')) {
          if (bSeg[k].startsWith(':')) { matches = false; break; } // param vs param = duplicate, not shadow
          literalUnderParam = true;
          continue;
        }
        if (aSeg[k] !== bSeg[k]) { matches = false; break; }
      }
      if (matches && literalUnderParam) {
        intra.push({ file: f, method: a.method, shadower: a.pat, shadowerLine: a.line, dead: b.pat, deadLine: b.line });
      }
    }
  }
}

// ---------- (b) inter-router shadowing ----------
const idx = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const mounts = [];
for (const line of idx.split('\n')) {
  const m = line.match(/router\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)/);
  if (m) mounts.push({ prefix: m[1], router: m[2] });
}
const importMap = {};
for (const line of idx.split('\n')) {
  const m = line.match(/import\s+(\w+)\s+from\s+['"]\.\/([\w.]+)['"]/);
  if (m) importMap[m[1]] = m[2];
}

const inter = [];
for (let i = 0; i < mounts.length; i++) {
  for (let j = i + 1; j < mounts.length; j++) {
    const early = mounts[i]; const late = mounts[j];
    if (!late.prefix.startsWith(early.prefix + '/')) continue;
    // late prefix lives UNDER an earlier-mounted prefix -> the earlier router gets first refusal
    const rest = late.prefix.slice(early.prefix.length); // e.g. '/invoices'
    const earlyFile = importMap[early.router];
    const earlyRoutes = perFile[earlyFile] || [];
    const clash = earlyRoutes.filter((r) => {
      const rs = segsOf(r.pat); const ls = segsOf(rest);
      if (rs.length < ls.length) return false;
      return ls.every((s, k) => rs[k] === s || rs[k].startsWith(':'));
    });
    inter.push({
      earlyPrefix: early.prefix, earlyFile, latePrefix: late.prefix, lateFile: importMap[late.router],
      clashCount: clash.length,
      clashes: clash.slice(0, 6).map((c) => `${c.method} ${c.pat} :${c.line}`),
    });
  }
}

console.log('=== (a) INTRA-FILE SHADOWING CANDIDATES: ' + intra.length + ' ===');
intra.forEach((s) => console.log(
  `  ${s.file}: ${s.method} '${s.shadower}' (line ${s.shadowerLine}) swallows '${s.dead}' (line ${s.deadLine})`));

console.log('\n=== (b) INTER-ROUTER NESTED MOUNTS: ' + inter.length + ' ===');
inter.forEach((s) => console.log(
  `  '${s.latePrefix}' (${s.lateFile}) is mounted UNDER earlier '${s.earlyPrefix}' (${s.earlyFile})`
  + `  -> ${s.clashCount} clashing pattern(s)${s.clashCount ? ': ' + s.clashes.join(' | ') : ''}`));

fs.writeFileSync('C:/tmp/qa-r77-shadow.json', JSON.stringify({ intra, inter, mounts }, null, 1));
console.log('\nfiles scanned:', Object.keys(perFile).length, ' routes parsed:',
  Object.values(perFile).reduce((n, a) => n + a.length, 0));
