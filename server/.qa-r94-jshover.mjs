// Run 94 (s3 ui-audit) — JS hover-handler symmetry check.
//
// This codebase hand-rolls inline style objects, and an inline style cannot
// express :hover. So hover is implemented imperatively in ~32 places via
// onMouseEnter / onMouseLeave mutating el.style.*. No CSS audit can see these.
//
// The defect shape is a STICKY HOVER: onMouseEnter sets N properties and
// onMouseLeave restores fewer than N (or is absent entirely), so the hovered
// look persists after the pointer leaves.
//
// This is a set difference: {props written on enter} \ {props written on leave}.
//
// Harness-correctness rules obeyed (each cost a prior run real turns):
//   - Written with the Write tool, never a heredoc (Run 84/86: heredocs eat
//     backslashes inside string literals and silently corrupt regexes).
//   - Comments stripped ONLY; quotes are never tracked, because an apostrophe in
//     JSX text ("you're all clear") destroys any naive string stripper (Run 86).
//   - Tag scanning tracks BRACE DEPTH; `>` only closes a tag at depth 0, because
//     onMouseEnter={e => ...} would otherwise truncate the tag (Run 86).
//   - Self-tests against planted positives before reporting (Run 84).
//
// Usage:
//   node .qa-r94-jshover.mjs <walk-root>
//   node .qa-r94-jshover.mjs <walk-root> --selftest
//
// READ ONLY. Touches no database and no application file.
import fs from 'fs';
import path from 'path';

function stripComments(src) {
  // Blank comments, keep newlines, so offsets and line numbers stay exact.
  let out = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  out = out.replace(/^([^\n]*?)\/\/[^\n]*$/gm, (m, pre) =>
    // Only strip a // comment when it is not inside a string-ish url (http://).
    /[:"']$/.test(pre.trimEnd()) ? m : pre + ' '.repeat(m.length - pre.length));
  if (out.length !== src.length) throw new Error('comment stripper changed length');
  return out;
}

// From an index inside a JSX tag, find the tag's opening '<'.
function tagStart(code, idx) {
  for (let i = idx; i >= 0 && idx - i < 4000; i--) {
    if (code[i] === '<' && /[A-Za-z]/.test(code[i + 1] || '')) return i;
    if (code[i] === '>' && code[i - 1] !== '=') return -1;   // left the tag
  }
  return -1;
}

// From the tag's '<', scan forward; '>' closes the tag only at brace depth 0.
function tagEnd(code, start) {
  let depth = 0;
  for (let i = start; i < code.length; i++) {
    const c = code[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0 && code[i - 1] !== '=') return i;
  }
  return -1;
}

// Extract the brace-matched body of `attr={...}` within a tag.
function attrBody(tag, attr) {
  const m = tag.indexOf(attr + '=');
  if (m < 0) return null;
  let i = tag.indexOf('{', m);
  if (i < 0) return null;
  let depth = 0;
  for (let j = i; j < tag.length; j++) {
    if (tag[j] === '{') depth++;
    else if (tag[j] === '}') { depth--; if (depth === 0) return tag.slice(i + 1, j); }
  }
  return null;
}

// Style properties written by a handler body: `<anything>.style.PROP = ...`
// and `.style.setProperty('PROP', ...)`.
function propsWritten(body) {
  const props = new Set();
  for (const m of body.matchAll(/\.style\.([A-Za-z_$][\w$]*)\s*=/g)) props.add(m[1]);
  for (const m of body.matchAll(/\.style\.setProperty\(\s*['"]([^'"]+)['"]/g)) props.add(m[1]);
  // cssText replaces everything at once — treat as a wildcard restore.
  if (/\.style\.cssText\s*=/.test(body)) props.add('*cssText');
  return props;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git|dist/.test(e.name)) walk(p, acc); }
    else if (/\.jsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function analyze(files) {
  const findings = [];
  let tags = 0;
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const code = stripComments(raw);
    const seen = new Set();
    for (const m of code.matchAll(/onMouse(?:Enter|Over)\s*=/g)) {
      const s = tagStart(code, m.index);
      if (s < 0 || seen.has(s)) continue;
      seen.add(s);
      const e = tagEnd(code, s);
      if (e < 0) continue;
      const tag = code.slice(s, e + 1);
      tags++;
      const enterBody = attrBody(tag, 'onMouseEnter') || attrBody(tag, 'onMouseOver');
      const leaveBody = attrBody(tag, 'onMouseLeave') || attrBody(tag, 'onMouseOut');
      if (enterBody === null) continue;
      const enter = propsWritten(enterBody);
      if (enter.size === 0) continue;              // enter does not touch style
      const leave = leaveBody === null ? new Set() : propsWritten(leaveBody);
      if (leave.has('*cssText')) continue;         // wholesale restore
      const missing = [...enter].filter(p => !leave.has(p));
      if (missing.length) {
        findings.push({
          file: path.relative(process.cwd(), f).replace(/\\/g, '/'),
          line: code.slice(0, s).split('\n').length,
          el: tag.slice(1, 40).split(/\s/)[0],
          hasLeave: leaveBody !== null,
          setsOnEnter: [...enter],
          restoresOnLeave: [...leave],
          missing,
        });
      }
    }
  }
  return { findings, tags };
}

const root = process.argv[2];
const selftest = process.argv.includes('--selftest');

if (selftest) {
  const dir = 'C:/tmp/qa-r94-selftest';
  fs.mkdirSync(dir, { recursive: true });
  // Positive 1: enter sets 2 props, leave restores only 1 -> transform sticks.
  // Positive 2: enter sets a prop, no onMouseLeave at all.
  // Negative 1: symmetric pair -> must NOT be reported.
  // Negative 2: an apostrophe in JSX text + an arrow-function prop, which broke
  //             two prior harnesses; the symmetric tag after it must still parse.
  fs.writeFileSync(path.join(dir, 'Probe.jsx'),
    'export default function P() {\n' +
    '  return (<div>\n' +
    '    <button onMouseEnter={e => { e.currentTarget.style.background = "red";' +
    ' e.currentTarget.style.transform = "scale(1.1)"; }}\n' +
    '            onMouseLeave={e => { e.currentTarget.style.background = ""; }}>A</button>\n' +
    '    <button onMouseEnter={e => { e.currentTarget.style.opacity = "0.5"; }}>B</button>\n' +
    '    <span>you\'re all clear</span>\n' +
    '    <button onClose={() => setX(false)} onMouseEnter={e => { e.currentTarget.style.color = "b"; }}\n' +
    '            onMouseLeave={e => { e.currentTarget.style.color = ""; }}>C</button>\n' +
    '  </div>);\n}\n');
  const { findings } = analyze([path.join(dir, 'Probe.jsx')]);
  const a = findings.find(f => f.missing.includes('transform') && f.hasLeave);
  const b = findings.find(f => f.missing.includes('opacity') && !f.hasLeave);
  const c = findings.find(f => f.missing.includes('color'));
  console.log(`SELFTEST partial-restore: ${a ? 'PASS' : 'FAIL'}`);
  console.log(`SELFTEST missing-leave:   ${b ? 'PASS' : 'FAIL'}`);
  console.log(`SELFTEST symmetric-clean: ${!c ? 'PASS' : 'FAIL (false positive)'}`);
  if (!a || !b || c) process.exit(1);
  console.log('');
}

const files = walk(root);
const { findings, tags } = analyze(files);
console.log(`${root}: ${files.length} files, ${tags} hover-handling tags`);
console.log(`findings: ${findings.length}\n`);
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  <${f.el}>  leave=${f.hasLeave}`);
  console.log(`      enter sets:  ${f.setsOnEnter.join(', ')}`);
  console.log(`      leave rests: ${f.restoresOnLeave.join(', ') || '(none)'}`);
  console.log(`      NOT RESTORED: ${f.missing.join(', ')}`);
}
