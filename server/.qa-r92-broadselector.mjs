// Run 92 (s3 ui-audit) — over-broad CSS selector detector.
//
// Finds rules whose SELECTOR is broad (bare pseudo-class, universal, attribute
// substring match, or bare element) but whose DECLARATIONS set properties that
// individual components normally own (geometry / animation / paint). Because a
// bare pseudo-class and an [attr*=] selector both have class-level specificity
// (0,1,0), such a rule beats every component class declared before it — which
// is how both of tonight's defects worked:
//   :focus-visible { border-radius }       -> reshaped every focused control
//   [class*="dropdown"] { animation }      -> animated every BEM child
//
// Usage:
//   node .qa-r92-broadselector.mjs <path-to-css>
//   node .qa-r92-broadselector.mjs --selftest      (runs against the pre-fix CSS)
//
// READ ONLY. Touches no database and no application file.
import fs from 'fs';
import { execSync } from 'child_process';

// Properties a component owns. A broad rule setting one of these overrides
// per-component design decisions.
const OWNED = [
  'border-radius', 'animation', 'animation-name', 'transform', 'transform-origin',
  'padding', 'margin', 'height', 'width', 'background', 'background-color',
  'font-size', 'font-weight', 'border', 'border-width', 'box-shadow', 'display',
];

// Deliberate global resets — a broad selector here is the correct idiom.
const ALLOWED_RESET = new Set(['box-sizing', 'margin', 'padding', 'border', 'font-family']);

function stripComments(css) {
  // Blank out comments but keep newlines so line numbers stay exact.
  return css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
}

function parseRules(css) {
  const clean = stripComments(css);
  if (clean.length !== css.length) throw new Error('comment stripper changed length');
  const rules = [];
  let i = 0, depth = 0, selStart = 0;
  const atStack = [];
  while (i < clean.length) {
    const ch = clean[i];
    if (ch === '{') {
      const head = clean.slice(selStart, i).trim();
      if (depth === 0) {
        if (head.startsWith('@')) {
          atStack.push(head.split(/\s/)[0]);
          depth++;
          selStart = i + 1;
          i++;
          continue;
        }
        // find matching close brace
        let d = 1, j = i + 1;
        while (j < clean.length && d > 0) {
          if (clean[j] === '{') d++;
          else if (clean[j] === '}') d--;
          j++;
        }
        rules.push({
          selector: head,
          body: clean.slice(i + 1, j - 1),
          line: clean.slice(0, selStart).split('\n').length,
          inAt: atStack[atStack.length - 1] || null,
        });
        i = j; selStart = i; continue;
      }
      // nested (inside @media etc.)
      let d = 1, j = i + 1;
      while (j < clean.length && d > 0) {
        if (clean[j] === '{') d++;
        else if (clean[j] === '}') d--;
        j++;
      }
      rules.push({
        selector: head,
        body: clean.slice(i + 1, j - 1),
        line: clean.slice(0, selStart).split('\n').length,
        inAt: atStack[atStack.length - 1] || null,
      });
      i = j; selStart = i; continue;
    }
    if (ch === '}') { depth = Math.max(0, depth - 1); atStack.pop(); selStart = i + 1; }
    i++;
  }
  return rules;
}

// Is one comma-separated compound selector "broad"?
function breadthOf(sel) {
  const s = sel.trim();
  if (!s) return null;
  if (s === '*' || /^\*(::?[\w-]+)?$/.test(s)) return 'universal';
  // bare pseudo-class: starts with ':' (not a descendant of anything)
  if (/^::?[\w-]+(\([^)]*\))?$/.test(s)) return 'bare-pseudo';
  // attribute substring / prefix / suffix match with no element or class anchor
  if (/^\[[\w-]+[*^$]=/.test(s)) return 'attr-substring';
  // bare element selector, optionally with a pseudo-class
  if (/^[a-z][a-z0-9]*(::?[\w-]+(\([^)]*\))?)?$/i.test(s)) return 'bare-element';
  return null;
}

function declaredProps(body) {
  const props = [];
  // split on ';' at depth 0 so var(--x, a;b) style values do not confuse us
  for (const chunk of body.split(';')) {
    const m = chunk.match(/^\s*([-\w]+)\s*:/);
    if (m) props.push(m[1].toLowerCase());
  }
  return props;
}

function analyze(cssPath) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const rules = parseRules(css);
  const findings = [];
  for (const r of rules) {
    if (r.inAt === '@keyframes' || (r.inAt || '').startsWith('@keyframes')) continue;
    const parts = r.selector.split(',').map(s => s.trim()).filter(Boolean);
    const props = declaredProps(r.body);
    const owned = props.filter(p => OWNED.includes(p));
    if (!owned.length) continue;
    // a rule is only interesting if it is broad and sets something beyond a reset
    const nonReset = owned.filter(p => !ALLOWED_RESET.has(p));
    if (!nonReset.length) continue;
    for (const p of parts) {
      const b = breadthOf(p);
      if (!b) continue;
      findings.push({ line: r.line, selector: p, breadth: b, sets: [...new Set(nonReset)] });
      break; // one finding per rule is enough
    }
  }
  return { ruleCount: rules.length, findings };
}

const arg = process.argv[2];

if (arg === '--selftest') {
  // The two defects fixed tonight are the known positives. Point the harness at
  // the CSS as it existed before the first fix; it MUST rediscover both.
  const pre = 'C:/tmp/qa-r92-selftest.css';
  execSync(`git show 682e4cc~1:client/src/index.css > ${pre}`, {
    cwd: 'C:/Projects/stormleads', shell: 'C:/Program Files/Git/bin/bash.exe',
  });
  const { ruleCount, findings } = analyze(pre);
  const gotFocus = findings.some(f => f.selector === ':focus-visible' && f.sets.includes('border-radius'));
  const gotDropdown = findings.some(f => f.breadth === 'attr-substring' && f.sets.some(s => s.startsWith('animation')));
  console.log(`SELFTEST over pre-fix CSS (${ruleCount} rules)`);
  console.log(`  known positive 1  :focus-visible{border-radius} -> ${gotFocus ? 'CAUGHT' : 'MISSED'}`);
  console.log(`  known positive 2  [class*=dropdown]{animation}  -> ${gotDropdown ? 'CAUGHT' : 'MISSED'}`);
  console.log(`  total broad-selector findings: ${findings.length}`);
  for (const f of findings) console.log(`   :${f.line}  ${f.breadth.padEnd(15)} ${f.selector}  sets [${f.sets.join(', ')}]`);
  if (!gotFocus || !gotDropdown) { console.log('\nSELFTEST FAILED — a zero from this harness would be worthless.'); process.exit(1); }
  console.log('\nSELFTEST PASSED — the harness rediscovers both proven defects.');
} else {
  const path = arg || 'C:/Projects/stormleads/client/src/index.css';
  const { ruleCount, findings } = analyze(path);
  console.log(`${path}  (${ruleCount} rules)`);
  console.log(`broad-selector findings: ${findings.length}`);
  for (const f of findings) console.log(`  :${f.line}  ${f.breadth.padEnd(15)} ${f.selector}  sets [${f.sets.join(', ')}]`);
}
