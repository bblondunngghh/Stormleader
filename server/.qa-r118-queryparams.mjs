// Run 118-s2: SET DIFFERENCE — query params the CLIENT SENDS on API calls vs
// param names that appear ANYWHERE in server/src.
// Same defect family as the Stale Leads deep link (e19a5a3): a filter control the
// user can drive that the server never reads is a dead filter, and it renders and
// clicks perfectly so no rendering/interaction sweep can see it.
//
// The "defined" side is deliberately the WHOLE server tree, not just routes/ —
// Run 77-s2's standing trap is that handlers pass `req.query` straight into a
// service which destructures the names, so a routes-only grep under-counts and
// files working filters as dead. Zero occurrences anywhere is the only claim
// this harness makes.
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Projects/stormleads';
const CLI = path.join(ROOT, 'client/src');
const SRV = path.join(ROOT, 'server/src');
const BT = String.fromCharCode(96);

function walk(dir, re, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp, re, acc);
    else if (re.test(e.name) && !/\.backup$/.test(e.name)) acc.push(fp);
  }
  return acc;
}

// ---------- defined side: every identifier-ish token in the server tree ----------
const serverBlob = walk(SRV, /\.(js|mjs)$/).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const serverTokens = new Set(serverBlob.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []);

// ---------- used side: query params the client attaches ----------
// (a) `params: { a, b: x, 'c': y }` option objects on a client.<verb>() call
// (b) literal `?a=..&b=..` inside the url string
const calls = [];
for (const fp of walk(CLI, /\.(js|jsx)$/)) {
  const src = fs.readFileSync(fp, 'utf8');
  const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
  const lineOf = (i) => src.slice(0, i).split('\n').length;

  const callRe = new RegExp(
    '(?:client|api|axios)\\s*\\.\\s*(get|post|put|patch|delete)\\s*\\(\\s*[\'"' + BT + ']([^\'"' + BT + ']*)[\'"' + BT + ']',
    'g'
  );
  let m;
  while ((m = callRe.exec(src))) {
    const url = m[2];
    const line = lineOf(m.index);
    const keys = new Set();

    // literal query string in the url
    const qs = url.split('?')[1];
    if (qs) for (const k of qs.matchAll(/(?:^|&)([A-Za-z_][\w]*)=/g)) keys.add(k[1]);

    // params object in the options arg — scan forward to the balanced end of the call
    const tail = src.slice(m.index + m[0].length, m.index + m[0].length + 900);
    const pIdx = tail.search(/\bparams\s*:\s*\{/);
    if (pIdx !== -1) {
      const start = tail.indexOf('{', pIdx + tail.slice(pIdx).indexOf('params'));
      let depth = 0, end = start;
      for (let i = start; i < tail.length; i++) {
        if (tail[i] === '{') depth++;
        else if (tail[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      const body = tail.slice(start + 1, end);
      // top-level keys only
      let d = 0;
      let cur = '';
      const parts = [];
      for (const ch of body) {
        if ('{[('.includes(ch)) d++;
        else if ('}])'.includes(ch)) d--;
        if (ch === ',' && d === 0) { parts.push(cur); cur = ''; } else cur += ch;
      }
      parts.push(cur);
      for (const p of parts) {
        const km = p.match(/^\s*(?:\.\.\.)?\s*['"]?([A-Za-z_][\w]*)['"]?\s*(?::|,|$)/);
        if (km && !/^\s*\.\.\./.test(p)) keys.add(km[1]);
      }
    }
    if (keys.size) calls.push({ method: m[1].toUpperCase(), url, keys: [...keys], file: rel, line });
  }
}

const dead = [];
let totalKeys = 0;
const seen = new Set();
for (const c of calls) {
  for (const k of c.keys) {
    totalKeys++;
    if (!serverTokens.has(k)) dead.push({ ...c, key: k });
    seen.add(k);
  }
}

if (process.argv.includes('--selftest')) {
  const planted = ['definitelyNotAServerParam', 'stage', 'sort_by'];
  console.log('SELFTEST (expect: 1st absent, 2nd+3rd present):');
  for (const p of planted) console.log('  ', p.padEnd(30), serverTokens.has(p) ? 'PRESENT in server' : 'ABSENT from server');
  console.log('');
}

fs.writeFileSync('C:/tmp/r118-queryparams.json', JSON.stringify({ calls: calls.length, totalKeys, distinct: [...seen].sort(), dead }, null, 1));
console.log('client calls carrying query params:', calls.length);
console.log('param instances:', totalKeys, '| distinct names:', seen.size);
console.log('server tokens indexed:', serverTokens.size);
console.log('');
console.log('=== PARAM NAME APPEARS NOWHERE IN server/src (' + dead.length + ') ===');
for (const d of dead) console.log(`  ${d.key.padEnd(24)} ${d.method} ${d.url.padEnd(40)} ${d.file}:${d.line}`);
