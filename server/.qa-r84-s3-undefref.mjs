/**
 * Run 84-s3 set differences over client JSX. Two checks, both aimed at the ReferenceError /
 * dead-control class that produced Run 83's headline bug and Run 84's.
 *
 * CHECK A -- UNDEFINED JSX COMPONENTS
 *   An uppercase name used as a JSX tag whose ONLY whole-word occurrences in the file are
 *   JSX tag positions is neither imported nor declared -> ReferenceError at RENDER time.
 *   `.qa-r83-s2-scopediff.mjs` explicitly skips this class (`if (/^[A-Z]/.test(id)) continue`).
 *   Produced Run 84's IconCheck finding (EstimatesView.jsx:2929).
 *
 * CHECK B -- CROSS-BRANCH DEAD STATE
 *   A component with an early `if (cond) { ... return (<jsx>) }` plus a main return has two
 *   mutually exclusive render branches. If a useState pair's SETTER is called only inside the
 *   early branch while the state is READ only outside it, the control that calls the setter is
 *   100% dead -- and no rendering check can see it, because the target never enters the DOM.
 *   This is exactly EstimateBuilder's showSignModal / "Sign Now" defect, generalized.
 *
 * Uses the Run 83 offset-preserving JSX-safe stripper (a quote only opens a string in
 * EXPRESSION position, so `Don't` in JSX text does not swallow the rest of the file; stripped
 * text is blanked with spaces and newlines are kept, so offsets map 1:1 onto the raw file).
 *
 * NOTE: written with the Write tool, not a shell heredoc -- a heredoc collapses '\\w' to '\w',
 * which JS then reads as 'w', silently corrupting every new RegExp(...) built from a string.
 */
import fs from 'fs';
import path from 'path';

const BS = String.fromCharCode(92);
const toPosix = (p) => p.split(BS).join('/');
const blank = (s) => s.replace(/[^\n]/g, ' ');

function strip(src) {
  const n = src.length; let out = '', i = 0, prev = '';
  const exprPos = () => !/[A-Za-z0-9_$)\]]/.test(prev);
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2), end = e < 0 ? n : e + 2; out += blank(src.slice(i, end)); i = end; continue; }
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i), end = e < 0 ? n : e; out += blank(src.slice(i, end)); i = end; continue; }
    if ((c === '"' || c === "'") && exprPos()) {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === BS) j++; j++; }
      if (src[j] === c) { out += blank(src.slice(i, j + 1)); i = j + 1; prev = '_'; continue; }
    }
    if (c === '`') {
      let j = i + 1; out += ' ';
      while (j < n && src[j] !== '`') {
        if (src[j] === BS) { out += '  '; j += 2; continue; }
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

const walk = (d, acc = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|dist|[.]git/.test(p)) walk(p, acc); }
    else if (/[.]jsx$/.test(e.name) && !/[.]backup$/.test(e.name)) acc.push(p);
  }
  return acc;
};

// Whole-word occurrences of `name`, not preceded by a word char or '.', not followed by a word char.
function wordOffsets(code, name) {
  const re = new RegExp('(?:^|[^\\w$.])(' + name + ')(?![\\w$])', 'g');
  const offs = [];
  let m;
  while ((m = re.exec(code))) {
    offs.push(m.index + m[0].indexOf(name));
    re.lastIndex = m.index + 1;   // allow adjacent matches
  }
  return offs;
}

function matchBrace(code, open) {
  let depth = 0;
  for (let j = open; j < code.length; j++) {
    if (code[j] === '{') depth++;
    else if (code[j] === '}') { depth--; if (depth === 0) return j; }
  }
  return -1;
}

const HOST = new Set(['Fragment']);
const files = walk(process.argv[2] || 'client/src');
const undefComponents = [];
const crossBranch = [];

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const code = strip(raw);
  if (code.length !== raw.length) { console.log('STRIPPER LENGTH DRIFT', file); continue; }
  if (code.split('\n').length !== raw.split('\n').length) { console.log('STRIPPER LINE DRIFT', file); continue; }

  // ---------------- CHECK A ----------------
  const tagOcc = new Map();
  {
    const re = /<\/?\s*([A-Z][\w$]*)(?:\.[\w$]+)*/g;
    let m;
    while ((m = re.exec(code))) {
      const name = m[1];
      const nameAt = m.index + m[0].indexOf(name);
      if (!tagOcc.has(name)) tagOcc.set(name, []);
      tagOcc.get(name).push(nameAt);
    }
  }
  for (const [name, offs] of tagOcc) {
    if (HOST.has(name)) continue;
    const tagSet = new Set(offs);
    const nonTag = wordOffsets(code, name).filter((o) => !tagSet.has(o));
    if (nonTag.length === 0) {
      undefComponents.push({ file: toPosix(file), line: lineOf(code, offs[0]), name, uses: offs.length });
    }
  }

  // ---------------- CHECK B ----------------
  const branches = [];
  {
    const re = /\bif\s*\([^\n]*\)\s*\{/g;
    let m;
    while ((m = re.exec(code))) {
      const open = m.index + m[0].length - 1;
      const close = matchBrace(code, open);
      if (close < 0) continue;
      const body = code.slice(open, close);
      if (!/return\s*\(\s*\n?\s*</.test(body)) continue;   // must return JSX
      branches.push({ from: open, to: close, cond: m[0].replace(/\s+/g, ' ').slice(0, 60) });
    }
  }
  if (!branches.length) continue;
  const outer = branches.filter((b, i) => !branches.some((o, k) => k !== i && o.from < b.from && o.to > b.to));

  const pairs = [];
  {
    const re = /\bconst\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*(set[A-Za-z_$][\w$]*)\s*\]\s*=\s*useState/g;
    let m;
    while ((m = re.exec(code))) pairs.push({ state: m[1], setter: m[2], at: m.index });
  }
  const setterOf = new Map(pairs.map((p) => [p.state, p.setter]));

  // The whole false-positive population is ONE shape: the setter call sits in a handler that
  // ALSO flips the branch condition, so the next render lands in the other branch where the
  // reader lives. EstimatesView's "Send for Signing" does exactly this
  // (`setReviewMode(false); setShowSendModal(true)`) and is correct; "Sign Now" omitted the
  // setReviewMode(false) and was dead. Escape hatches (`onCancel={() => setShowBuilder(false)}`)
  // and state machines (Dashboard's goal editor) are the same shape.
  // So: suppress a hit when the enclosing handler also calls a setter for a state that the
  // branch condition tests.
  const condStates = (cond) => {
    const names = [];
    const re = /[A-Za-z_$][\w$]*/g;
    let m;
    while ((m = re.exec(cond))) if (setterOf.has(m[0])) names.push(m[0]);
    return names;
  };
  // Enclosing handler body = the nearest surrounding {...} block, capped so we do not swallow
  // the whole component.
  const handlerAround = (o) => {
    let start = -1, depth = 0;
    for (let j = o; j >= 0 && o - j < 1200; j--) {
      if (code[j] === '}') depth++;
      else if (code[j] === '{') { if (depth === 0) { start = j; break; } depth--; }
    }
    if (start < 0) return '';
    const end = matchBrace(code, start);
    return end < 0 ? '' : code.slice(start, end);
  };

  for (const p of pairs) {
    // Exclude the `const [x, setX] = useState(...)` declaration itself from BOTH sides.
    const setterOffs = wordOffsets(code, p.setter).filter((o) => Math.abs(o - p.at) > 80);
    const readOffs = wordOffsets(code, p.state).filter((o) => Math.abs(o - p.at) > 80);
    if (!setterOffs.length || !readOffs.length) continue;

    for (const b of outer) {
      const inB = (o) => o >= b.from && o <= b.to;
      const settersIn = setterOffs.filter(inB).length;
      const readsIn = readOffs.filter(inB).length;
      // Correct condition: a setter FIRES inside this branch and the branch NEVER reads the
      // state. Requiring *every* setter to be inside the branch was wrong and made the check
      // blind to its own motivating defect -- showSignModal's onClose/onSigned setters sit
      // next to the reader in the other branch (self-test caught this).
      if (settersIn > 0 && readsIn === 0) {
        const conds = condStates(b.cond);
        // Self-referential: the branch tests this very state, so its setter IS the exit.
        if (conds.includes(p.state)) continue;
        // Sibling exit: the handler holding the setter also flips a state the branch tests.
        const firstIn = setterOffs.filter(inB)[0];
        const body = handlerAround(firstIn);
        if (conds.some((c) => body.includes(setterOf.get(c) + '('))) continue;
        crossBranch.push({
          file: toPosix(file), state: p.state, setter: p.setter,
          setterLine: lineOf(code, setterOffs.filter(inB)[0]),
          readLine: lineOf(code, readOffs[0]),
          branch: b.cond, branchLines: lineOf(code, b.from) + '-' + lineOf(code, b.to),
        });
      }
    }
  }
}

console.log('FILES SCANNED:', files.length);
console.log('');
console.log('=== CHECK A: JSX component tags with NO import/declaration (render ReferenceError) ===');
console.log('COUNT:', undefComponents.length);
for (const f of undefComponents) console.log('  ' + f.file + ':' + f.line + '  <' + f.name + '>  (' + f.uses + ' tag uses, 0 non-tag occurrences)');
console.log('');
console.log('=== CHECK B: setter fires ONLY in an early-return branch, state read ONLY outside it ===');
console.log('COUNT:', crossBranch.length);
for (const f of crossBranch) {
  console.log('  ' + f.file + '  "' + f.state + '"');
  console.log('      ' + f.setter + '() at :' + f.setterLine + '  inside  ' + f.branch + '  (lines ' + f.branchLines + ')');
  console.log('      read only at :' + f.readLine + ' (outside that branch)  -> control is DEAD');
}
