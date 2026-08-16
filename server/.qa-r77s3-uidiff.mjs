// Run 77 s3 UI audit — SET DIFFERENCE over UI name kinds.
// Kinds diffed here (untried in previous runs unless marked REGRESSION):
//   A. prop names PASSED in JSX      vs prop names DESTRUCTURED by the component
//   B. label htmlFor=""              vs id="" present in the same file
//   C. localStorage keys WRITTEN     vs keys READ
//   D. CustomEvent names DISPATCHED  vs names LISTENED for
//   E. REGRESSION: classNames used   vs CSS selectors defined
//   F. REGRESSION: var(--x) used     vs --x defined
//   G. REGRESSION: animation name    vs @keyframes defined
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Projects/stormleads/client/src';
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p.replace(/\\/g, '/'));
  }
})(ROOT);

const code = files.filter(f => /\.(jsx?|tsx?)$/.test(f));
const css = files.filter(f => /\.css$/.test(f));
const read = f => fs.readFileSync(f, 'utf8');
const rel = f => f.replace('C:/Projects/stormleads/', '');
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

const out = { A_props: [], B_htmlFor: [], C_localStorage: [], D_events: [], E_class: [], F_var: [], G_kf: [] };

// ---------- A. props passed vs destructured ----------
// component definition -> Set(prop names), or null when it takes a bare props object
const defs = new Map();          // name -> {props:Set|null, file}
const defFile = new Map();

function collectDefs(src, file) {
  // function Comp({ a, b, ...rest })   |   const Comp = ({ a, b }) =>   |   function Comp(props)
  const re = /(?:export\s+default\s+)?(?:export\s+)?(?:function\s+([A-Z]\w*)\s*\(|const\s+([A-Z]\w*)\s*=\s*(?:React\.)?(?:memo\()?\s*(?:forwardRef\()?\s*\()/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1] || m[2];
    const start = m.index + m[0].length;
    // grab the param list
    let depth = 1, i = start;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '(' || c === '{' || c === '[') depth++;
      else if (c === ')' || c === '}' || c === ']') depth--;
      i++;
    }
    const params = src.slice(start, i - 1);
    if (!/^\s*\{/.test(params)) {
      // bare props object or no params -> cannot diff
      defs.set(name, { props: null, file });
      continue;
    }
    const inner = params.slice(params.indexOf('{') + 1, params.lastIndexOf('}'));
    if (/\.\.\./.test(inner)) { defs.set(name, { props: null, file }); continue; }
    const props = new Set();
    // top-level identifiers before ':' '=' or ','
    let d = 0, buf = '';
    for (const ch of inner) {
      if ('{(['.includes(ch)) d++;
      else if ('})]'.includes(ch)) d--;
      if (ch === ',' && d === 0) { buf && props.add(buf); buf = ''; continue; }
      if (d === 0) buf += ch;
    }
    if (buf) props.add(buf);
    const clean = new Set();
    for (const p of props) {
      const nm = p.trim().split(/[:=]/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(nm)) clean.add(nm);
    }
    defs.set(name, { props: clean, file });
    defFile.set(name, file);
  }
}
for (const f of code) collectDefs(read(f), f);

const RESERVED = new Set(['key', 'ref', 'className', 'style', 'children', 'id', 'title', 'onClick', 'data-testid']);
for (const f of code) {
  const src = read(f);
  const re = /<([A-Z]\w*)((?:\s+[^<>]|\s*\n)*?)\/?>/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1], attrsRaw = m[2] || '';
    const def = defs.get(name);
    if (!def || def.props === null) continue;
    if (/\{\s*\.\.\./.test(attrsRaw)) continue;         // spread -> cannot diff
    const an = /(^|\s)([a-zA-Z_$][\w$-]*)\s*=/g;
    let a;
    while ((a = an.exec(attrsRaw))) {
      const prop = a[2];
      if (RESERVED.has(prop) || prop.startsWith('aria-') || prop.startsWith('data-')) continue;
      if (!def.props.has(prop)) {
        out.A_props.push({
          file: rel(f), line: lineOf(src, m.index), component: name,
          prop, definedIn: rel(def.file), known: [...def.props].join(',')
        });
      }
    }
  }
}

// ---------- B. htmlFor vs id ----------
for (const f of code) {
  const src = read(f);
  const ids = new Set([...src.matchAll(/\bid\s*=\s*["'`]([^"'`{}]+)["'`]/g)].map(x => x[1]));
  for (const m of src.matchAll(/htmlFor\s*=\s*["'`]([^"'`{}]+)["'`]/g)) {
    if (!ids.has(m[1])) out.B_htmlFor.push({ file: rel(f), line: lineOf(src, m.index), htmlFor: m[1] });
  }
}

// ---------- C. localStorage keys ----------
const lsWrite = new Map(), lsRead = new Map();
for (const f of code) {
  const src = read(f);
  for (const m of src.matchAll(/localStorage\.(setItem|getItem|removeItem)\(\s*['"`]([^'"`]+)['"`]/g)) {
    const rec = { file: rel(f), line: lineOf(src, m.index) };
    if (m[1] === 'setItem') (lsWrite.get(m[2]) || lsWrite.set(m[2], []).get(m[2])).push(rec);
    else (lsRead.get(m[2]) || lsRead.set(m[2], []).get(m[2])).push(rec);
  }
}
for (const [k, v] of lsWrite) if (!lsRead.has(k)) out.C_localStorage.push({ key: k, written: v, read: 'NEVER' });
for (const [k, v] of lsRead) if (!lsWrite.has(k)) out.C_localStorage.push({ key: k, read: v, written: 'NEVER' });

// ---------- D. custom events ----------
const evDispatch = new Map(), evListen = new Map();
for (const f of code) {
  const src = read(f);
  for (const m of src.matchAll(/new\s+CustomEvent\(\s*['"`]([^'"`]+)['"`]/g))
    (evDispatch.get(m[1]) || evDispatch.set(m[1], []).get(m[1])).push({ file: rel(f), line: lineOf(src, m.index) });
  for (const m of src.matchAll(/addEventListener\(\s*['"`]([^'"`]+)['"`]/g))
    (evListen.get(m[1]) || evListen.set(m[1], []).get(m[1])).push({ file: rel(f), line: lineOf(src, m.index) });
}
for (const [k, v] of evDispatch) if (!evListen.has(k)) out.D_events.push({ event: k, dispatched: v, listened: 'NEVER' });

// ---------- E/F/G regressions ----------
const cssAll = css.map(read).join('\n');
const selectors = new Set([...cssAll.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]));
const varsDefined = new Set([...cssAll.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
const kf = new Set([...cssAll.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]));

for (const f of code) {
  const src = read(f);
  for (const m of src.matchAll(/className\s*=\s*["'`]([^"'`]+)["'`]/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (!c || c.includes('$') || c.includes('{')) continue;
      if (!selectors.has(c)) out.E_class.push({ file: rel(f), line: lineOf(src, m.index), cls: c });
    }
  }
}
for (const f of [...code, ...css]) {
  const src = read(f);
  for (const m of src.matchAll(/var\(\s*(--[\w-]+)/g))
    if (!varsDefined.has(m[1])) out.F_var.push({ file: rel(f), line: lineOf(src, m.index), v: m[1] });
}
for (const f of [...code, ...css]) {
  const src = read(f);
  for (const m of src.matchAll(/animation(?:-name)?\s*:\s*([^;'"`\n]+)/g)) {
    for (const tok of m[1].trim().split(/\s+/)) {
      if (/^(none|inherit|initial|unset|infinite|alternate|forwards|backwards|both|linear|ease|ease-in|ease-out|ease-in-out|normal|reverse|running|paused|step-start|step-end)$/.test(tok)) continue;
      if (/^[\d.]|^cubic-bezier|^steps|^var\(|\$|\{/.test(tok)) continue;
      if (/^[a-zA-Z][\w-]*$/.test(tok) && !kf.has(tok))
        out.G_kf.push({ file: rel(f), line: lineOf(src, m.index), name: tok });
    }
  }
}

// tailwind classes are generated, filter the obvious ones out of E
const TW = /^(flex|grid|hidden|block|inline|relative|absolute|fixed|sticky|w-|h-|p-|px-|py-|pt-|pb-|pl-|pr-|m-|mx-|my-|mt-|mb-|ml-|mr-|gap-|text-|bg-|border|rounded|font-|items-|justify-|space-|overflow|truncate|opacity-|z-|min-|max-|top-|bottom-|left-|right-|col-|row-|shadow|cursor-|transition|duration-|leading-|tracking-|whitespace|uppercase|lowercase|capitalize|underline|self-|order-|basis-|shrink|grow|object-|select-|resize|list-|align-|table|sr-only|pointer-events|inset|divide|ring|backdrop|animate-|hover:|focus:|active:|disabled:|group|peer|first|last|odd|even|sm:|md:|lg:|xl:|2xl:|dark:)/;
out.E_class = out.E_class.filter(x => !TW.test(x.cls));

fs.writeFileSync('C:/tmp/r77s3-uidiff.json', JSON.stringify(out, null, 1));
const sum = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length]));
console.log(JSON.stringify(sum, null, 1));
console.log('--- B htmlFor ---'); console.log(JSON.stringify(out.B_htmlFor, null, 1));
console.log('--- C localStorage ---'); console.log(JSON.stringify(out.C_localStorage, null, 1));
console.log('--- D events ---'); console.log(JSON.stringify(out.D_events, null, 1));
console.log('--- E class ---'); console.log(JSON.stringify(out.E_class.slice(0, 40), null, 1));
console.log('--- F var ---'); console.log(JSON.stringify(out.F_var.slice(0, 20), null, 1));
console.log('--- G keyframes ---'); console.log(JSON.stringify(out.G_kf.slice(0, 20), null, 1));
