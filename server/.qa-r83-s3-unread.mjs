// Run 83 s3 — the INVERSE of the frozen-state check:
// a boolean UI flag whose setter IS called (a button flips it) but whose STATE VARIABLE
// is never read anywhere -> the control fires, nothing renders. "Renders perfectly, does nothing."
// Scoped to show*/is*/open*/active*/expanded*/editing* booleans, i.e. overlay + disclosure flags,
// which Run 82's form-bound-state sweep did not cover.
import fs from 'fs';
import path from 'path';

const root = 'client/src';
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.jsx?$/.test(f)) files.push(p.replace(/\\/g, '/'));
  }
})(root);

const blank = s => s.replace(/[^\n]/g, ' ');
function strip(src) {
  const n = src.length; let out = '', i = 0, prev = '';
  const exprPos = () => !/[A-Za-z0-9_$)\]]/.test(prev);
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2), end = e < 0 ? n : e + 2; out += blank(src.slice(i, end)); i = end; continue; }
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i), end = e < 0 ? n : e; out += blank(src.slice(i, end)); i = end; continue; }
    if ((c === '"' || c === "'") && exprPos()) {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
      if (src[j] === c) { out += blank(src.slice(i, j + 1)); i = j + 1; prev = '_'; continue; }
    }
    if (c === '`') {
      let j = i + 1; out += ' ';
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') { out += '  '; j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') {
          let depth = 1; out += '  '; j += 2;
          while (j < n && depth > 0) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; out += depth > 0 ? src[j] : ' '; j++; }
          continue;
        }
        out += src[j] === '\n' ? '\n' : ' '; j++;
      }
      out += ' '; i = j + 1; prev = '_'; continue;
    }
    out += c; if (!/\s/.test(c)) prev = c; i++;
  }
  return out;
}
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

const hits = [];
for (const f of files) {
  const code = strip(fs.readFileSync(f, 'utf8'));
  const re = /const\s*\[\s*([A-Za-z0-9_$]+)\s*,\s*(set[A-Za-z0-9_$]+)\s*\]\s*=\s*useState\s*\(/g;
  let m;
  while ((m = re.exec(code))) {
    const [, state, setter] = m;
    if (!/^(show|is|open|active|expanded|editing|has|collapsed|visible)/i.test(state)) continue;
    const setCalls = (code.match(new RegExp('\\b' + setter + '\\s*\\(', 'g')) || []).length;
    // reads = every mention of the state var minus its single declaration site
    const reads = (code.match(new RegExp('\\b' + state + '\\b', 'g')) || []).length - 1;
    if (setCalls >= 1 && reads === 0)
      hits.push({ f, line: lineOf(code, m.index), state, setter, setCalls });
  }
}
console.log('=== FLAG SET BUT NEVER READ (control fires, nothing renders) ===');
hits.forEach(h => console.log(`${h.f}:${h.line}  ${h.state} — ${h.setter} called ${h.setCalls}x, state read 0x`));
console.log('TOTAL =', hits.length);
