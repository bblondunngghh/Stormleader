// Run 88 — SET DIFFERENCE: path params DECLARED in a route pattern vs path params
// READ by that route's handler.
//
// This is the exact shape of tonight's defect: DELETE /leads/:leadId/contacts/:contactId
// declared :leadId, never read it, and therefore deleted across leads.
//
// Only multi-param routes are interesting. A single-param route that ignores its param
// is a different (and much louder) bug; a nested route that ignores its PARENT param is
// silent, returns 2xx, and scopes to the wrong thing.
//
// Usage: node .qa-r88-orphanparam.mjs [routesDir]
//   routesDir defaults to ./src/routes — pass a git-extracted tree to self-test.
import fs from 'fs';
import path from 'path';

const ROOT = process.argv[2] || path.join(import.meta.dirname, 'src', 'routes');

// Strip comments ONLY. Never track quotes: an apostrophe in a string or comment
// ("don't") opens a phantom string and blanks the rest of the file (Run 83/86 trap).
// Replace with spaces so offsets and line numbers still map to the raw file.
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
    } else if (src[i] === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      while (i < stop) { out += src[i] === '\n' ? '\n' : ' '; i++; }
    } else {
      out += src[i];
      i++;
    }
  }
  if (out.length !== src.length) throw new Error('stripComments changed length — offsets would be wrong');
  return out;
}

// Scan forward from an open paren/brace, returning the index just past its match.
function matchDepth(src, start, open, close) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.js') && !e.name.startsWith('.qa-')) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);
const findings = [];
let routesSeen = 0;
let multiParam = 0;
let skipped = 0;

const ROUTE_RE = /\brouter\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*(['"`])([^'"`]*)\2/g;

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const code = stripComments(raw);
  const lineOf = (idx) => code.slice(0, idx).split('\n').length;

  ROUTE_RE.lastIndex = 0;
  let m;
  while ((m = ROUTE_RE.exec(code))) {
    routesSeen++;
    const method = m[1].toUpperCase();
    const routePath = m[3];
    const params = [...routePath.matchAll(/:([A-Za-z0-9_]+)/g)].map((x) => x[1]);
    if (params.length < 2) continue;
    multiParam++;

    // Handler body = everything from the route pattern to the close of router.<m>( ... )
    const openParen = code.indexOf('(', m.index + `router.${m[1]}`.length - 1);
    const closeParen = matchDepth(code, openParen, '(', ')');
    if (closeParen === -1) { skipped++; continue; }
    const body = code.slice(m.index + m[0].length, closeParen);

    // Whole-object pass-through — we cannot tell which keys the callee reads.
    if (/req\.params(?!\s*\.)(?!\s*\[)/.test(body)) {
      const usesWholeObject = /req\.params\s*[,)\]}]/.test(body);
      if (usesWholeObject) { skipped++; continue; }
    }

    const unread = [];
    for (const p of params) {
      const direct = new RegExp(`req\\.params\\s*\\.\\s*${p}\\b`).test(body);
      const bracket = new RegExp(`req\\.params\\s*\\[\\s*(['"\`])${p}\\1`).test(body);
      // Destructured: const { a, b: alias } = req.params
      let destructured = false;
      const destructRe = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*req\.params/g;
      let d;
      while ((d = destructRe.exec(body))) {
        const names = d[1].split(',').map((s) => s.split(':')[0].trim());
        if (names.includes(p)) destructured = true;
      }
      if (!direct && !bracket && !destructured) unread.push(p);
    }

    if (unread.length) {
      findings.push({
        file: path.relative(ROOT, file),
        line: lineOf(m.index),
        route: `${method} ${routePath}`,
        declared: params,
        unread,
      });
    }
  }
}

console.log(`routes scanned: ${routesSeen}   multi-param: ${multiParam}   skipped (req.params passthrough): ${skipped}`);
console.log(`findings: ${findings.length}\n`);
for (const f of findings) {
  console.log(`${f.file}:${f.line}  ${f.route}`);
  console.log(`    declared [${f.declared.join(', ')}]  NEVER READ: [${f.unread.join(', ')}]`);
}
