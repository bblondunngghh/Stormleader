// Run 129 (s2-frontend-test) — HYDRATED + EDITABLE + NEVER SENT
//
// Run 128's sibling payload diff (.qa-r128-s2-payloaddiff.mjs) compares N write payloads
// in one file against each other. It is structurally BLIND when N === 1: a form with a
// single save path can drop a field and there is no sibling to diff against. That is the
// same user-visible defect as dc5dab9 (edit a field, see "Saved!", lose the edit).
//
// This harness closes that gap from the other side. For each component it builds:
//   P = every key any write call in the file sends (spreads resolved through useState)
//   E = state that is BOTH hydrated from a server entity AND mutated by a JSX handler
// and reports E \ P — a field the user can see, edit, and lose.
//
// Read-only. `node .qa-r129-s2-dropfield.mjs [walkRoot] [--selftest]`.
// --selftest points the walk at a tree containing the pre-fix dc5dab9 EstimatesView and
// asserts the diff rediscovers profit_margin; a check that cannot find a proven defect is
// not evidence of anything (Run 84).
import fs from 'fs';
import path from 'path';

const ROOT = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : 'C:/Projects/stormleads/client/src';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

// Blank comments with spaces so every offset and line number still maps to raw source.
function stripComments(src) {
  const a = src.split('');
  let i = 0;
  while (i < src.length - 1) {
    if (src[i] === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') { a[i] = ' '; i++; }
    } else if (src[i] === '/' && src[i + 1] === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] !== '\n') a[i] = ' ';
        i++;
      }
      if (i < src.length) a[i] = ' ';
      if (i + 1 < src.length) a[i + 1] = ' ';
      i += 2;
    } else i++;
  }
  return a.join('');
}

function scanObject(src, start) {
  let depth = 0, i = start, q = null;
  while (i < src.length) {
    const c = src[i];
    if (q) {
      if (c === '\\') { i += 2; continue; }
      if (c === q) q = null;
      else if (q === '`' && c === '$' && src[i + 1] === '{') { i += 2; depth++; continue; }
    } else if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    i++;
  }
  return null;
}

// Top-level entries of an object literal: { key, isSpread, valueSrc }
function topEntries(objSrc) {
  const body = objSrc.slice(1, -1);
  const out = [];
  let depth = 0, q = null, tok = '';
  const flush = () => {
    const t = tok.trim();
    tok = '';
    if (!t) return;
    if (t.startsWith('...')) { out.push({ key: t.slice(3).trim().replace(/[^\w$.]/g, ''), spread: true }); return; }
    const m = t.match(/^(?:'([^']*)'|"([^"]*)"|([A-Za-z_$][\w$]*))\s*(:)?/);
    if (!m) return;
    const key = m[1] || m[2] || m[3];
    if (!key) return;
    out.push({ key, spread: false, value: m[4] ? t.slice(t.indexOf(':') + 1).trim() : key });
  };
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) {
      tok += c;
      if (c === '\\') { tok += body[i + 1]; i++; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; tok += c; continue; }
    if (c === '{' || c === '(' || c === '[') depth++;
    if (c === '}' || c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) { flush(); continue; }
    tok += c;
  }
  flush();
  return out;
}

// Any Api.<verb> that is not plainly a read. An under-inclusive verb list here would
// leave a real payload unscanned and MANUFACTURE a defect (recordPayment's three
// positional args read as dropped fields on the first pass), so this side stays generous.
const WRITE_CALL = /(?:\bclient\.(?:post|put|patch|delete)\s*\(|\b[A-Za-z_$][\w$]*Api\.(?!get|list|fetch|load|search|find|export|download|preview)[A-Za-z_$][\w$]*\s*\()/g;
const USESTATE_OBJ = /\b(?:const|let)\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*(set[A-Za-z_$][\w$]*)\s*\]\s*=\s*useState\s*\(\s*\{/g;
const USESTATE_ANY = /\b(?:const|let)\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*(set[A-Za-z_$][\w$]*)\s*\]\s*=\s*useState\s*\(/g;

const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

// UI-only state that is never meant to reach the server. Keeping this list tight and
// explicit is what stops the check degenerating into noise.
const UI_ONLY = /^(show|open|is|has|editing|active|selected|expanded|collapsed|hover|loading|saving|sending|busy|error|errors|success|toast|banner|msg|message|search|query|q|filter|filters|sort|sortBy|sortDir|page|pageSize|limit|offset|tab|activeTab|step|mode|view|preview|dragging|drag|drop|menu|modal|dropdown|confirm|copied|touched|dirty|focus)/;

const findings = [];
const files = walk(ROOT);

for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const src = stripComments(raw);
  if (src.length !== raw.length) throw new Error('offset drift in ' + f);
  if (!WRITE_CALL.test(src)) { WRITE_CALL.lastIndex = 0; continue; }
  WRITE_CALL.lastIndex = 0;

  const rel = path.relative(ROOT, f).replace(/\\/g, '/');

  // ---- useState objects: name -> its literal keys (so `...form` resolves) ----
  const stateObjKeys = new Map();
  let m;
  USESTATE_OBJ.lastIndex = 0;
  while ((m = USESTATE_OBJ.exec(src))) {
    const obj = scanObject(src, m.index + m[0].length - 1);
    if (!obj) continue;
    stateObjKeys.set(m[1], topEntries(obj).filter(e => !e.spread).map(e => e.key));
  }

  // ---- every state var and its setter ----
  const setterOf = new Map();
  USESTATE_ANY.lastIndex = 0;
  while ((m = USESTATE_ANY.exec(src))) setterOf.set(m[1], { setter: m[2], line: src.slice(0, m.index).split('\n').length });

  // ---- named payload objects: `const data = { … }` (Run 126's shape) ----
  const namedObj = new Map();
  const ASSIGN = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;
  while ((m = ASSIGN.exec(src))) {
    const obj = scanObject(src, m.index + m[0].length - 1);
    if (obj) namedObj.set(m[1], obj);
  }

  // ---- P: everything any write call sends ----
  // Any identifier ANYWHERE in a write call's argument list counts as sent — that covers
  // positional args (recordPayment(id, val, method, note)), named payload objects and
  // inline literals alike. Under-reporting here would manufacture false defects, so this
  // side is deliberately generous.
  const sent = new Set();
  const absorb = (objSrc, depth = 0) => {
    for (const e of topEntries(objSrc)) {
      if (e.spread) {
        const base = e.key.split('.')[0];
        for (const k of (stateObjKeys.get(base) || [])) sent.add(k);
        if (depth < 2 && namedObj.has(base)) absorb(namedObj.get(base), depth + 1);
        sent.add(base);
      } else {
        sent.add(e.key);
        for (const id of (e.value || '').match(/[A-Za-z_$][\w$]*/g) || []) sent.add(id);
      }
    }
  };
  WRITE_CALL.lastIndex = 0;
  while ((m = WRITE_CALL.exec(src))) {
    let i = m.index + m[0].length, depth = 1, q = null;
    const start = i;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; i++; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; i++; continue; }
      if (c === '(' || c === '{' || c === '[') depth++;
      else if (c === ')' || c === '}' || c === ']') { depth--; if (!depth) break; }
      i++;
    }
    const args = src.slice(start, i);
    for (const id of args.match(/[A-Za-z_$][\w$]*/g) || []) {
      sent.add(id);
      if (namedObj.has(id)) absorb(namedObj.get(id));
      for (const k of (stateObjKeys.get(id) || [])) sent.add(k);
    }
    const objStart = args.indexOf('{') >= 0 ? start + args.indexOf('{') : -1;
    if (objStart >= 0) { const o = scanObject(src, objStart); if (o) absorb(o); }
  }
  if (!sent.size) continue;

  // ---- E: state that is hydrated from an entity AND mutated from JSX ----
  for (const [name, info] of setterOf) {
    if (UI_ONLY.test(name)) continue;
    if (stateObjKeys.has(name)) continue;      // whole-object form state; spread-resolved above

    // hydrated: the setter is called with a member access off some other object
    // (setDeposit(estimate.deposit ?? …)) — i.e. it carries a server value.
    const hyd = new RegExp(`\\b${info.setter}\\s*\\(\\s*[A-Za-z_$][\\w$]*(?:\\?)?\\.[\\w$]`).test(src);
    if (!hyd) continue;

    // editable: the setter appears inside a JSX handler attribute
    const edit = new RegExp(`on(?:Change|Input|Click|Select|Blur|Toggle|Add|Remove|Save)\\s*=\\s*\\{[^}]{0,400}?\\b${info.setter}\\b`, 's').test(src)
      || new RegExp(`\\b${info.setter}\\b`, 'g').test(src) && (src.match(new RegExp(`\\b${info.setter}\\s*\\(`, 'g')) || []).length >= 3;
    if (!edit) continue;

    const sn = snake(name);
    if (sent.has(name) || sent.has(sn) || sent.has('...' + name)) continue;
    // a key that merely CONTAINS the name (deposit -> depositEnabled) still counts as sent
    let covered = false;
    for (const k of sent) {
      const ks = snake(k.replace(/^\.\.\./, ''));
      if (ks === sn || ks.startsWith(sn + '_') || sn.startsWith(ks + '_')) { covered = true; break; }
    }
    if (covered) continue;

    findings.push({ file: rel, line: info.line, state: name, setter: info.setter, sentKeys: sent.size });
  }
}

if (process.argv.includes('--selftest')) {
  const hit = findings.some(f => /EstimatesView/.test(f.file) && /profitMargin|profit/i.test(f.state));
  console.log(hit ? 'SELFTEST PASS — rediscovered the dc5dab9 field' : 'SELFTEST FAIL — check cannot see a proven defect');
}

console.log(`files=${files.length} findings=${findings.length}`);
for (const f of findings) console.log(`${f.file}:${f.line}  ${f.state} (${f.setter}) — hydrated + editable, in none of the ${f.sentKeys} sent keys`);
