// QA Run 86 — set difference: namespace-imported API methods USED in client code
// vs methods actually EXPORTED by the target api module.
//
// WHY THIS SHAPE: `import * as fooApi from '../api/foo'` followed by `fooApi.bar()`
// is caught by NOTHING — no ESM link error (unlike a named import), no build failure.
// It fails at runtime as `TypeError: fooApi.bar is not a function`, i.e. a dead control
// or a white screen at click time. Invisible to every render-only sweep.
//
// Usage: node .qa-r86-nsapi.mjs [walkRoot] [apiRootOverride]
//   walkRoot defaults to ../client/src   (parameterized per Run 84's self-test lesson)

import fs from 'fs';
import path from 'path';

const WALK_ROOT = process.argv[2] || path.resolve('../client/src');
const API_ROOT = process.argv[3] || path.resolve('../client/src/api');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(jsx?|mjs)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

// --- Build the DEFINED side: exported names per api module ---------------
const exportsByModule = {};
for (const f of fs.readdirSync(API_ROOT)) {
  if (!/\.js$/.test(f)) continue;
  const src = fs.readFileSync(path.join(API_ROOT, f), 'utf8');
  const names = new Set();
  // export const foo = ... / export function foo / export async function foo
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  // export { a, b as c }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const as = t.match(/\bas\s+([A-Za-z0-9_$]+)$/);
      names.add(as ? as[1] : t.split(/\s+/)[0]);
    }
  }
  const hasDefault = /export\s+default/.test(src);
  exportsByModule[f.replace(/\.js$/, '')] = { names, hasDefault, star: /export\s*\*\s*from/.test(src) };
}

// --- Build the USED side -------------------------------------------------
const findings = [];
const stats = { files: 0, nsImports: 0, calls: 0 };

for (const file of walk(WALK_ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  stats.files++;
  // import * as NS from '<...>/api/MOD'
  const nsMap = {};
  for (const m of src.matchAll(/import\s*\*\s*as\s+([A-Za-z0-9_$]+)\s+from\s*['"]([^'"]*\/api\/([A-Za-z0-9_$]+))['"]/g)) {
    nsMap[m[1]] = m[3];
    stats.nsImports++;
  }
  if (!Object.keys(nsMap).length) continue;

  for (const [ns, mod] of Object.entries(nsMap)) {
    const def = exportsByModule[mod];
    if (!def) { findings.push({ file, ns, mod, member: '(MODULE NOT FOUND)', kind: 'missing-module' }); continue; }
    if (def.star) continue; // re-export * — cannot resolve statically, skip

    // NS.member  (skip NS.member as part of a longer property chain start)
    const re = new RegExp('\\b' + ns.replace(/\$/g, '\\$') + '\\s*\\.\\s*([A-Za-z0-9_$]+)', 'g');
    for (const m of src.matchAll(re)) {
      const member = m[1];
      stats.calls++;
      if (def.names.has(member)) continue;
      if (member === 'default' && def.hasDefault) continue;
      const line = src.slice(0, m.index).split('\n').length;
      findings.push({
        file: path.relative(WALK_ROOT, file), line, ns, mod, member,
        kind: 'undefined-export',
        ctx: src.split('\n')[line - 1].trim().slice(0, 110)
      });
    }
  }
}

// dedupe by file+member
const seen = new Set();
const uniq = findings.filter(f => {
  const k = f.file + '|' + f.ns + '|' + f.member;
  if (seen.has(k)) return false;
  seen.add(k); return true;
});

console.log(JSON.stringify({ walkRoot: WALK_ROOT, stats, findingCount: uniq.length, findings: uniq }, null, 2));
