// QA Run 86 — set difference: callback props a component INVOKES
// vs props actually PASSED by each parent that renders it.
//
// WHY THIS SHAPE: the app's last four defects were all "control does nothing / crashes".
// A child that does `onClick={() => onSomething()}` where the parent omitted `onSomething`
// is a dead control (or a TypeError) that no render-only sweep can see, because the
// component mounts fine — it only breaks when the control is clicked.
//
// Usage: node .qa-r86-props.mjs [walkRoot]

import fs from 'fs';
import path from 'path';

const WALK_ROOT = process.argv[2] || path.resolve('../client/src');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.jsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = walk(WALK_ROOT);
const srcOf = {};
for (const f of files) srcOf[f] = fs.readFileSync(f, 'utf8');

// Split a destructuring body on top-level commas (ignore nested {} [] () and defaults)
function splitTop(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if ('{[('.includes(ch)) depth++;
    else if ('}])'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// ---------- 1. Find component definitions and their destructured props ----------
// function Name({ a, b }) ...   |   const Name = ({ a, b }) => ...
const components = {}; // name -> { file, props:Set, defaults:Set, usesSpread:bool }
for (const f of files) {
  const src = srcOf[f];
  // Find `Name(` / `Name = (` then brace-scan the destructuring pattern.
  // A non-greedy `\{([\s\S]*?)\}` stops at the first '}', which is the WRONG one
  // whenever a prop has an arrow-function default (`onTick = () => {}`), and a
  // `/=>/` reject-guard silently drops every such component from coverage.
  const pats = [
    /(?:export\s+(?:default\s+)?)?function\s+([A-Z][A-Za-z0-9_$]*)\s*\(\s*\{/g,
    /const\s+([A-Z][A-Za-z0-9_$]*)\s*=\s*\(\s*\{/g,
  ];
  for (const re of pats) {
    for (const m of src.matchAll(re)) {
      const name = m[1];
      let i = m.index + m[0].length, depth = 0, str = null, body = '', closed = false;
      while (i < src.length && body.length < 4000) {
        const ch = src[i];
        if (str) {
          if (ch === '\\') { body += src[i] + src[i + 1]; i += 2; continue; }
          if (ch === str) str = null;
          body += ch; i++; continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { str = ch; body += ch; i++; continue; }
        if ('{(['.includes(ch)) depth++;
        else if (')]'.includes(ch)) depth--;
        else if (ch === '}') { if (depth === 0) { closed = true; break; } depth--; }
        body += ch; i++;
      }
      if (!closed) continue;
      // the pattern must actually close the parameter list: `}` then `)` (or `, ...)` )
      const after = src.slice(i + 1, i + 40).trimStart();
      if (!/^[),]/.test(after)) continue;
      // external name (what a parent passes) vs local binding (what the body calls).
      // `lead: legacyLead` means parents pass `lead` but the body only ever sees
      // `legacyLead` — conflating the two invents findings out of thin air.
      const props = new Set(), defaults = new Set(), localOf = {};
      for (const part of splitTop(body)) {
        const t = part.trim();
        if (!t || t.startsWith('...')) continue;
        const eq = t.indexOf('=');
        const decl = (eq >= 0 ? t.slice(0, eq) : t).trim();
        const [extRaw, locRaw] = decl.split(':');
        const ext = (extRaw || '').trim();
        const loc = (locRaw || extRaw || '').trim();
        if (!/^[A-Za-z0-9_$]+$/.test(ext) || !/^[A-Za-z0-9_$]+$/.test(loc)) continue;
        props.add(ext);
        localOf[ext] = loc;
        if (eq >= 0) defaults.add(ext);           // has a default -> never undefined
      }
      if (props.size) components[name] = { file: f, props, defaults, localOf };
    }
  }
}

// ---------- 2. Which of those props are INVOKED as functions inside the component? ----------
// Comments and string literals must be stripped first: the prose
// "Fetch documents for this lead (must be before…)" matches /lead\s*\(/ and
// makes a plain data prop look like an invoked callback.
function stripNoise(src) {
  // Strip COMMENTS ONLY. Do NOT track string literals: an apostrophe in JSX text
  // ("you're all clear") is not a string delimiter, but a naive stripper treats it
  // as one and blanks everything to the next apostrophe — silently deleting whole
  // regions of the file and manufacturing both false positives and false negatives.
  let out = '', i = 0;
  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2; continue;
    }
    // line comment, but not the "//" in a URL like http://
    if (src[i] === '/' && src[i + 1] === '/' && (i === 0 || src[i - 1] !== ':')) {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    out += src[i]; i++;
  }
  return out;
}

for (const [name, c] of Object.entries(components)) {
  const src = stripNoise(srcOf[c.file]);
  const invoked = new Set();
  for (const p of c.props) {
    const local = c.localOf[p];               // call sites use the LOCAL binding
    const esc = local.replace(/\$/g, '\\$');
    // local(...)  but NOT local?.(...) — optional call is a deliberate "may be absent" guard
    const call = new RegExp('(?<![.\\w$?])' + esc + '\\s*\\(', 'g');
    const optional = new RegExp('(?<![.\\w$])' + esc + '\\s*\\?\\.\\s*\\(', 'g');
    const nCall = [...src.matchAll(call)].length;
    const nOpt = [...src.matchAll(optional)].length;
    if (nCall > nOpt && nCall > 0) invoked.add(p);
  }
  c.invoked = invoked;
}

// ---------- 3. For each JSX call site, which attributes are passed? ----------
const findings = [];
const stats = { files: files.length, components: Object.keys(components).length, callSites: 0 };

for (const f of files) {
  const src = srcOf[f];
  for (const [name, c] of Object.entries(components)) {
    if (!c.invoked.size) continue;
    // <Name ...attrs... />  or  <Name ...attrs... >
    // NOTE: cannot regex to the first '>' — arrow functions in attribute values
    // (`onClose={() => setX(false)}`) contain '>' and truncate the attribute blob,
    // which silently manufactures "missing prop" false positives. Scan with brace depth.
    const open = new RegExp('<' + name + '(?![A-Za-z0-9_$])', 'g');
    for (const m of src.matchAll(open)) {
      let i = m.index + m[0].length;
      let depth = 0, str = null, attrs = '', ok = false;
      while (i < src.length && attrs.length < 8000) {
        const ch = src[i];
        if (str) {
          if (ch === str && src[i - 1] !== '\\') str = null;
        } else if (ch === '"' || ch === "'" || ch === '`') str = ch;
        else if (ch === '{') depth++;
        else if (ch === '}') depth--;
        else if (ch === '>' && depth === 0) { ok = true; break; }
        attrs += ch; i++;
      }
      if (!ok) continue;
      stats.callSites++;
      if (/\{\s*\.\.\./.test(attrs)) continue; // spread — can't resolve statically
      const passed = new Set([...attrs.matchAll(/(?:^|\s)([A-Za-z0-9_$]+)\s*=/g)].map(x => x[1]));
      const line = src.slice(0, m.index).split('\n').length;
      for (const p of c.invoked) {
        if (passed.has(p)) continue;
        if (c.defaults.has(p)) continue;         // has a default value
        findings.push({
          component: name,
          definedIn: path.relative(WALK_ROOT, c.file),
          missingProp: p,
          calledFrom: path.relative(WALK_ROOT, f),
          line,
          site: ('<' + name + attrs).replace(/\s+/g, ' ').slice(0, 120)
        });
      }
    }
  }
}

console.log(JSON.stringify({ walkRoot: WALK_ROOT, stats, findingCount: findings.length, findings }, null, 2));
