#!/usr/bin/env node
/**
 * Run 102 (s3-ui-audit) — SHORTHAND-AFTER-LONGHAND sweep.
 *
 * Defect family (6 consecutive runs): "a declaration silently loses the cascade
 * to something that outranks it."  Run 92 bare :focus-visible; Run 94
 * .glass[class*="card"]; Run 98 inline background:'none'; Run 101 inline
 * opacity:1 over button:disabled.
 *
 * THIS check is the intra-declaration twin, and it needs no cascade at all:
 *   within ONE declaration block (a CSS rule, or ONE React inline style object),
 *   a SHORTHAND that appears AFTER a LONGHAND it covers RESETS that longhand to
 *   its initial value.  The earlier value is silently and unconditionally lost.
 *
 *     { backgroundColor: 'red', background: 'blue' }   -> red is GONE
 *     { borderColor: 'x',       border: '1px solid y'} -> x is GONE
 *
 * Unlike every prior sweep in this family there is no specificity or source-order
 * subtlety: if the order holds, the longhand is dead. 100% mechanical.
 *
 * Usage:
 *   node .qa-r102-shorthand.mjs <jsx-walk-root> <css-file>
 *   node .qa-r102-shorthand.mjs --selftest <jsx-walk-root> <css-file>
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// shorthand -> the longhands it resets
// ---------------------------------------------------------------------------
const SHORTHANDS = {
  'background': ['background-color', 'background-image', 'background-position',
    'background-size', 'background-repeat', 'background-attachment',
    'background-origin', 'background-clip'],
  'border': ['border-width', 'border-style', 'border-color',
    'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-top-width', 'border-top-style', 'border-top-color',
    'border-right-width', 'border-right-style', 'border-right-color',
    'border-bottom-width', 'border-bottom-style', 'border-bottom-color',
    'border-left-width', 'border-left-style', 'border-left-color'],
  'border-top': ['border-top-width', 'border-top-style', 'border-top-color'],
  'border-right': ['border-right-width', 'border-right-style', 'border-right-color'],
  'border-bottom': ['border-bottom-width', 'border-bottom-style', 'border-bottom-color'],
  'border-left': ['border-left-width', 'border-left-style', 'border-left-color'],
  'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
  'border-style': ['border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style'],
  'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'border-radius': ['border-top-left-radius', 'border-top-right-radius',
    'border-bottom-right-radius', 'border-bottom-left-radius'],
  'font': ['font-family', 'font-size', 'font-weight', 'font-style',
    'font-variant', 'font-stretch', 'line-height'],
  'margin': ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  'padding': ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  'inset': ['top', 'right', 'bottom', 'left'],
  'flex': ['flex-grow', 'flex-shrink', 'flex-basis'],
  'flex-flow': ['flex-direction', 'flex-wrap'],
  'gap': ['row-gap', 'column-gap'],
  'grid-area': ['grid-row-start', 'grid-row-end', 'grid-column-start', 'grid-column-end'],
  'grid-row': ['grid-row-start', 'grid-row-end'],
  'grid-column': ['grid-column-start', 'grid-column-end'],
  'transition': ['transition-property', 'transition-duration',
    'transition-timing-function', 'transition-delay'],
  'animation': ['animation-name', 'animation-duration', 'animation-timing-function',
    'animation-delay', 'animation-iteration-count', 'animation-direction',
    'animation-fill-mode', 'animation-play-state'],
  'overflow': ['overflow-x', 'overflow-y'],
  'outline': ['outline-width', 'outline-style', 'outline-color'],
  'list-style': ['list-style-type', 'list-style-position', 'list-style-image'],
  'text-decoration': ['text-decoration-line', 'text-decoration-color',
    'text-decoration-style', 'text-decoration-thickness'],
  'place-items': ['align-items', 'justify-items'],
  'place-content': ['align-content', 'justify-content'],
  'place-self': ['align-self', 'justify-self'],
};

const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

// ---------------------------------------------------------------------------
// Given an ORDERED list of {prop, line, value}, report shorthand-after-longhand.
// ---------------------------------------------------------------------------
function analyzeBlock(decls, ctx) {
  const hits = [];
  for (let i = 0; i < decls.length; i++) {
    const sh = decls[i].prop;
    const covers = SHORTHANDS[sh];
    if (!covers) continue;
    for (let j = 0; j < i; j++) {
      const lh = decls[j].prop;
      if (!covers.includes(lh)) continue;
      // A later identical shorthand re-setting an earlier shorthand is normal
      // duplication, not a longhand kill; only flag true longhand loss.
      if (SHORTHANDS[lh] && SHORTHANDS[sh].includes(lh) === false) continue;
      hits.push({
        ...ctx,
        killedProp: lh,
        killedValue: decls[j].value,
        killedLine: decls[j].line,
        byShorthand: sh,
        byValue: decls[i].value,
        byLine: decls[i].line,
      });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// CSS side: walk leaf declaration blocks
// ---------------------------------------------------------------------------
function scanCss(cssPath) {
  const raw = fs.readFileSync(cssPath, 'utf8');
  // strip comments, preserving length so line numbers stay correct
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const lineAt = (idx) => src.slice(0, idx).split('\n').length;
  const hits = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open === -1) break;
    const close = src.indexOf('}', open);
    const nextOpen = src.indexOf('{', open + 1);
    // leaf block only: no nested block before the close
    if (close === -1) break;
    if (nextOpen !== -1 && nextOpen < close) { i = nextOpen; continue; }
    const selector = src.slice(src.lastIndexOf('}', open - 1) + 1, open)
      .replace(/^[\s\S]*?([^{}]*)$/, '$1').trim().replace(/\s+/g, ' ');
    const body = src.slice(open + 1, close);
    const decls = [];
    let depth = 0, cur = '', start = open + 1;
    for (let k = 0; k < body.length; k++) {
      const ch = body[k];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === ';' && depth === 0) {
        const c = cur.indexOf(':');
        if (c > 0) {
          const p = cur.slice(0, c).trim().toLowerCase();
          if (/^[a-z-]+$/.test(p) && !p.startsWith('--')) {
            decls.push({ prop: p, value: cur.slice(c + 1).trim().slice(0, 60), line: lineAt(start) });
          }
        }
        cur = ''; start = open + 1 + k + 1;
      } else cur += ch;
    }
    const c = cur.indexOf(':');
    if (c > 0) {
      const p = cur.slice(0, c).trim().toLowerCase();
      if (/^[a-z-]+$/.test(p) && !p.startsWith('--')) {
        decls.push({ prop: p, value: cur.slice(c + 1).trim().slice(0, 60), line: lineAt(start) });
      }
    }
    hits.push(...analyzeBlock(decls, { file: path.basename(cssPath), selector: selector.slice(0, 80) }));
    i = close + 1;
  }
  return hits;
}

// ---------------------------------------------------------------------------
// JSX side: find style={{ ... }} objects, extract TOP-LEVEL keys in order.
// Per the Run 86 traps: strip comments only (never track quotes across JSX
// text), and brace-scan rather than regex-match the object.
// ---------------------------------------------------------------------------
function scanJsxFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
                 .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/./g, ' '));
  const lineAt = (idx) => src.slice(0, idx).split('\n').length;
  const hits = [];
  const re = /style\s*=\s*\{\{/g;
  let m;
  while ((m = re.exec(src))) {
    const objStart = m.index + m[0].length - 1; // at the inner '{'
    // brace-scan the inner object, tracking strings/templates
    let depth = 0, k = objStart, q = null, end = -1;
    for (; k < src.length; k++) {
      const ch = src[k];
      if (q) {
        if (ch === '\\') { k++; continue; }
        if (ch === q) q = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
      if (ch === '{' || ch === '(' || ch === '[') depth++;
      else if (ch === '}' || ch === ')' || ch === ']') { depth--; if (depth === 0) { end = k; break; } }
    }
    if (end === -1) continue;
    const body = src.slice(objStart + 1, end);
    // split top-level commas
    const decls = [];
    let d = 0, cur = '', curStart = objStart + 1;
    q = null;
    for (let k = 0; k < body.length; k++) {
      const ch = body[k];
      if (q) { cur += ch; if (ch === '\\') { cur += body[++k] || ''; continue; } if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { q = ch; cur += ch; continue; }
      if (ch === '{' || ch === '(' || ch === '[') d++;
      else if (ch === '}' || ch === ')' || ch === ']') d--;
      if (ch === ',' && d === 0) {
        pushDecl(decls, cur, curStart);
        cur = ''; curStart = objStart + 1 + k + 1;
      } else cur += ch;
    }
    pushDecl(decls, cur, curStart);

    function pushDecl(arr, text, startIdx) {
      const t = text.trim();
      if (!t) return;
      // key must be at depth 0 before the first ':' -- and NOT a spread
      if (t.startsWith('...')) return;
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
      let key = t.slice(0, ci).trim().replace(/^['"`]|['"`]$/g, '');
      if (!/^[A-Za-z-][A-Za-z0-9-]*$/.test(key)) return; // computed keys skipped
      arr.push({
        prop: kebab(key).toLowerCase(),
        value: t.slice(ci + 1).trim().replace(/\s+/g, ' ').slice(0, 70),
        line: lineAt(startIdx),
      });
    }

    hits.push(...analyzeBlock(decls, {
      file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
      selector: 'inline style={{…}} @' + lineAt(m.index),
    }));
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

// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const selftest = args[0] === '--selftest';
const jsxRoot = args[selftest ? 1 : 0];
const cssFile = args[selftest ? 2 : 1];

if (selftest) {
  const tmp = path.join(process.env.TEMP || '/tmp', 'qa-r102-selftest');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  // POSITIVES
  fs.writeFileSync(path.join(tmp, 'Pos1.jsx'),
    `export const A = () => <div style={{ backgroundColor: 'red', padding: 4, background: 'blue' }} />;\n`);
  fs.writeFileSync(path.join(tmp, 'Pos2.jsx'),
    `export const B = () => <div style={{ borderColor: 'x', border: '1px solid y' }} />;\n`);
  const posCss = path.join(tmp, 'pos.css');
  fs.writeFileSync(posCss, `.z { border-radius: 12px; color: red; border-radius: 4px; }\n.y { margin-top: 8px; margin: 0; }\n`);
  // NEGATIVE CONTROLS
  fs.writeFileSync(path.join(tmp, 'Neg1.jsx'),
    `export const C = () => <div style={{ background: 'blue', backgroundColor: 'red' }} />;\n`); // correct order
  fs.writeFileSync(path.join(tmp, 'Neg2.jsx'),
    `export const D = () => <div style={{ color: 'a', fontSize: 12, opacity: 1 }} />;\n`); // unrelated
  fs.writeFileSync(path.join(tmp, 'Neg3.jsx'),
    `export const E = () => <div style={{ borderRadius: 4 }}>{"don't eat this: background: x"}</div>;\n`); // apostrophe trap
  const jh = walk(tmp).flatMap(scanJsxFile);
  const ch = scanCss(posCss);
  const pos1 = jh.filter(h => h.file.includes('Pos1')).length;
  const pos2 = jh.filter(h => h.file.includes('Pos2')).length;
  const negs = jh.filter(h => /Neg[123]/.test(h.file)).length;
  const cssMargin = ch.filter(h => h.killedProp === 'margin-top').length;
  console.log('SELFTEST');
  console.log('  jsx positive #1 (backgroundColor then background):', pos1 >= 1 ? 'PASS' : 'FAIL');
  console.log('  jsx positive #2 (borderColor then border):        ', pos2 >= 1 ? 'PASS' : 'FAIL');
  console.log('  css positive   (margin-top then margin):          ', cssMargin >= 1 ? 'PASS' : 'FAIL');
  console.log('  negative controls silent (3 files):               ', negs === 0 ? 'PASS' : 'FAIL ' + JSON.stringify(jh.filter(h => /Neg/.test(h.file))));
  const ok = pos1 && pos2 && cssMargin && negs === 0;
  console.log(ok ? 'SELFTEST 4/4 PASS' : 'SELFTEST FAILED');
  process.exit(ok ? 0 : 1);
}

const jsxHits = walk(jsxRoot).flatMap(scanJsxFile);
const cssHits = cssFile ? scanCss(cssFile) : [];
const all = [...cssHits, ...jsxHits];
console.log(JSON.stringify({ total: all.length, css: cssHits.length, jsx: jsxHits.length, hits: all }, null, 2));
