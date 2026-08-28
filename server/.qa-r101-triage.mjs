// Triage for .qa-r101-inlinehover.mjs findings.
//
// An inline property written as `background: cond ? 'x' : undefined` is NOT set
// at all in the false branch (React skips undefined), so the class's :hover rule
// applies normally there. Only an UNCONDITIONAL inline value can kill a state
// outright. Separate the two before filing anything.

import fs from 'fs';
import path from 'path';

const root = process.argv[2];
const findingsFile = process.argv[3];
const r = JSON.parse(fs.readFileSync(findingsFile, 'utf8'));

const camelToKebab = s => s.replace(/([A-Z])/g, m => '-' + m.toLowerCase());

function valueExprFor(file, line, kebabProps) {
  const src = fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/);
  // the inline style object may span several lines after the tag start
  const chunk = src.slice(line - 1, line + 14).join('\n');
  const out = {};
  for (const kp of kebabProps) {
    const camel = kp.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    for (const name of [camel, kp]) {
      const re = new RegExp('[\\s{,\'"]' + name.replace(/[-]/g, '\\-') + '\'?"?\\s*:\\s*([^\\n]*)');
      const m = chunk.match(re);
      if (m) { out[kp] = m[1].trim().replace(/,\s*$/, '').slice(0, 110); break; }
    }
  }
  return out;
}

const seen = new Set();
const rows = [];
for (const f of r.findings) {
  const k = f.file + ':' + f.line + ':' + f.cls;
  if (seen.has(k)) continue;
  seen.add(k);
  const vals = valueExprFor(f.file, f.line, f.killed);
  const conditional = Object.values(vals).every(v => /\?[\s\S]*:\s*undefined\s*$/.test(v) || /:\s*undefined\s*$/.test(v));
  const anyUnconditional = Object.entries(vals).filter(([, v]) => !/:\s*undefined\s*$/.test(v));
  rows.push({
    site: `${f.file}:${f.line}`, cls: f.cls, pseudo: f.pseudo,
    killed: f.killed, declared: f.declared,
    conditional,
    values: vals,
    unconditional: anyUnconditional.map(([p, v]) => `${p}: ${v}`),
  });
}

const cond = rows.filter(x => x.conditional);
const uncond = rows.filter(x => !x.conditional);
console.log('== CONDITIONAL (inline value is `undefined` in the default branch -> state NOT dead): ' + cond.length);
for (const x of cond) console.log('   ' + x.site + '  .' + x.cls + '  ' + JSON.stringify(x.killed));
console.log('\n== UNCONDITIONAL (inline value always set -> that property IS dead in :' + '): ' + uncond.length);
for (const x of uncond) {
  console.log('   ' + x.site + '  .' + x.cls + ' :' + x.pseudo +
    '  killed ' + JSON.stringify(x.killed) + ' of ' + JSON.stringify(x.declared));
  for (const u of x.unconditional) console.log('       ' + u);
}
