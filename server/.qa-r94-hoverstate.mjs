// Run 94 (s3 ui-audit) — :hover / :active declaration auditor.
//
// Every audit through Run 92 measured the DEFAULT state; Run 92 measured
// :focus-visible. :hover and :active were never measured. This extracts every
// :hover / :active rule and classifies its declarations:
//
//   LAYOUT  - changes geometry, so hovering REFLOWS the page (padding, border-width,
//             width, height, margin, font-size, letter-spacing, display, position).
//             `transform` is deliberately NOT layout: it does not reflow siblings.
//   STACK   - creates a stacking context on a glass parent (transform, filter,
//             opacity<1, will-change, perspective). See feedback_no_animation_on_glass_parents.
//   PAINT   - colour/shadow only; safe.
//
// Also reports the SELECTOR SPECIFICITY class, because Run 92's two defects were
// both broad selectors (0,1,0) declared late and beating component rules.
//
// Usage:
//   node .qa-r94-hoverstate.mjs <path-to-css>
//   node .qa-r94-hoverstate.mjs <path-to-css> --selftest
//
// READ ONLY. Touches no database and no application file.
import fs from 'fs';

// Properties whose change reflows layout when a pointer enters an element.
const LAYOUT = new Set([
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border', 'border-width', 'border-top-width', 'border-right-width',
  'border-bottom-width', 'border-left-width',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'font-size', 'font-weight', 'letter-spacing', 'line-height',
  'display', 'position', 'gap', 'flex', 'flex-basis',
]);

// Properties that create a stacking context (breaks backdrop-filter on .glass children).
const STACK = new Set(['transform', 'filter', 'will-change', 'perspective', 'backdrop-filter']);

function stripComments(css) {
  // Blank comments but keep newlines so reported line numbers stay exact.
  return css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
}

// Walk top-level rules, tracking brace depth so nested at-rules do not confuse us.
function parseRules(css) {
  const clean = stripComments(css);
  if (clean.length !== css.length) throw new Error('comment stripper changed length');
  const rules = [];
  let depth = 0, selStart = 0, bodyStart = -1;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '{') {
      if (depth === 0) { bodyStart = i; }
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && bodyStart > -1) {
        const sel = clean.slice(selStart, bodyStart).trim();
        const body = clean.slice(bodyStart + 1, i);
        // An at-rule body holds more rules; recurse into it rather than treating
        // the whole block as one declaration list.
        if (sel.startsWith('@')) {
          for (const r of parseRules(body)) {
            rules.push({ ...r, line: r.line + clean.slice(0, bodyStart + 1).split('\n').length - 1, inAt: sel.split(/\s|\(/)[0] });
          }
        } else if (sel) {
          rules.push({ sel, body, line: clean.slice(0, bodyStart).split('\n').length, inAt: null });
        }
        selStart = i + 1;
        bodyStart = -1;
      }
    }
  }
  return rules;
}

// Declarations at depth 0 of a rule body: "prop: value".
function declsOf(body) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '(' || c === '{') depth++;
    else if (c === ')' || c === '}') depth--;
    else if (c === ';' && depth === 0) { out.push(body.slice(start, i)); start = i + 1; }
  }
  out.push(body.slice(start));
  return out
    .map(d => d.trim())
    .filter(Boolean)
    .map(d => {
      const i = d.indexOf(':');
      if (i < 0) return null;
      return { prop: d.slice(0, i).trim().toLowerCase(), val: d.slice(i + 1).trim() };
    })
    .filter(Boolean);
}

// CSS specificity (a,b,c). :not()/:is() contribute their most specific argument.
function specificity(sel) {
  let a = 0, b = 0, c = 0;
  let s = sel;
  // Resolve functional pseudo-classes first, folding in the arg's specificity.
  const fn = /:(?:not|is|has)\(([^()]*)\)/;
  let guard = 0;
  while (fn.test(s) && guard++ < 20) {
    const m = s.match(fn);
    const inner = m[1].split(',').map(x => specificity(x.trim()));
    const worst = inner.sort((x, y) => (y[0] - x[0]) || (y[1] - x[1]) || (y[2] - x[2]))[0] || [0, 0, 0];
    a += worst[0]; b += worst[1]; c += worst[2];
    s = s.replace(fn, ' ');
  }
  s = s.replace(/::[a-z-]+/g, m => { c++; return ' '; });          // pseudo-element -> c
  s = s.replace(/:where\([^()]*\)/g, ' ');                          // :where() = 0
  a += (s.match(/#[\w-]+/g) || []).length;
  b += (s.match(/\.[\w-]+/g) || []).length;
  b += (s.match(/\[[^\]]+\]/g) || []).length;
  b += (s.match(/:[a-z-]+(?![\w-]*\()/g) || []).length;             // remaining pseudo-classes
  s = s.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[a-z-]+/g, ' ');
  c += (s.match(/\b[a-z][\w-]*\b/gi) || []).length;
  return [a, b, c];
}

function run(cssPath, selftest) {
  let css = fs.readFileSync(cssPath, 'utf8');
  if (selftest) {
    // Plant two known positives: a hover that reflows, and a hover that puts a
    // stacking context on a glass parent. A diff that cannot rediscover a
    // defect you have already proven is not evidence of anything.
    css += '\n.qa-selftest-a:hover { padding: 12px; border-width: 3px; }\n';
    css += '\n.qa-selftest-b:hover { transform: scale(1.02); }\n';
  }
  const rules = parseRules(css).filter(r => /:hover|:active/.test(r.sel));
  const findings = [];
  for (const r of rules) {
    const decls = declsOf(r.body);
    const layout = decls.filter(d => LAYOUT.has(d.prop));
    const stack = decls.filter(d => STACK.has(d.prop));
    if (!layout.length && !stack.length) continue;
    const sp = specificity(r.sel.split(',')[0].trim());
    findings.push({
      line: r.line,
      sel: r.sel.replace(/\s+/g, ' ').slice(0, 90),
      spec: sp.join(','),
      layout: layout.map(d => `${d.prop}:${d.val}`),
      stack: stack.map(d => `${d.prop}:${d.val}`),
    });
  }
  console.log(`${cssPath}  (${rules.length} :hover/:active rules)`);
  console.log(`findings: ${findings.length}\n`);
  for (const f of findings) {
    console.log(`  :${f.line}  [${f.spec}]  ${f.sel}`);
    if (f.layout.length) console.log(`        LAYOUT  ${f.layout.join(' | ')}`);
    if (f.stack.length) console.log(`        STACK   ${f.stack.join(' | ')}`);
  }
  if (selftest) {
    const gotA = findings.some(f => f.sel.includes('qa-selftest-a') && f.layout.length === 2);
    const gotB = findings.some(f => f.sel.includes('qa-selftest-b') && f.stack.length === 1);
    console.log(`\nSELFTEST layout-positive: ${gotA ? 'PASS' : 'FAIL'}`);
    console.log(`SELFTEST stack-positive:  ${gotB ? 'PASS' : 'FAIL'}`);
    if (!gotA || !gotB) process.exit(1);
  }
}

const args = process.argv.slice(2);
run(args[0], args.includes('--selftest'));
