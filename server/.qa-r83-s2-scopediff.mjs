/**
 * Set difference: identifiers referenced inside JSX event handlers vs identifiers
 * actually in that component's scope.
 *
 * Targets the defect class found in Run 83 (EstimatesView.jsx:1637): a handler in
 * component B referencing state that belongs to component A in the same file. The
 * control renders perfectly and throws ReferenceError on click, so it is invisible to
 * screenshot, computed-style and render-count checks. The repo has no ESLint, so
 * nothing else guards it.
 *
 * Reported only when the identifier IS declared in a DIFFERENT component in the same
 * file — that is the high-confidence signal (a genuine cross-scope leak) as opposed to
 * a global or an import this crude parser missed.
 */
import fs from 'fs';
import path from 'path';

const BS = String.fromCharCode(92);
const toPosix = (p) => p.split(BS).join('/');

const walk = (d, acc = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|dist|[.]git/.test(p)) walk(p, acc); }
    else if (/[.]jsx$/.test(e.name)) acc.push(p);
  }
  return acc;
};

const GLOBALS = new Set(['window','document','console','Math','JSON','Object','Array','String','Number','Boolean','Date','Promise','Map','Set','RegExp','Error','parseInt','parseFloat','isNaN','setTimeout','setInterval','clearTimeout','clearInterval','fetch','localStorage','sessionStorage','navigator','location','history','alert','confirm','prompt','encodeURIComponent','decodeURIComponent','URL','Blob','FormData','File','FileReader','React','undefined','null','true','false','this','new','typeof','await','async','return','if','else','const','let','var','function','e','ev','evt','event']);

// Find the region of every top-level component/function declaration in a file.
function regions(src) {
  const lines = src.split('\n');
  const starts = [];
  lines.forEach((ln, i) => {
    if (/^(export\s+default\s+)?(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.test(ln) ||
        /^(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(ln) ||
        /^(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*function/.test(ln)) {
      const m = ln.match(/(?:function|const)\s+([A-Za-z_$][\w$]*)/);
      if (m) starts.push({ name: m[1], line: i });
    }
  });
  return starts.map((s, k) => ({
    name: s.name,
    from: s.line,
    to: k + 1 < starts.length ? starts[k + 1].line - 1 : lines.length - 1,
  }));
}

// Over-collect declared names inside a region (over-collecting kills false positives).
function declared(text) {
  const names = new Set();
  const add = (s) => { if (s) String(s).split(/[,\s]+/).forEach((n) => {
    const c = n.replace(/[^\w$]/g, ''); if (c && !/^\d/.test(c)) names.add(c); }); };
  let m;
  const patterns = [
    /\b(?:const|let|var)\s*\[([^\]]*)\]/g,          // array destructure (useState)
    /\b(?:const|let|var)\s*\{([^}]*)\}/g,           // object destructure
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,    // plain decl
    /\bfunction\s+([A-Za-z_$][\w$]*)/g,             // fn decl
    /\bfunction\s*\(([^)]*)\)/g,                    // anon fn params
    /\bfunction\s+[A-Za-z_$][\w$]*\s*\(([\s\S]*?)\)\s*\{/g, // NAMED fn params (incl. destructured props)
    /\(([^)]*)\)\s*=>/g,                            // arrow params
    /([A-Za-z_$][\w$]*)\s*=>/g,                     // single arrow param
    /\bcatch\s*\(([^)]*)\)/g,                       // catch param
    /\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  ];
  for (const re of patterns) { while ((m = re.exec(text))) add(m[1]); }
  // destructure with renames / defaults inside object patterns
  const re2 = /\{([^{}]*)\}\s*=/g;
  while ((m = re2.exec(text))) {
    m[1].split(',').forEach((part) => {
      const t = part.includes(':') ? part.split(':')[1] : part;
      add(t.split('=')[0]);
    });
  }
  return names;
}

// Pull the balanced {...} body of every JSX on*= handler in a region.
function handlerBodies(text) {
  const out = [];
  const re = /\bon[A-Z][A-Za-z]*=\{/g;
  let m;
  while ((m = re.exec(text))) {
    let i = re.lastIndex, depth = 1;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    out.push({ body: text.slice(re.lastIndex, i - 1), at: m.index });
  }
  return out;
}

const findings = [];
for (const file of walk('client/src')) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const regs = regions(src);
  if (regs.length < 2) continue;

  // module scope = everything outside any region (imports, consts, helpers)
  const inRegion = new Set();
  regs.forEach((r) => { for (let i = r.from; i <= r.to; i++) inRegion.add(i); });
  const moduleText = lines.filter((_, i) => !inRegion.has(i)).join('\n');
  const moduleNames = declared(moduleText);
  regs.forEach((r) => moduleNames.add(r.name));
  { // imports
    let m; const re = /import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\})?/g;
    while ((m = re.exec(src))) {
      if (m[1]) moduleNames.add(m[1]);
      if (m[2]) m[2].split(',').forEach((s) => { const t = s.includes(' as ') ? s.split(' as ')[1] : s; const c = t.replace(/[^\w$]/g, ''); if (c) moduleNames.add(c); });
    }
  }

  const regDecls = regs.map((r) => declared(lines.slice(r.from, r.to + 1).join('\n')));

  regs.forEach((r, ri) => {
    const text = lines.slice(r.from, r.to + 1).join('\n');
    const own = regDecls[ri];
    for (const h of handlerBodies(text)) {
      const localNames = declared(h.body);
      // Strip comments and string literals before harvesting identifiers. Without this
      // every word inside a message or a URL ('sms-message-input', '/storm-map?stormId=',
      // '// open signing') reads as an identifier — that was 6 of 7 hits on the first pass.
      const clean = h.body
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ')
        .replace(/'(?:\\.|[^'\\])*'/g, "''")
        .replace(/"(?:\\.|[^"\\])*"/g, '""')
        .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, (s) =>
          (s.match(/\$\{[^}]*\}/g) || []).join(' '));   // keep ${...} interpolations
      const ids = new Set();
      let m; const re = /(?:^|[^\w$.'"`])([A-Za-z_$][\w$]*)\s*(?=[.?[(),;&|=!<>+\-*/\]}\s])/g;
      while ((m = re.exec(clean))) ids.add(m[1]);
      for (const id of ids) {
        if (GLOBALS.has(id) || own.has(id) || moduleNames.has(id) || localNames.has(id)) continue;
        if (/^[A-Z]/.test(id)) continue;                 // component/const refs
        // high-confidence only: declared in ANOTHER region of this same file
        const otherIdx = regDecls.findIndex((d, k) => k !== ri && d.has(id));
        if (otherIdx < 0) continue;
        const line = r.from + text.slice(0, h.at).split('\n').length;
        findings.push({ file: toPosix(file), line, comp: r.name, id, owner: regs[otherIdx].name,
          snippet: h.body.replace(/\s+/g, ' ').slice(0, 90) });
      }
    }
  });
}

console.log('CROSS-SCOPE HANDLER REFERENCES:', findings.length);
for (const f of findings) {
  console.log(`${f.file}:${f.line}  in <${f.comp}>  uses "${f.id}"  (declared in <${f.owner}>)`);
  console.log(`    ${f.snippet}`);
}
