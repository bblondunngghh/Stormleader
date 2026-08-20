// Run 83 s3 — set differences that find CONTROLS THAT RENDER PERFECTLY AND DO NOTHING.
// A) useState setter declared but never called     -> state frozen at its initial value
// B) <button> with no onClick and not type=submit  -> click does nothing
// C) controlled <input value={x}> with no onChange -> field cannot be typed into
//
// STRIPPER TRAPS (both cost this run turns — see qa_standing_gotchas):
//  1. An apostrophe in JSX TEXT ("Don't") is not a string delimiter. Treating it as one
//     eats the rest of the file and every setter call in it reads as "never called".
//     Guard: a quote only opens a string in EXPRESSION POSITION (prev non-space char is
//     not alphanumeric/`)`/`]`), and a '/" string NEVER spans a newline.
//  2. Replace stripped text with SPACES, keeping newlines, so offsets still map to the
//     raw file and reported line numbers are correct.
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
  const n = src.length;
  let out = '';
  let i = 0;
  let prev = '';                                   // last non-space char emitted
  const exprPos = () => !/[A-Za-z0-9_$)\]]/.test(prev);
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') {
      const e = src.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2;
      out += blank(src.slice(i, end)); i = end; continue;
    }
    if (c === '/' && d === '/') {
      const e = src.indexOf('\n', i); const end = e < 0 ? n : e;
      out += blank(src.slice(i, end)); i = end; continue;
    }
    if ((c === '"' || c === "'") && exprPos()) {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
      if (src[j] === c) { out += blank(src.slice(i, j + 1)); i = j + 1; prev = '_'; continue; }
      // unterminated on this line -> it was JSX text, not a string. Emit verbatim.
    }
    if (c === '`') {
      let j = i + 1; out += ' ';
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') { out += '  '; j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') {            // keep interpolations
          let depth = 1; out += '  '; j += 2;
          while (j < n && depth > 0) {
            if (src[j] === '{') depth++;
            else if (src[j] === '}') depth--;
            out += depth > 0 ? src[j] : ' ';
            j++;
          }
          continue;
        }
        out += src[j] === '\n' ? '\n' : ' ';
        j++;
      }
      out += ' '; i = j + 1; prev = '_'; continue;
    }
    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

// read the JSX open tag starting at idx, respecting {} nesting; returns RAW text
function openTag(code, raw, start) {
  let i = start, depth = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) break;
    i++;
  }
  return { code: code.slice(start, i), raw: raw.slice(start, i) };
}

const frozen = [], deadBtn = [], frozenInput = [];

for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const code = strip(raw);
  if (code.length !== raw.length) console.error('!! offset drift in ' + f);

  // ---- A: frozen state
  let m;
  const reState = /const\s*\[\s*([A-Za-z0-9_$]+)\s*,\s*(set[A-Za-z0-9_$]+)\s*\]\s*=\s*useState/g;
  while ((m = reState.exec(code))) {
    const [, state, setter] = m;
    const calls = (code.match(new RegExp('\\b' + setter + '\\b', 'g')) || []).length;
    const reads = (code.match(new RegExp('\\b' + state + '\\b', 'g')) || []).length;
    if (calls <= 1) frozen.push({ f, state, setter, reads, line: lineOf(code, m.index) });
  }

  // ---- B: dead buttons
  const reBtn = /<button\b/g;
  while ((m = reBtn.exec(code))) {
    const t = openTag(code, raw, m.index);
    const hasHandler = /\bon(Click|MouseDown|PointerDown|MouseUp|Touch\w+)\s*=/.test(t.code);
    const isSubmit = /\btype\s*=\s*["'{]?\s*["']?submit/.test(t.raw);   // RAW: strings are blanked in code
    const spread = /\{\s*\.\.\./.test(t.code);
    if (!hasHandler && !isSubmit && !spread)
      deadBtn.push({ f, line: lineOf(code, m.index), tag: t.raw.replace(/\s+/g, ' ').slice(0, 100) });
  }

  // ---- C: frozen inputs
  const reIn = /<(input|textarea)\b/g;
  while ((m = reIn.exec(code))) {
    const t = openTag(code, raw, m.index);
    const controlled = /\b(value|checked)\s*=\s*\{/.test(t.code);
    const hasChange = /\bon(Change|Input)\s*=/.test(t.code);
    const inert = /\breadOnly\b/.test(t.code) || /\bdisabled\b/.test(t.code) || /\btype\s*=\s*["']?(hidden|submit|button)/.test(t.raw);
    const spread = /\{\s*\.\.\./.test(t.code);
    if (controlled && !hasChange && !inert && !spread)
      frozenInput.push({ f, line: lineOf(code, m.index), tag: t.raw.replace(/\s+/g, ' ').slice(0, 100) });
  }
}

console.log('=== A: FROZEN STATE — useState setter never called ===');
frozen.forEach(x => console.log(`${x.f}:${x.line}  [${x.state}, ${x.setter}]  stateRefs=${x.reads}`));
console.log('TOTAL A =', frozen.length);
console.log('\n=== B: BUTTON WITH NO CLICK HANDLER AND NOT type=submit ===');
deadBtn.forEach(x => console.log(`${x.f}:${x.line}  ${x.tag}`));
console.log('TOTAL B =', deadBtn.length);
console.log('\n=== C: CONTROLLED INPUT WITH NO onChange ===');
frozenInput.forEach(x => console.log(`${x.f}:${x.line}  ${x.tag}`));
console.log('TOTAL C =', frozenInput.length);
