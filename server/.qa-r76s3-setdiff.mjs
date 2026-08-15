// Run 76 s3 — set-difference sweeps over client code.
// Finds "declared but undefined" contracts that render identically to working ones.
import fs from 'fs';
import path from 'path';

const SRC = 'C:/Projects/stormleads/client/src';
const CSS_PATH = path.join(SRC, 'index.css');
const css = fs.readFileSync(CSS_PATH, 'utf8');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx|js)$/.test(e.name) && !/\.backup$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(SRC);
const rel = f => path.relative(SRC, f).replace(/\\/g, '/');

// ---------- 1. CSS custom properties: var(--x) used vs --x: defined ----------
const definedVars = new Set();
for (const m of css.matchAll(/(^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g)) definedVars.add(m[2]);

const usedVars = new Map(); // name -> [locations]
function noteVar(name, loc) {
  if (!usedVars.has(name)) usedVars.set(name, []);
  usedVars.get(name).push(loc);
}
// from CSS
const cssLines = css.split('\n');
cssLines.forEach((line, i) => {
  for (const m of line.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*(,)?/g)) {
    noteVar(m[1], `index.css:${i + 1}${m[2] ? ' (has fallback)' : ''}`);
  }
});
// from JSX/JS
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  txt.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*(,)?/g)) {
      noteVar(m[1], `${rel(f)}:${i + 1}${m[2] ? ' (has fallback)' : ''}`);
    }
    // also inline style objects setting custom props:  '--foo': ...
    for (const m of line.matchAll(/['"](--[A-Za-z0-9_-]+)['"]\s*:/g)) definedVars.add(m[1]);
  });
}
const undefinedVars = [...usedVars.entries()].filter(([n]) => !definedVars.has(n));

// ---------- 2. @keyframes: animation names used vs defined ----------
const definedKf = new Set([...css.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)].map(m => m[1]));
const kfUsed = new Map();
const CSS_KEYWORDS = new Set(['none','infinite','alternate','forwards','backwards','both','normal','reverse','alternate-reverse','linear','ease','ease-in','ease-out','ease-in-out','running','paused','step-start','step-end','initial','inherit','unset','revert','var','cubic-bezier','steps','s','ms','1','2','3','infinite']);
function noteKf(name, loc) {
  if (!kfUsed.has(name)) kfUsed.set(name, []);
  kfUsed.get(name).push(loc);
}
cssLines.forEach((line, i) => {
  let m = line.match(/animation-name\s*:\s*([A-Za-z0-9_,\s-]+);/);
  if (m) m[1].split(',').map(s => s.trim()).forEach(n => { if (n && !CSS_KEYWORDS.has(n)) noteKf(n, `index.css:${i + 1}`); });
  m = line.match(/(^|[;{\s])animation\s*:\s*([^;}]+)/);
  if (m) {
    // strip functions, times, and keywords; what remains that looks like an ident is the name
    const body = m[2].replace(/var\([^)]*\)/g, ' ').replace(/cubic-bezier\([^)]*\)/g, ' ').replace(/steps\([^)]*\)/g, ' ');
    for (const tok of body.split(/[\s,]+/)) {
      const t = tok.trim();
      if (!t || CSS_KEYWORDS.has(t)) continue;
      if (/^[\d.]+m?s$/.test(t) || /^[\d.]+$/.test(t) || /^-?[\d.]+%$/.test(t)) continue;
      if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(t)) noteKf(t, `index.css:${i + 1}`);
    }
  }
});
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  txt.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/animation\s*:\s*['"`]([^'"`]+)['"`]/g)) {
      for (const tok of m[1].replace(/cubic-bezier\([^)]*\)/g, ' ').split(/[\s,]+/)) {
        const t = tok.trim();
        if (!t || CSS_KEYWORDS.has(t)) continue;
        if (/^[\d.]+m?s$/.test(t) || /^[\d.]+$/.test(t)) continue;
        if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(t)) noteKf(t, `${rel(f)}:${i + 1}`);
      }
    }
    for (const m of line.matchAll(/animationName\s*:\s*['"`]([A-Za-z0-9_-]+)['"`]/g)) noteKf(m[1], `${rel(f)}:${i + 1}`);
  });
}
const undefinedKf = [...kfUsed.entries()].filter(([n]) => !definedKf.has(n));
const unusedKf = [...definedKf].filter(n => !kfUsed.has(n));

// ---------- 3. classNames used in JSX vs selectors defined in CSS ----------
const definedClasses = new Set();
for (const m of css.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)) definedClasses.add(m[1]);

const usedClasses = new Map();
const TAILWIND = /^(sm|md|lg|xl|2xl|hover|focus|active|group|peer|dark|first|last|odd|even|disabled|placeholder|before|after|motion|print|max|min|has|aria|data)[:-]/;
function looksTailwind(c) {
  return TAILWIND.test(c) || /^(flex|grid|block|inline|hidden|absolute|relative|fixed|sticky|static|w-|h-|min-w|max-w|min-h|max-h|p-|px-|py-|pt-|pb-|pl-|pr-|m-|mx-|my-|mt-|mb-|ml-|mr-|gap-|space-|text-|font-|leading-|tracking-|bg-|border|rounded|shadow|opacity-|z-|overflow|items-|justify-|self-|content-|order-|col-|row-|top-|bottom-|left-|right-|inset-|transition|duration-|ease-|transform|scale-|rotate-|translate-|cursor-|select-|pointer-events|whitespace|break-|truncate|uppercase|lowercase|capitalize|underline|line-through|list-|object-|resize|appearance|outline|ring|divide|placeholder-|animate-|delay-|origin-|will-change|backdrop-|filter|blur|brightness|contrast|grayscale|invert|saturate|sepia|sr-only|not-sr-only|antialiased|subpixel|italic|tabular|slashed|basis-|grow|shrink|table|aspect-|container|mx-auto|float-|clear-)/.test(c);
}
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  txt.split('\n').forEach((line, i) => {
    // className="..."  and className={`...`} and className={cond ? 'a' : 'b'}
    for (const m of line.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([^}]*)\})/g)) {
      const raw = m[1] !== undefined ? m[1] : (m[2] || '');
      // pull all string literal contents out of the expression form
      const chunks = m[1] !== undefined ? [m[1]] : [...raw.matchAll(/['"`]([^'"`]*)['"`]/g)].map(x => x[1]);
      for (const chunk of chunks) {
        for (const tok of chunk.split(/[\s]+/)) {
          const c = tok.trim().replace(/^\$\{.*$/, '');
          if (!c || /[${}()<>,]/.test(c)) continue;
          if (!/^-?[A-Za-z_][A-Za-z0-9_-]*$/.test(c)) continue;
          if (!usedClasses.has(c)) usedClasses.set(c, []);
          usedClasses.get(c).push(`${rel(f)}:${i + 1}`);
        }
      }
    }
  });
}
const undefinedClasses = [...usedClasses.entries()]
  .filter(([c]) => !definedClasses.has(c) && !looksTailwind(c));

// ---------- 4. icon imports ----------
const iconImports = [];
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  txt.split('\n').forEach((line, i) => {
    const m = line.match(/from\s+['"]([^'"]*(?:heroicons|lucide|react-icons|@fortawesome|material|tabler|feather|phosphor)[^'"]*)['"]/i);
    if (m) iconImports.push(`${rel(f)}:${i + 1} -> ${m[1]}`);
  });
}

const out = {
  counts: {
    files: files.length,
    definedVars: definedVars.size, usedVars: usedVars.size,
    definedKeyframes: definedKf.size, usedKeyframes: kfUsed.size,
    definedClasses: definedClasses.size, usedClasses: usedClasses.size,
  },
  UNDEFINED_CSS_VARS: undefinedVars.map(([n, locs]) => ({ name: n, count: locs.length, locs: locs.slice(0, 8) })),
  UNDEFINED_KEYFRAMES: undefinedKf.map(([n, locs]) => ({ name: n, locs })),
  UNUSED_KEYFRAMES: unusedKf,
  UNDEFINED_CLASSES: undefinedClasses.map(([c, locs]) => ({ cls: c, count: locs.length, locs: locs.slice(0, 6) })),
  ICON_IMPORTS_NON_OUTLINE: iconImports.filter(s => !/@heroicons\/react\/24\/outline/.test(s)),
  ICON_IMPORT_TOTAL: iconImports.length,
};
fs.writeFileSync('C:/tmp/r76s3-setdiff.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.counts));
console.log('UNDEFINED_CSS_VARS:', out.UNDEFINED_CSS_VARS.length);
console.log('UNDEFINED_KEYFRAMES:', out.UNDEFINED_KEYFRAMES.length);
console.log('UNDEFINED_CLASSES:', out.UNDEFINED_CLASSES.length);
console.log('NON-OUTLINE ICON IMPORTS:', out.ICON_IMPORTS_NON_OUTLINE.length, '/ total', out.ICON_IMPORT_TOTAL);
