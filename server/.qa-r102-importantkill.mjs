#!/usr/bin/env node
/**
 * Run 102 (s3-ui-audit) — !important-IN-BASE-RULE KILLS A STATE RULE.
 *
 * Seventh run of the same defect family ("a declaration silently loses the
 * cascade to something that outranks it"), and the one mechanism in the family
 * that NO prior sweep could see:
 *
 *   Run 92 : a bare pseudo-class / [class*=] outranked a component rule
 *   Run 94 : .glass[class*="card"]:hover outranked .stat-card:hover
 *   Run 98 : an INLINE style outranked .slide-over__close:hover
 *   Run 101: an INLINE style outranked button:disabled
 *   >>> HERE: an !important in the BASE rule outranks the element's own
 *       :hover/:focus/:active/.is-active rule.
 *
 * !important inverts the normal cascade: it beats higher specificity, later
 * source order AND inline styles. So
 *     .x        { background: A !important }
 *     .x:hover  { background: B }            <- 100% DEAD, cannot ever apply
 *
 * Every previous sweep in this family keyed on specificity or source order, so
 * all of them score this pair as "the :hover wins" and pass it.
 *
 * Usage:
 *   node .qa-r102-importantkill.mjs <css-file>
 *   node .qa-r102-importantkill.mjs --selftest
 */

import fs from 'fs';
import path from 'path';

// A shorthand carrying !important makes ALL of its longhands important too.
const EXPANDS = {
  'background': ['background-color', 'background-image', 'background-position',
    'background-size', 'background-repeat', 'background-attachment'],
  'border': ['border-width', 'border-style', 'border-color',
    'border-top-width', 'border-top-style', 'border-top-color',
    'border-right-width', 'border-right-style', 'border-right-color',
    'border-bottom-width', 'border-bottom-style', 'border-bottom-color',
    'border-left-width', 'border-left-style', 'border-left-color',
    'border-top', 'border-right', 'border-bottom', 'border-left'],
  'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
  'border-radius': ['border-top-left-radius', 'border-top-right-radius',
    'border-bottom-right-radius', 'border-bottom-left-radius'],
  'margin': ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  'padding': ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  'font': ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height'],
  'flex': ['flex-grow', 'flex-shrink', 'flex-basis'],
  'transition': ['transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay'],
  'animation': ['animation-name', 'animation-duration', 'animation-timing-function',
    'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-fill-mode'],
  'overflow': ['overflow-x', 'overflow-y'],
  'outline': ['outline-width', 'outline-style', 'outline-color'],
  'gap': ['row-gap', 'column-gap'],
  'inset': ['top', 'right', 'bottom', 'left'],
};
const covers = (p) => new Set([p, ...(EXPANDS[p] || [])]);

// state/modifier suffixes that make a selector a "state variant" of a base
const STATE_RE = /(:hover|:focus|:focus-visible|:focus-within|:active|:disabled|:checked|:not\([^)]*\)|\.is-active|\.is-open|\.active|\.selected|\[aria-[^\]]*\]|\[data-[^\]]*\])/g;

function parseRules(cssPath) {
  const raw = fs.readFileSync(cssPath, 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const lineAt = (idx) => src.slice(0, idx).split('\n').length;
  const rules = [];
  let i = 0, order = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open === -1) break;
    const close = src.indexOf('}', open);
    const nextOpen = src.indexOf('{', open + 1);
    if (close === -1) break;
    if (nextOpen !== -1 && nextOpen < close) { i = nextOpen; continue; }
    const selRaw = src.slice(src.lastIndexOf('}', open - 1) + 1, open).trim().replace(/\s+/g, ' ');
    if (selRaw.startsWith('@') || !selRaw) { i = close + 1; continue; }
    const body = src.slice(open + 1, close);
    const decls = [];
    let depth = 0, cur = '', start = open + 1;
    const flush = (k) => {
      const c = cur.indexOf(':');
      if (c > 0) {
        const p = cur.slice(0, c).trim().toLowerCase();
        const v = cur.slice(c + 1).trim();
        if (/^[a-z-]+$/.test(p) && !p.startsWith('--')) {
          decls.push({ prop: p, value: v.replace(/\s*!important\s*$/i, '').slice(0, 60),
            important: /!important\s*$/i.test(v), line: lineAt(start) });
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
    // one entry per comma-separated selector in the group
    for (const sel of selRaw.split(',').map((s) => s.trim()).filter(Boolean)) {
      rules.push({ sel, decls, line: lineAt(open), order: order++ });
    }
    i = close + 1;
  }
  return rules;
}

function analyze(rules) {
  const hits = [];
  // index base rules that carry any !important
  const impBase = rules.filter((r) => r.decls.some((d) => d.important));
  for (const state of rules) {
    STATE_RE.lastIndex = 0;
    if (!STATE_RE.test(state.sel)) continue;
    const base = state.sel.replace(STATE_RE, '').trim();
    if (!base) continue;
    for (const b of impBase) {
      if (b.sel !== base) continue;
      for (const sd of state.decls) {
        if (sd.important) continue; // state rule also important -> it wins
        for (const bd of b.decls) {
          if (!bd.important) continue;
          if (!covers(bd.prop).has(sd.prop)) continue;
          hits.push({
            baseSel: b.sel, baseLine: bd.line, baseDecl: `${bd.prop}: ${bd.value} !important`,
            stateSel: state.sel, stateLine: sd.line, deadDecl: `${sd.prop}: ${sd.value}`,
          });
        }
      }
    }
  }
  return hits;
}

const args = process.argv.slice(2);
if (args[0] === '--selftest') {
  const tmp = path.join(process.env.TEMP || '/tmp', 'qa-r102-imp-selftest');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const f = path.join(tmp, 't.css');
  fs.writeFileSync(f, [
    // POSITIVE 1 - exact property match
    '.p1 { background: red !important; }',
    '.p1:hover { background: blue; }',
    // POSITIVE 2 - shorthand !important kills a longhand in the state rule
    '.p2 { border: 1px solid red !important; }',
    '.p2:hover { border-color: blue; }',
    // NEGATIVE 1 - state rule is ALSO important -> it wins, not dead
    '.n1 { color: red !important; }',
    '.n1:hover { color: blue !important; }',
    // NEGATIVE 2 - base has no !important -> ordinary cascade, state wins
    '.n2 { color: red; }',
    '.n2:hover { color: blue; }',
    // NEGATIVE 3 - unrelated property
    '.n3 { background: red !important; }',
    '.n3:hover { transform: scale(2); }',
    // NEGATIVE 4 - different base selector entirely
    '.n4a { background: red !important; }',
    '.n4b:hover { background: blue; }',
  ].join('\n'));
  const hits = analyze(parseRules(f));
  const p1 = hits.filter((h) => h.baseSel === '.p1').length;
  const p2 = hits.filter((h) => h.baseSel === '.p2').length;
  const negs = hits.filter((h) => /^\.n/.test(h.baseSel));
  console.log('SELFTEST');
  console.log('  positive 1 (exact prop, background):        ', p1 === 1 ? 'PASS' : 'FAIL ' + p1);
  console.log('  positive 2 (shorthand kills longhand):      ', p2 === 1 ? 'PASS' : 'FAIL ' + p2);
  console.log('  4 negative controls silent:                 ', negs.length === 0 ? 'PASS' : 'FAIL ' + JSON.stringify(negs));
  const ok = p1 === 1 && p2 === 1 && negs.length === 0;
  console.log(ok ? 'SELFTEST 3/3 PASS' : 'SELFTEST FAILED');
  process.exit(ok ? 0 : 1);
}

const rules = parseRules(args[0]);
const hits = analyze(rules);
console.log(JSON.stringify({
  rulesParsed: rules.length,
  importantDecls: rules.reduce((n, r) => n + r.decls.filter((d) => d.important).length, 0),
  deadStateDecls: hits.length,
  hits,
}, null, 2));
