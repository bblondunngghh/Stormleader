#!/usr/bin/env node
/**
 * Run 102 (s3-ui-audit) — DUPLICATE-DECLARATION sweep.
 *
 * Same defect family as the last 6 runs ("a declaration silently loses"), but the
 * most clear-cut variant of all: a value is dropped by the LANGUAGE, with no
 * cascade, no specificity and no source-order subtlety involved.
 *
 *   CHECK A — duplicate JSX ATTRIBUTE on one element.
 *       <button onClick={a} ... onClick={b}>   -> React silently uses ONLY b.
 *       A duplicate onClick/className/style is a 100% dead handler or style,
 *       and NO rendering check can see it: the element looks perfectly normal.
 *
 *   CHECK B — duplicate KEY in one inline style object.
 *       style={{ color: 'a', color: 'b' }}     -> JS object literal, 'a' is gone.
 *
 *   CHECK C — duplicate PROPERTY in one CSS rule.
 *       .x { color: red; color: blue }         -> red is gone.
 *       (Run 89 covered duplicate SELECTORS; duplicate props inside one rule
 *        were never checked.)
 *
 * Usage:
 *   node .qa-r102-dupekey.mjs <jsx-walk-root> <css-file>
 *   node .qa-r102-dupekey.mjs --selftest
 */

import fs from 'fs';
import path from 'path';

const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

// Attributes where a duplicate is genuinely destructive. Deliberately narrow:
// data-*/aria-* duplicates are noise, and we want zero false alarms.
const ATTRS_OF_INTEREST = new Set([
  'classname', 'style', 'onclick', 'onchange', 'onsubmit', 'onblur', 'onfocus',
  'onmouseenter', 'onmouseleave', 'onkeydown', 'onkeyup', 'value', 'disabled',
  'type', 'placeholder', 'key', 'id', 'src', 'href', 'checked', 'title',
  'ondragstart', 'ondragover', 'ondrop', 'readonly', 'name',
]);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/./g, ' '));
}

/** Scan forward from the '<' of a JSX tag, returning the attribute names in order.
 *  Per the Run 86 trap: '>' only closes the tag at brace depth 0. */
function tagAttrs(src, start) {
  let i = start + 1;
  // tag name
  const nm = /^[A-Za-z][\w.$-]*/.exec(src.slice(i));
  if (!nm) return null;
  i += nm[0].length;
  const attrs = [];
  let depth = 0, q = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '\\') { i++; continue; }
      if (ch === q) q = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
    if (ch === '{' || ch === '(' || ch === '[') { depth++; continue; }
    if (ch === '}' || ch === ')' || ch === ']') { depth--; continue; }
    if (depth === 0) {
      if (ch === '>') break;
      if (ch === '<') return null; // malformed / not a tag
      const am = /^([A-Za-z_][\w:.-]*)\s*=/.exec(src.slice(i));
      if (am && (i === start + 1 + nm[0].length || /[\s{}]/.test(src[i - 1]))) {
        attrs.push({ name: am[1], idx: i });
        i += am[1].length;
      }
    }
  }
  return { tag: nm[0], attrs, end: i };
}

function scanJsxFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const src = stripComments(raw);
  const lineAt = (idx) => src.slice(0, idx).split('\n').length;
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const hits = [];

  // ---- CHECK A: duplicate JSX attribute ----
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '<') continue;
    if (!/[A-Za-z]/.test(src[i + 1] || '')) continue;
    const t = tagAttrs(src, i);
    if (!t || !t.attrs.length) continue;
    const seen = new Map();
    for (const a of t.attrs) {
      const k = a.name.toLowerCase();
      if (!ATTRS_OF_INTEREST.has(k)) continue;
      if (seen.has(k)) {
        hits.push({
          check: 'A-dup-jsx-attr', file: rel, tag: t.tag,
          prop: a.name,
          deadLine: lineAt(seen.get(k)),
          winnerLine: lineAt(a.idx),
          detail: src.slice(seen.get(k), Math.min(seen.get(k) + 70, src.length)).replace(/\s+/g, ' '),
        });
      }
      seen.set(k, a.idx);
    }
    i = t.end;
  }

  // ---- CHECK B: duplicate key in one inline style object ----
  const re = /style\s*=\s*\{\{/g;
  let m;
  while ((m = re.exec(src))) {
    const objStart = m.index + m[0].length - 1;
    let depth = 0, k = objStart, q = null, end = -1;
    for (; k < src.length; k++) {
      const ch = src[k];
      if (q) { if (ch === '\\') { k++; continue; } if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
      if (ch === '{' || ch === '(' || ch === '[') depth++;
      else if (ch === '}' || ch === ')' || ch === ']') { depth--; if (depth === 0) { end = k; break; } }
    }
    if (end === -1) continue;
    const body = src.slice(objStart + 1, end);
    const decls = [];
    let d = 0, cur = '', curStart = objStart + 1;
    q = null;
    for (let z = 0; z < body.length; z++) {
      const ch = body[z];
      if (q) { cur += ch; if (ch === '\\') { cur += body[++z] || ''; continue; } if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { q = ch; cur += ch; continue; }
      if (ch === '{' || ch === '(' || ch === '[') d++;
      else if (ch === '}' || ch === ')' || ch === ']') d--;
      if (ch === ',' && d === 0) { push(cur, curStart); cur = ''; curStart = objStart + 1 + z + 1; }
      else cur += ch;
    }
    push(cur, curStart);
    function push(text, startIdx) {
      const t = text.trim();
      if (!t || t.startsWith('...')) return;
      let dd = 0, qq = null, ci = -1;
      for (let z = 0; z < t.length; z++) {
        const c = t[z];
        if (qq) { if (c === '\\') { z++; continue; } if (c === qq) qq = null; continue; }
        if (c === '"' || c === "'" || c === '`') { qq = c; continue; }
        if (c === '{' || c === '(' || c === '[') dd++;
        else if (c === '}' || c === ')' || c === ']') dd--;
        else if (c === ':' && dd === 0) { ci = z; break; }
      }
      if (ci <= 0) return;
      const key = t.slice(0, ci).trim().replace(/^['"`]|['"`]$/g, '');
      if (!/^[A-Za-z-][A-Za-z0-9-]*$/.test(key)) return;
      decls.push({ prop: kebab(key).toLowerCase(), value: t.slice(ci + 1).trim().replace(/\s+/g, ' ').slice(0, 60), line: lineAt(startIdx) });
    }
    const seen = new Map();
    for (const dcl of decls) {
      if (seen.has(dcl.prop)) {
        const prev = seen.get(dcl.prop);
        hits.push({
          check: 'B-dup-style-key', file: rel, tag: 'style={{…}}',
          prop: dcl.prop, deadLine: prev.line, winnerLine: dcl.line,
          detail: `${dcl.prop}: ${prev.value}  ->DROPPED, kept-> ${dcl.value}`,
          sameValue: prev.value === dcl.value,
        });
      }
      seen.set(dcl.prop, dcl);
    }
  }
  return hits;
}

// ---- CHECK C: duplicate property in one CSS rule ----
function scanCss(cssPath) {
  const raw = fs.readFileSync(cssPath, 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const lineAt = (idx) => src.slice(0, idx).split('\n').length;
  const hits = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open === -1) break;
    const close = src.indexOf('}', open);
    const nextOpen = src.indexOf('{', open + 1);
    if (close === -1) break;
    if (nextOpen !== -1 && nextOpen < close) { i = nextOpen; continue; }
    const selector = src.slice(src.lastIndexOf('}', open - 1) + 1, open).trim().replace(/\s+/g, ' ');
    const body = src.slice(open + 1, close);
    const decls = [];
    let depth = 0, cur = '', start = open + 1;
    const flush = (k) => {
      const c = cur.indexOf(':');
      if (c > 0) {
        const p = cur.slice(0, c).trim().toLowerCase();
        if (/^[a-z-]+$/.test(p) && !p.startsWith('--')) {
          decls.push({ prop: p, value: cur.slice(c + 1).trim().slice(0, 60), line: lineAt(start) });
        }
      }
      cur = ''; start = open + 1 + k + 1;
    };
    for (let k = 0; k < body.length; k++) {
      const ch = body[k];
      if (ch === '(') depth++; else if (ch === ')') depth--;
      if (ch === ';' && depth === 0) flush(k); else cur += ch;
    }
    flush(body.length);
    const seen = new Map();
    for (const d of decls) {
      if (seen.has(d.prop)) {
        const prev = seen.get(d.prop);
        // an intentional progressive-enhancement fallback repeats the SAME prop
        // with a different unit/function; flag it but mark same-value dupes.
        hits.push({
          check: 'C-dup-css-prop', file: path.basename(cssPath),
          tag: selector.slice(0, 70), prop: d.prop,
          deadLine: prev.line, winnerLine: d.line,
          detail: `${d.prop}: ${prev.value}  ->DROPPED, kept-> ${d.value}`,
          sameValue: prev.value === d.value,
        });
      }
      seen.set(d.prop, d);
    }
    i = close + 1;
  }
  return hits;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git|dist/.test(e.name)) walk(p, out); }
    else if (/\.(jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const args = process.argv.slice(2);
if (args[0] === '--selftest') {
  const tmp = path.join(process.env.TEMP || '/tmp', 'qa-r102-dupe-selftest');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  // POSITIVES
  fs.writeFileSync(path.join(tmp, 'PosA.jsx'),
    `export const A = () => <button onClick={() => go(1)} className="x" onClick={() => go(2)}>Hi</button>;\n`);
  fs.writeFileSync(path.join(tmp, 'PosB.jsx'),
    `export const B = () => <div style={{ color: 'red', padding: 4, color: 'blue' }} />;\n`);
  const posCss = path.join(tmp, 'pos.css');
  fs.writeFileSync(posCss, `.a { color: red; padding: 2px; color: blue; }\n.b { margin: 0; }\n`);
  // NEGATIVE CONTROLS
  fs.writeFileSync(path.join(tmp, 'NegA.jsx'),
    `export const C = () => <div><button onClick={a}>1</button><button onClick={b}>2</button></div>;\n`); // sibling tags, not dup
  fs.writeFileSync(path.join(tmp, 'NegB.jsx'),
    `export const D = () => <div style={{ color: 'a' }} onMouseEnter={() => { const s = { color: 'b' }; use(s); }} />;\n`); // nested obj
  fs.writeFileSync(path.join(tmp, 'NegC.jsx'),
    `export const E = () => <div title="don't break: onClick= onClick=">{"style: color: a, color: b"}</div>;\n`); // apostrophe + string traps
  fs.writeFileSync(path.join(tmp, 'NegD.jsx'),
    `export const F = ({ x }) => <input onChange={(e) => set(e)} value={x > 0 ? 'a' : 'b'} />;\n`); // arrow-fn '>' trap
  const jh = walk(tmp).flatMap(scanJsxFile);
  const ch = scanCss(posCss);
  const pA = jh.filter(h => h.file.includes('PosA') && h.check === 'A-dup-jsx-attr').length;
  const pB = jh.filter(h => h.file.includes('PosB') && h.check === 'B-dup-style-key').length;
  const pC = ch.filter(h => h.prop === 'color').length;
  const negs = jh.filter(h => /Neg[A-D]/.test(h.file));
  console.log('SELFTEST');
  console.log('  A positive (duplicate onClick):        ', pA >= 1 ? 'PASS' : 'FAIL');
  console.log('  B positive (duplicate style key):      ', pB >= 1 ? 'PASS' : 'FAIL');
  console.log('  C positive (duplicate css prop):       ', pC >= 1 ? 'PASS' : 'FAIL');
  console.log('  4 negative controls silent:            ', negs.length === 0 ? 'PASS' : 'FAIL ' + JSON.stringify(negs));
  const ok = pA && pB && pC && negs.length === 0;
  console.log(ok ? 'SELFTEST 4/4 PASS' : 'SELFTEST FAILED');
  process.exit(ok ? 0 : 1);
}

const jsxHits = walk(args[0]).flatMap(scanJsxFile);
const cssHits = args[1] ? scanCss(args[1]) : [];
const all = [...jsxHits, ...cssHits];
console.log(JSON.stringify({
  total: all.length,
  A: all.filter(h => h.check === 'A-dup-jsx-attr').length,
  B: all.filter(h => h.check === 'B-dup-style-key').length,
  C: all.filter(h => h.check === 'C-dup-css-prop').length,
  hits: all,
}, null, 2));
