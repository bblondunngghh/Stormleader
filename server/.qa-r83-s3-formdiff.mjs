// Run 83 s3 — FORM SUBMIT INTEGRITY.
// A <button type="submit"> renders identically whether or not its <form> handles onSubmit.
// If the form has no onSubmit, the click triggers a NATIVE form submission -> full page
// reload / navigation, silently discarding everything the user typed. Invisible to
// screenshots and to computed-style sweeps. Two directions:
//   D1: <form> with no onSubmit  (and containing a submit control)
//   D2: <button type="submit"> with no enclosing <form> in the same component
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
function openTag(code, raw, start) {
  let i = start, depth = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '{') depth++; else if (c === '}') depth--;
    else if (c === '>' && depth === 0) break;
    i++;
  }
  return { code: code.slice(start, i), raw: raw.slice(start, i), end: i };
}

const noHandler = [], orphanSubmit = [], ok = [];

for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const code = strip(raw);

  // ---- build form ranges: <form ...> ... </form>
  const forms = [];
  const reForm = /<form\b/g;
  let m;
  while ((m = reForm.exec(code))) {
    const t = openTag(code, raw, m.index);
    const close = code.indexOf('</form>', t.end);
    forms.push({
      start: m.index, end: close < 0 ? code.length : close,
      line: lineOf(code, m.index),
      onSubmit: /\bonSubmit\s*=/.test(t.code),
      selfClosing: /\/$/.test(t.code.trim()),
    });
  }

  // ---- find every submit control
  const reBtn = /<(button|input)\b/g;
  const submits = [];
  while ((m = reBtn.exec(code))) {
    const t = openTag(code, raw, m.index);
    if (!/\btype\s*=\s*["'{]?\s*["']?submit/.test(t.raw)) continue;
    submits.push({ idx: m.index, line: lineOf(code, m.index), hasClick: /\bonClick\s*=/.test(t.code) });
  }

  for (const s of submits) {
    const owner = forms.find(fo => s.idx > fo.start && s.idx < fo.end);
    if (!owner) { if (!s.hasClick) orphanSubmit.push({ f, line: s.line }); continue; }
    if (!owner.onSubmit && !s.hasClick)
      noHandler.push({ f, formLine: owner.line, btnLine: s.line });
    else ok.push(1);
  }
  // forms with onSubmit but no submit control at all -> Enter works, no button
  for (const fo of forms) {
    if (!fo.onSubmit && !submits.some(s => s.idx > fo.start && s.idx < fo.end))
      noHandler.push({ f, formLine: fo.line, btnLine: null, note: 'form has neither onSubmit nor a submit control' });
  }
}

console.log('=== D1: SUBMIT CONTROL WHOSE <form> HAS NO onSubmit (native reload, data lost) ===');
noHandler.forEach(x => console.log(`${x.f}  <form> line ${x.formLine}  submit btn line ${x.btnLine}${x.note ? '  [' + x.note + ']' : ''}`));
console.log('TOTAL D1 =', noHandler.length);
console.log('\n=== D2: type="submit" WITH NO ENCLOSING <form> AND NO onClick (dead button) ===');
orphanSubmit.forEach(x => console.log(`${x.f}:${x.line}`));
console.log('TOTAL D2 =', orphanSubmit.length);
console.log('\nwired-correctly submit controls =', ok.length);
