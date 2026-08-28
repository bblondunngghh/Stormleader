// QA Run 101 — DISABLED BUTTONS THAT DO NOT LOOK DISABLED
//
// index.css:4465 dims every disabled control:
//     button:disabled, input:disabled, ... { opacity: .5; cursor: not-allowed;
//                                            pointer-events: none }
// An INLINE `opacity` beats that rule regardless of specificity. So a control
// that is `disabled={X}` and also carries an inline opacity only *looks*
// disabled if that opacity goes below 1 whenever X is true.
//
//   opacity: saving ? 0.5 : 1   + disabled={saving}          -> CORRECT (hand-rolled dim)
//   opacity: 1                  + disabled={anything}        -> BUG (looks enabled)
//   opacity: saving ? .5 : 1    + disabled={saving || !name} -> BUG on the !name branch
//
// `cursor` collisions are ignored on purpose: `pointer-events: none` means a
// disabled control receives no pointer events, so its cursor can never render
// (documented Run 98 non-bug).
//
// Usage: node .qa-r101-disabled.mjs <jsxRoot> [--selftest]

import fs from 'fs';
import path from 'path';

function stripJsxComments(src) {
  let out = src.split('');
  let i = 0;
  while (i < src.length - 1) {
    if (src[i] === '/' && src[i + 1] === '*') {
      let j = src.indexOf('*/', i + 2);
      if (j === -1) j = src.length; else j += 2;
      for (let k = i; k < j; k++) if (out[k] !== '\n') out[k] = ' ';
      i = j; continue;
    }
    if (src[i] === '/' && src[i + 1] === '/') {
      const prev = src.slice(Math.max(0, i - 60), i);
      if (!/[:'"`]\s*$/.test(prev)) {
        let j = src.indexOf('\n', i);
        if (j === -1) j = src.length;
        for (let k = i; k < j; k++) out[k] = ' ';
        i = j; continue;
      }
    }
    i++;
  }
  return out.join('');
}

function tagEnd(src, from) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
  }
  return -1;
}

function braceRegion(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return null;
}

function topLevelEntries(objLiteral) {
  const inner = objLiteral.slice(1, -1);
  const parts = [];
  let depth = 0, seg = '';
  for (const ch of inner) {
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    if (ch === '}' || ch === ']' || ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(seg); seg = ''; }
    else seg += ch;
  }
  if (seg.trim()) parts.push(seg);
  const out = {};
  for (const s of parts) {
    const t = s.trim();
    if (!t || t.startsWith('...')) continue;
    const m = t.match(/^['"]?([A-Za-z-][A-Za-z0-9-]*)['"]?\s*:\s*([\s\S]*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

// pull the `disabled={...}` expression (or bare `disabled`)
function disabledExpr(tag) {
  const i = tag.search(/\bdisabled\b/);
  if (i === -1) return null;
  const after = tag.slice(i + 'disabled'.length);
  const m = after.match(/^\s*=\s*\{/);
  if (!m) {
    if (/^\s*(\/?>|\s|[a-zA-Z-]+\s*=)/.test(after)) return 'true'; // bare attribute
    return null;
  }
  const region = braceRegion(after, after.indexOf('{'));
  return region ? region.slice(1, -1).trim() : null;
}

// Does `opacityExpr` dim for every branch that makes `disExpr` truthy?
// Conservative: only clears a site when the opacity ternary's CONDITION is
// syntactically the whole disabled expression (or the disabled expression is
// exactly that condition), which is the correct hand-rolled idiom.
function classify(disExpr, opExpr) {
  const norm = s => s.replace(/\s+/g, '');
  const dis = norm(disExpr || '');
  const op = norm(opExpr || '');

  if (/^[0-9.]+$/.test(op)) {
    return parseFloat(op) < 1
      ? { verdict: 'OK', why: 'constant opacity already below 1' }
      : { verdict: 'BUG', why: 'constant opacity ' + op + ' — disabled never dims' };
  }
  const tern = op.match(/^([\s\S]*?)\?([\s\S]*?):([\s\S]*)$/);
  if (!tern) return { verdict: 'REVIEW', why: 'opacity expression not a plain ternary/constant' };
  const [, cond, aVal, bVal] = tern;
  const dimsWhenTrue = parseFloat(aVal) < 1;
  const dimsWhenFalse = parseFloat(bVal) < 1;
  if (isNaN(parseFloat(aVal)) || isNaN(parseFloat(bVal)))
    return { verdict: 'REVIEW', why: 'non-numeric ternary branches' };

  if (dimsWhenTrue && dimsWhenFalse) return { verdict: 'OK', why: 'both branches dim' };

  // the branch that dims must be exactly the disabled condition
  const dimCond = dimsWhenTrue ? cond : '!(' + cond + ')';
  if (norm(dimCond) === dis) return { verdict: 'OK', why: 'opacity condition === disabled condition' };
  if (dis.includes(norm(cond)) && dis !== norm(cond))
    return { verdict: 'BUG', why: 'disabled has EXTRA terms (' + disExpr + ') the opacity condition (' + cond + ') does not cover — those branches disable without dimming' };
  return { verdict: 'REVIEW', why: 'disabled=(' + disExpr + ') vs opacity cond=(' + cond + ')' };
}

function scan(file, src) {
  const code = stripJsxComments(src);
  const out = [];
  const re = /<([a-z][a-z0-9]*)\b/g;
  let m;
  while ((m = re.exec(code))) {
    const end = tagEnd(code, m.index + m[0].length);
    if (end === -1) continue;
    const tag = code.slice(m.index, end + 1);
    if (!/\bdisabled\b/.test(tag)) continue;
    const si = tag.search(/\bstyle\s*=\s*\{/);
    if (si === -1) continue;
    const outer = braceRegion(tag, tag.indexOf('{', si));
    if (!outer) continue;
    const innerStart = outer.indexOf('{', 1);
    if (innerStart === -1) continue;
    const objLit = braceRegion(outer, innerStart);
    if (!objLit) continue;
    const entries = topLevelEntries(objLit);
    if (!('opacity' in entries)) continue;

    const dis = disabledExpr(tag);
    if (!dis) continue;
    const line = code.slice(0, m.index).split('\n').length;
    const c = classify(dis, entries.opacity);
    out.push({ file, line, el: m[1], disabled: dis.slice(0, 90), opacity: entries.opacity.slice(0, 90), ...c });
  }
  return out;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|dist/.test(e.name)) walk(p, acc); }
    else if (/\.jsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const root = process.argv[2];
if (!root) { console.error('usage: node .qa-r101-disabled.mjs <jsxRoot>'); process.exit(2); }

const all = [];
for (const f of walk(root)) {
  all.push(...scan(path.relative(root, f).replace(/\\/g, '/'), fs.readFileSync(f, 'utf8')));
}
const g = v => all.filter(x => x.verdict === v);
console.log('scanned sites with disabled + inline opacity: ' + all.length);
for (const v of ['BUG', 'REVIEW', 'OK']) {
  console.log('\n===== ' + v + ' (' + g(v).length + ') =====');
  for (const x of g(v)) {
    console.log(`${x.file}:${x.line} <${x.el}>`);
    console.log(`    disabled = ${x.disabled}`);
    console.log(`    opacity  = ${x.opacity}`);
    console.log(`    -> ${x.why}`);
  }
}
