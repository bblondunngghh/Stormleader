// QA Run 86 — set difference: useState values that are WRITTEN by a handler
// but never READ anywhere in the file.
//
// WHY THIS SHAPE: distinct from Run 84's CHECK B (setter in branch A, reader in
// branch B). Here there is NO reader at all — the control fires, state updates,
// React re-renders, and nothing on screen depends on it. Looks exactly like a
// dead button and is invisible to render-only sweeps.
//
// Usage: node .qa-r86-deadstate.mjs [walkRoot]

import fs from 'fs';
import path from 'path';

const WALK_ROOT = process.argv[2] || path.resolve('../client/src');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.jsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

// Comments/strings must go: prose mentioning a variable name inflates the read count
// and hides a genuinely dead value. (Same trap that broke the props harness.)
function stripNoise(src) {
  // Strip COMMENTS ONLY. Do NOT track string literals: an apostrophe in JSX text
  // ("you're all clear") is not a string delimiter, but a naive stripper treats it
  // as one and blanks everything to the next apostrophe — silently deleting whole
  // regions of the file and manufacturing both false positives and false negatives.
  let out = '', i = 0;
  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2; continue;
    }
    // line comment, but not the "//" in a URL like http://
    if (src[i] === '/' && src[i + 1] === '/' && (i === 0 || src[i - 1] !== ':')) {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    out += src[i]; i++;
  }
  return out;
}

const findings = [];
const stats = { files: 0, states: 0 };

for (const file of walk(WALK_ROOT)) {
  const raw = fs.readFileSync(file, 'utf8');
  const src = stripNoise(raw);
  stats.files++;

  // const [foo, setFoo] = useState(...)
  for (const m of src.matchAll(/const\s*\[\s*([A-Za-z0-9_$]+)\s*,\s*([A-Za-z0-9_$]+)\s*\]\s*=\s*useState\s*\(/g)) {
    const [, value, setter] = m;
    stats.states++;

    // count READS of `value` that are not the declaration itself
    const readRe = new RegExp('(?<![.\\w$])' + value.replace(/\$/g, '\\$') + '(?![\\w$])', 'g');
    const allRefs = [...src.matchAll(readRe)];
    // the declaration contributes exactly one occurrence
    const reads = allRefs.filter(r => r.index !== m.index + m[0].indexOf(value)).length;

    // count WRITES via the setter
    const setRe = new RegExp('(?<![.\\w$])' + setter.replace(/\$/g, '\\$') + '\\s*\\(', 'g');
    const writes = [...src.matchAll(setRe)].length;

    if (writes > 0 && reads === 0) {
      const line = src.slice(0, m.index).split('\n').length;
      findings.push({
        file: path.relative(WALK_ROOT, file), line, value, setter, writes,
        ctx: raw.split('\n')[line - 1].trim().slice(0, 100)
      });
    }
  }
}

console.log(JSON.stringify({ walkRoot: WALK_ROOT, stats, findingCount: findings.length, findings }, null, 2));
