// Run 118-s2: SET DIFFERENCE — query keys the client PUTS INTO internal links
// vs query keys the destination route actually READS.
// A generated key nobody reads is a silently-dropped intent: the link navigates
// (so every rendering/click sweep passes it) but the filter/sort/preselect is lost.
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Projects/stormleads';
const CLI = path.join(ROOT, 'client/src');
const BT = String.fromCharCode(96);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp, acc);
    else if (/\.jsx?$/.test(e.name) && !/\.backup$/.test(e.name)) acc.push(fp);
  }
  return acc;
}

// route -> component file, from App.jsx
const app = fs.readFileSync(path.join(CLI, 'App.jsx'), 'utf8');
const routeEls = [...app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<(\w+)/g)]
  .map((m) => ({ path: m[1], comp: m[2] }));
const lazy = Object.fromEntries(
  [...app.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:lazy\()?\s*(?:\(\)\s*=>\s*)?import\(['"]\.\/([^'"]+)['"]/g)]
    .map((m) => [m[1], m[2]])
);
const staticImp = Object.fromEntries(
  [...app.matchAll(/import\s+(\w+)\s+from\s+['"]\.\/([^'"]+)['"]/g)].map((m) => [m[1], m[2]])
);

function fileFor(comp) {
  const rel = lazy[comp] || staticImp[comp];
  if (!rel) return null;
  for (const ext of ['', '.jsx', '.js']) {
    const fp = path.join(CLI, rel + ext);
    if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return fp;
  }
  return null;
}

// ---- keys READ per component file ----
function keysRead(fp) {
  if (!fp || !fs.existsSync(fp)) return null;
  const src = fs.readFileSync(fp, 'utf8');
  const ks = new Set();
  for (const m of src.matchAll(/searchParams\.get\(\s*['"]([^'"]+)['"]/g)) ks.add(m[1]);
  for (const m of src.matchAll(/params\.get\(\s*['"]([^'"]+)['"]/g)) ks.add(m[1]);
  return ks;
}

// ---- links GENERATED anywhere in the client ----
// The "used" side must cover EVERY way this app changes route, not just react-router.
// Run 118 first shipped this with only navigate()/to=/href= and missed
// `window.location.href = `/expenses?leadId=${id}`` in LeadDetail — a full-page
// assignment is still a deep link, and it dropped its param exactly like the
// navigate() case did. Same "too-narrow side" failure the gotchas keep recording.
const genRe = new RegExp(
  '(?:navigate\\(|to=\\{?|href=\\{?|(?:window\\.)?location\\.href\\s*=|(?:window\\.)?location\\.assign\\(|window\\.open\\()' +
  '\\s*[\'"' + BT + '](\\/[^\'"' + BT + ']*\\?[^\'"' + BT + ']*)[\'"' + BT + ']',
  'g'
);

const links = [];
for (const fp of walk(CLI)) {
  const src = fs.readFileSync(fp, 'utf8');
  const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
  genRe.lastIndex = 0;
  let m;
  while ((m = genRe.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length;
    links.push({ raw: m[1], file: rel, line });
  }
}

// match a generated pathname to a <Route path>
function routeFor(pathname) {
  const a = pathname.split('/').filter(Boolean);
  for (const r of routeEls) {
    const b = r.path.split('/').filter(Boolean);
    if (b.length !== a.length) continue;
    let ok = true;
    for (let i = 0; i < a.length; i++) {
      if (b[i].startsWith(':')) continue;
      if (a[i].startsWith('$') || a[i].includes('${')) continue;
      if (a[i] !== b[i]) { ok = false; break; }
    }
    if (ok) return r;
  }
  return null;
}

const findings = [];
const ok = [];
for (const L of links) {
  const [pathname, qs] = L.raw.split('?');
  // template holes inside the query string: `?a=${x}&b=${y}` -> keys are still literal
  const keys = [...qs.matchAll(/(?:^|&|\$\{[^}]*\}&)\s*([A-Za-z_][\w]*)=/g)].map((m) => m[1]);
  const r = routeFor(pathname.replace(/\$\{[^}]*\}/g, 'X'));
  if (!r) { findings.push({ ...L, why: 'NO MATCHING <Route>', keys }); continue; }
  const read = keysRead(fileFor(r.comp));
  if (read === null) { findings.push({ ...L, why: 'component file not resolved: ' + r.comp, keys }); continue; }
  const dropped = keys.filter((k) => !read.has(k));
  const row = { ...L, route: r.path, comp: r.comp, keys, reads: [...read] };
  if (dropped.length) findings.push({ ...row, why: 'KEY NEVER READ', dropped });
  else ok.push(row);
}

fs.writeFileSync('C:/tmp/r118-deeplinks.json', JSON.stringify({ links: links.length, findings, ok }, null, 1));
console.log('routes in App.jsx:', routeEls.length);
console.log('internal links carrying a query string:', links.length);
console.log('clean:', ok.length, '| suspect:', findings.length);
console.log('');
for (const f of findings) {
  console.log(`!! ${f.why}`);
  console.log(`   ${f.raw}`);
  console.log(`   ${f.file}:${f.line}  -> ${f.comp || '?'} reads [${(f.reads || []).join(', ')}]`);
  if (f.dropped) console.log(`   DROPPED: ${f.dropped.join(', ')}`);
  console.log('');
}
console.log('--- clean ---');
for (const o of ok) console.log(`   ${o.raw.padEnd(58)} ${o.comp} <- ${o.file}:${o.line}`);
