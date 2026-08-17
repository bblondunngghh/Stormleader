// Run 77 s1 — SET DIFFERENCE #2 (static half): which query params does each GET route READ,
// and does that route's service actually APPLY them to SQL?
//
// The user-visible failure this hunts: you set a filter, the request 200s, and the list is
// unchanged. Indistinguishable from "no matching rows" in the UI — a screenshot cannot see it.
// Static half generates candidates; .qa-r77-qprobe.mjs confirms each at runtime.
import fs from 'fs';
import path from 'path';

const rdir = 'server/src/routes';
const files = fs.readdirSync(rdir).filter((f) => f.endsWith('.js') && !f.startsWith('.'));

const out = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(rdir, f), 'utf8');
  const lines = src.split('\n');
  // slice the file into per-route blocks
  const marks = [];
  lines.forEach((l, i) => {
    const m = l.match(/router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]/);
    if (m) marks.push({ method: m[1].toUpperCase(), pat: m[2], start: i });
  });
  marks.forEach((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : lines.length;
    const block = lines.slice(mk.start, end).join('\n');
    const params = new Set();
    for (const m of block.matchAll(/req\.query\.([A-Za-z_$][\w$]*)/g)) params.add(m[1]);
    // destructured: const { a, b = 1, c: d } = req.query
    for (const m of block.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*req\.query/g)) {
      m[1].split(',').forEach((p) => {
        const name = p.split(/[:=]/)[0].trim().replace(/^\.\.\./, '');
        if (name && /^[A-Za-z_$][\w$]*$/.test(name)) params.add(name);
      });
    }
    if (params.size) out.push({ file: f, method: mk.method, pat: mk.pat, params: [...params], block });
  });
}

// Which of those params reach SQL? Look for the param name (or its snake_case form)
// appearing in the route block OR in the service the route delegates to.
const sdir = 'server/src/services';
const svc = {};
function loadDir(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) loadDir(p);
    else if (e.name.endsWith('.js')) svc[p] = fs.readFileSync(p, 'utf8');
  }
}
loadDir(sdir);
const allSvc = Object.values(svc).join('\n');

function snake(s) { return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()); }

const suspects = [];
for (const r of out) {
  for (const p of r.params) {
    const names = [p, snake(p)];
    // does the param get used for anything beyond being read out of req.query?
    const uses = (r.block.match(new RegExp('\\b' + p + '\\b', 'g')) || []).length;
    const inSql = names.some((n) => new RegExp('\\b' + n + '\\b').test(allSvc));
    // "read once and never mentioned again" is the strongest signal of a dropped param
    if (uses <= 1 && !inSql) suspects.push({ ...r, param: p, uses, inSql, block: undefined });
  }
}

console.log('=== GET routes reading query params: ' + out.length + ' ===');
out.forEach((r) => console.log(`  ${r.method} ${r.pat.padEnd(34)} (${r.file}) -> ${r.params.join(', ')}`));

console.log('\n=== STATIC SUSPECTS (param read but never used again, absent from services): '
  + suspects.length + ' ===');
suspects.forEach((s) => console.log(`  ${s.method} ${s.pat}  param='${s.param}'  (${s.file})`));

fs.writeFileSync('C:/tmp/qa-r77-qparams.json',
  JSON.stringify(out.map((r) => ({ ...r, block: undefined })), null, 1));
