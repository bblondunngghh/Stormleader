// QA Run 101 — INLINE STYLE vs :hover/:focus/:active  (the Run 99 §4 named gap)
//
// Premise: an inline `style={{...}}` beats ANY stylesheet rule regardless of
// specificity. So if an element carries className="X" and an inline style that
// declares property P, and index.css has a state rule (`.X:hover { P: ... }`)
// that also declares P, the state is DEAD — it can never render.
//
// Static analysis alone passes this: the class IS applied and the CSS IS
// defined. Only the property-level overlap reveals it.
//
// Usage:  node .qa-r101-inlinehover.mjs <jsxRoot> <cssFile>
//         node .qa-r101-inlinehover.mjs --selftest
//
// Parser traps deliberately avoided (all documented, all cost prior runs turns):
//  - NEVER track quotes in JSX  -> an apostrophe in JSX text ("you're") opens a
//    phantom string and blanks the rest of the file. Strip COMMENTS ONLY.
//  - A tag scan must track BRACE DEPTH; `>` inside `onClick={() => x}` is not
//    the end of the tag.
//  - Authored with the Write tool, never a heredoc (heredocs eat \w / \n inside
//    string literals and silently corrupt the regexes).

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------- shorthands
// Inline `background:'none'` kills a hover `background-color`. Normalize both
// sides to a coarse family token so overlaps like that are caught.
const FAMILY = [
  ['background', /^background(-|$)/],
  ['border-color', /^border(-(top|right|bottom|left))?-color$/],
  ['border-width', /^border(-(top|right|bottom|left))?-width$/],
  ['border-style', /^border(-(top|right|bottom|left))?-style$/],
  ['border-radius', /^border-.*radius$|^border-radius$/],
  ['border', /^border(-(top|right|bottom|left))?$/],
  ['outline', /^outline(-|$)/],
  ['box-shadow', /^box-shadow$/],
  ['color', /^color$/],
  ['opacity', /^opacity$/],
  ['transform', /^transform(-|$)/],
  ['transition', /^transition(-|$)/],
  ['filter', /^(backdrop-)?filter$/],
  ['padding', /^padding(-|$)/],
  ['margin', /^margin(-|$)/],
  ['font-size', /^font-size$/],
  ['font-weight', /^font-weight$/],
  ['width', /^(min-|max-)?width$/],
  ['height', /^(min-|max-)?height$/],
  ['cursor', /^cursor$/],
  ['visibility', /^visibility$/],
  ['display', /^display$/],
  ['text-decoration', /^text-decoration(-|$)/],
  ['letter-spacing', /^letter-spacing$/],
  ['gap', /^(row-|column-)?gap$/],
];

function fam(prop) {
  const p = prop.trim().toLowerCase();
  for (const [name, re] of FAMILY) if (re.test(p)) return name;
  return p;
}

const camelToKebab = s => s.replace(/([A-Z])/g, m => '-' + m.toLowerCase());

// ------------------------------------------------------------------- css side
function stripCssComments(css) {
  // keep length stable so nothing shifts; blank out /* ... */
  return css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
}

// Returns Map<className, Map<familyToken, [{selector, pseudo, line}]>>
function parseStateRules(cssPath) {
  const raw = fs.readFileSync(cssPath, 'utf8');
  const css = stripCssComments(raw);
  const byClass = new Map();
  const STATE = /:(hover|active|focus|focus-visible|focus-within|disabled|checked)\b/;

  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;

    // selector = text back to the previous } or { or ;
    let start = Math.max(
      css.lastIndexOf('}', open),
      css.lastIndexOf('{', open - 1),
      css.lastIndexOf(';', open)
    );
    const selector = css.slice(start + 1, open).trim();

    // find matching close brace
    let depth = 1, j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);

    // at-rules (@media/@supports) contain nested rules -> descend, don't treat
    // the body as declarations
    if (selector.startsWith('@')) { i = open + 1; continue; }

    if (STATE.test(selector)) {
      const line = css.slice(0, open).split('\n').length;
      // top-level declarations only
      const decls = [];
      let d = 0, cur = '';
      for (const ch of body) {
        if (ch === '{') d++;
        if (ch === '}') d--;
        if (ch === ';' && d === 0) { decls.push(cur); cur = ''; }
        else cur += ch;
      }
      if (cur.trim()) decls.push(cur);
      const props = decls
        .map(x => x.split(':')[0].trim())
        .filter(x => x && !x.startsWith('--') && /^[a-z-]+$/.test(x));

      for (const sel of selector.split(',')) {
        const s = sel.trim();
        if (!s || !STATE.test(s)) continue;
        const m = s.match(STATE);
        const pseudo = m[1];
        // subject = rightmost compound selector (the element being styled)
        const compounds = s.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
        const subject = compounds[compounds.length - 1];

        // Extra constraints the ELEMENT must satisfy for this rule to match it.
        // Without these, `.glass[class*="card"]:not(.stat-card):hover` is
        // wrongly attributed to every `.glass` element in the app.
        //   `.glass[class*="card"]` matches only 2 class combos, per Run 94.
        const requireSubstr = [...subject.matchAll(/\[class\*=["']([^"']+)["']\]/g)].map(x => x[1]);
        const forbidClass = [...subject.matchAll(/:not\(\.([A-Za-z0-9_-]+)\)/g)].map(x => x[1]);
        // strip :not(...) so its classes are not read as required classes
        const subjectBase = subject.replace(/:not\([^)]*\)/g, '');
        const classes = (subjectBase.match(/\.[A-Za-z0-9_-]+/g) || []).map(c => c.slice(1));

        // A state rule can also hang off a bare ELEMENT selector -- `button:disabled`
        // is the important one (index.css:4439 dims every disabled button). Those
        // never appear in a className diff, so key them as `tag:button`.
        const tagMatch = subjectBase.match(/^([a-z][a-z0-9]*)(?=[:.\[]|$)/);
        if (tagMatch) classes.push('tag:' + tagMatch[1]);

        for (const cls of classes) {
          if (!byClass.has(cls)) byClass.set(cls, new Map());
          const m2 = byClass.get(cls);
          const allProps = [...new Set(props.map(fam))];
          for (const p of props) {
            const f = fam(p);
            if (!m2.has(f)) m2.set(f, []);
            m2.get(f).push({ selector: s, prop: p, pseudo, line, requireSubstr, forbidClass, allProps });
          }
        }
      }
    }
    i = open + 1;
  }
  return byClass;
}

// ------------------------------------------------------------------ jsx side
function stripJsxComments(src) {
  // COMMENTS ONLY. Never quotes. Keep length stable.
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
      // avoid mangling a URL like https://  -> require start-of-line-ish
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

// Scan forward from `<` to the tag's closing `>` at brace depth 0.
function tagEnd(src, from) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
    else if (c === '\n' && depth === 0 && src.slice(from, i).length > 4000) return -1;
  }
  return -1;
}

// Extract a brace-balanced region starting at the `{` index.
function braceRegion(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return null;
}

function topLevelKeys(objLiteral) {
  // objLiteral includes the outer braces: { a: 1, 'b-c': 2, ...spread }
  const inner = objLiteral.slice(1, -1);
  const keys = [];
  let depth = 0, seg = '';
  for (const ch of inner) {
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    if (ch === '}' || ch === ']' || ch === ')') depth--;
    if (ch === ',' && depth === 0) { keys.push(seg); seg = ''; }
    else seg += ch;
  }
  if (seg.trim()) keys.push(seg);
  const out = [];
  for (const s of keys) {
    const t = s.trim();
    if (!t || t.startsWith('...')) continue;
    const m = t.match(/^['"]?([A-Za-z-][A-Za-z0-9-]*)['"]?\s*:/);
    if (m) out.push(m[1]);
  }
  return out;
}

function scanJsx(file, src) {
  const code = stripJsxComments(src);
  const hits = [];
  const re = /<([A-Za-z][A-Za-z0-9]*)\b/g;
  let m;
  while ((m = re.exec(code))) {
    const end = tagEnd(code, m.index + m[0].length);
    if (end === -1) continue;
    const tag = code.slice(m.index, end + 1);

    const ci = tag.indexOf('className');
    const si = tag.search(/\bstyle\s*=\s*\{/);
    // an inline style is the only hard requirement -- element-selector state
    // rules (`button:disabled`) apply with no className at all
    if (si === -1) continue;

    // ---- classes: every literal string segment inside the className value
    let classSrc = '';
    if (ci !== -1) {
      const after = tag.slice(ci + 'className'.length).replace(/^\s*=\s*/, '');
      if (after[0] === '"' || after[0] === "'") {
        const q = after[0];
        classSrc = after.slice(1, after.indexOf(q, 1));
      } else if (after[0] === '{') {
        const region = braceRegion(after, 0);
        if (region) classSrc = (region.match(/(['"`])((?:(?!\1)[\s\S])*)\1/g) || [])
          .map(s => s.slice(1, -1)).join(' ');
      }
    }
    const classes = classSrc.split(/[\s${}()?:+]+/).filter(c => /^[A-Za-z][A-Za-z0-9_-]*$/.test(c));

    // ---- inline style object
    const styleOpen = tag.indexOf('{', si);
    const outer = braceRegion(tag, styleOpen);
    if (!outer) continue;
    const innerStart = outer.indexOf('{', 1);
    if (innerStart === -1) continue;
    const objLit = braceRegion(outer, innerStart);
    if (!objLit) continue;
    const props = topLevelKeys(objLit).map(camelToKebab);
    if (!props.length) continue;

    const line = code.slice(0, m.index).split('\n').length;
    // `disabled` present on the tag => a `button:disabled` collision is reachable
    const hasDisabled = /\bdisabled\s*(=|\/?>|\s)/.test(tag);
    hits.push({ file, line, el: m[1], classes, props, hasDisabled });
  }
  return hits;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|dist/.test(e.name)) walk(p, acc); }
    else if (/\.jsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

// ------------------------------------------------------------------- compare
function run(jsxRoot, cssFile) {
  const stateRules = parseStateRules(cssFile);
  const findings = [];
  let elementsScanned = 0;

  for (const f of walk(jsxRoot)) {
    const src = fs.readFileSync(f, 'utf8');
    for (const h of scanJsx(path.relative(jsxRoot, f).replace(/\\/g, '/'), src)) {
      elementsScanned++;
      const inlineFams = new Set(h.props.map(fam));
      const classSet = new Set(h.classes);
      const classAttr = h.classes.join(' ');
      const lookups = [...h.classes];
      if (/^[a-z]/.test(h.el)) lookups.push('tag:' + h.el.toLowerCase());
      for (const cls of lookups) {
        // a `button:disabled` collision only matters if the button can BE disabled
        if (cls === 'tag:button' && !h.hasDisabled) continue;
        const rules = stateRules.get(cls);
        if (!rules) continue;
        for (const [f2, occ] of rules) {
          if (!inlineFams.has(f2)) continue;
          // keep only occurrences whose selector can actually match THIS element
          const live = occ.filter(o =>
            o.requireSubstr.every(sub => classAttr.includes(sub)) &&
            o.forbidClass.every(c => !classSet.has(c))
          );
          if (!live.length) continue;

          // How much of the state rule does the inline style kill?
          // all of it => the state is 100% DEAD (the Run 98 defect shape).
          const declared = [...new Set(live.flatMap(o => o.allProps))];
          const killed = declared.filter(d => inlineFams.has(d));

          findings.push({
            file: h.file, line: h.line, el: h.el, cls,
            family: f2,
            inline: h.props.filter(p => fam(p) === f2),
            css: live.map(o => `${o.selector} { ${o.prop} } :${o.line}`).slice(0, 3),
            pseudo: [...new Set(live.map(o => o.pseudo))].join('/'),
            declared, killed,
            fullyDead: killed.length === declared.length,
          });
        }
      }
    }
  }
  return { elementsScanned, stateClasses: stateRules.size, findings };
}

// ------------------------------------------------------------------ selftest
if (process.argv[2] === '--selftest') {
  const dir = process.argv[3];
  if (!dir) { console.error('selftest needs a dir with the PRE-FIX sources'); process.exit(2); }
  const css = process.argv[4];
  const r = run(dir, css);
  const known = r.findings.filter(f => /Subcontractors/i.test(f.file) && /slide-over__close/.test(f.cls));
  const planted = r.findings.filter(f => /__selftest__/.test(f.file));
  console.log(JSON.stringify({
    elementsScanned: r.elementsScanned,
    stateClasses: r.stateClasses,
    total: r.findings.length,
    REDISCOVERED_RUN98_DEFECT: known.length > 0,
    run98: known,
    PLANTED_CAUGHT: planted.length > 0,
    planted,
  }, null, 2));
  process.exit(known.length > 0 ? 0 : 1);
}

const jsxRoot = process.argv[2];
const cssFile = process.argv[3];
if (!jsxRoot || !cssFile) { console.error('usage: node .qa-r101-inlinehover.mjs <jsxRoot> <cssFile>'); process.exit(2); }
const r = run(jsxRoot, cssFile);
console.log(JSON.stringify(r, null, 2));
