// Run 128 (s2-frontend-test) — SIBLING SAVE-PAYLOAD DIVERGENCE
//
// Run 126's two frontend defects shared one root cause: two code paths in the SAME file
// build a payload for the SAME entity, and one of them silently omits fields the other
// sends. The server whitelist skips `undefined`, so the drop is invisible — the request
// still returns 200/201.
//
// So the productive diff is payload-literal vs SIBLING payload-literal, not payload vs
// server whitelist. This harness extracts every object literal handed to a write call
// (client.post/put/patch, or `<ns>Api.create*/update*/save*`), groups them by
// (file, entity) and reports key-set differences between siblings.
//
// Read-only. `node .qa-r128-s2-payloaddiff.mjs <walkRoot>`; `--selftest` plants a known
// positive and asserts the diff rediscovers it.
import fs from 'fs';
import path from 'path';

const ROOT = process.argv[2] || 'C:/Projects/stormleads/client/src';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

// Strip comments ONLY (Run 86: never track quotes across JSX text), blanking with spaces
// so offsets and line numbers stay aligned with the raw source.
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
      a[i] = ' '; a[i + 1] = ' '; i += 2;
    } else i++;
  }
  return a.join('');
}

// Scan a balanced {...} starting at `start` (which must be the '{'), skipping string and
// template literals so a brace inside a string does not unbalance the scan.
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

// Top-level keys of an object-literal source string.
function topKeys(objSrc) {
  const body = objSrc.slice(1, -1);
  const keys = [];
  let depth = 0, q = null, tok = '';
  const flush = () => {
    const t = tok.trim();
    tok = '';
    if (!t) return;
    if (t.startsWith('...')) { keys.push(t.replace(/[^\w.$]/g, '').slice(0, 40) + ' (spread)'); return; }
    const m = t.match(/^(?:\[[^\]]*\]|'([^']*)'|"([^"]*)"|([A-Za-z_$][\w$]*))\s*[:,]?/);
    if (m) keys.push(m[1] || m[2] || m[3] || t.slice(0, 24));
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
  return keys;
}

// A write call: client.post/put/patch(url, <obj>) or <x>Api.createFoo(..., <obj>)
const CALL = /(?:\bclient\.(post|put|patch)\s*\(|\b([A-Za-z_$][\w$]*Api)\.([A-Za-z_$][\w$]*)\s*\(|\b(create|update|save|send|add)([A-Z][\w$]*)\s*\()/g;

function entityOf(file, m) {
  // normalise to a coarse entity name so create/update siblings land in the same bucket
  const name = (m.method || m.fn || '').replace(/^(create|update|save|send|add|patch|post|put)/i, '');
  const ns = (m.ns || '').replace(/Api$/, '');
  const base = (name || ns || path.basename(file, path.extname(file)))
    .replace(/(Draft|Detail|Item|s)$/i, '')
    .toLowerCase();
  return base || 'unknown';
}

// The Run 126 defect was `const payload = {...}` on one line and the write call on the
// next, so an args-only extractor scores it clean. Mode 2 catches the named-variable form:
// an object literal bound to a payload-ish name, bucketed by the write call that consumes
// that name shortly after.
const ASSIGN = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;
const PAYLOAD_NAME = /^(payload|body|data|dto|updates|patch|form|fields|values|newE?[A-Z]?\w*)$/i;

function namedPayloads(f, src, buckets) {
  let m;
  ASSIGN.lastIndex = 0;
  while ((m = ASSIGN.exec(src))) {
    const name = m[1];
    if (!PAYLOAD_NAME.test(name)) continue;
    const objStart = m.index + m[0].length - 1;
    const obj = scanObject(src, objStart);
    if (!obj) continue;
    const keys = topKeys(obj);
    if (keys.length < 2) continue;
    // find the write call that consumes this variable within the next 3000 chars
    const after = src.slice(objStart + obj.length, objStart + obj.length + 3000);
    const use = new RegExp(
      `(?:client\\.(post|put|patch)|([A-Za-z_$][\\w$]*Api)\\.([A-Za-z_$][\\w$]*)|\\b(create|update|save|send|add)([A-Z][\\w$]*))\\s*\\([^)]*\\b${name}\\b`
    ).exec(after);
    if (!use) continue;
    const info = {
      file: path.relative(ROOT, f).replace(/\\/g, '/'),
      line: src.slice(0, objStart).split('\n').length,
      verb: use[1] || use[3] || (use[4] ? use[4] + use[5] : ''),
      ns: use[2] || '',
      method: use[3] || '',
      fn: use[4] ? use[4] + use[5] : '',
      keys,
      via: 'named:' + name,
    };
    const key = info.file + '::' + entityOf(f, info);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(info);
  }
}

function analyse(files) {
  const buckets = new Map();
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const src = stripComments(raw);
    namedPayloads(f, src, buckets);
    let m;
    CALL.lastIndex = 0;
    while ((m = CALL.exec(src))) {
      const callEnd = m.index + m[0].length;
      // find the object literal among the arguments (first '{' at arg depth 0)
      let i = callEnd, depth = 0, q = null, objStart = -1;
      while (i < src.length && i < callEnd + 4000) {
        const c = src[i];
        if (q) { if (c === '\\') i++; else if (c === q) q = null; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { q = c; i++; continue; }
        if (c === '(' || c === '[') depth++;
        if (c === ')' || c === ']') { if (depth === 0) break; depth--; }
        if (c === '{' && depth === 0) { objStart = i; break; }
        i++;
      }
      if (objStart === -1) continue;
      const obj = scanObject(src, objStart);
      if (!obj) continue;
      const keys = topKeys(obj);
      if (keys.length < 2) continue;
      const line = src.slice(0, objStart).split('\n').length;
      const info = {
        file: path.relative(ROOT, f).replace(/\\/g, '/'),
        line,
        verb: m[1] || m[3] || (m[4] ? m[4] + m[5] : ''),
        ns: m[2] || '',
        method: m[3] || '',
        fn: m[4] ? m[4] + m[5] : '',
        keys,
      };
      const key = info.file + '::' + entityOf(f, info);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(info);
    }
  }

  const findings = [];
  for (const [key, sites] of buckets) {
    if (sites.length < 2) continue;
    const union = new Set();
    sites.forEach(s => s.keys.forEach(k => union.add(k)));
    // a site is interesting if it is missing keys every OTHER sibling has
    for (const s of sites) {
      const own = new Set(s.keys);
      const missingFromAllOthers = [...union].filter(k => !own.has(k) && sites.every(o => o === s || o.keys.includes(k)));
      if (missingFromAllOthers.length) {
        findings.push({
          bucket: key,
          site: `${s.file}:${s.line}`,
          via: s.verb || s.method || s.fn,
          has: s.keys.length,
          missing: missingFromAllOthers,
          siblings: sites.filter(o => o !== s).map(o => `${o.file}:${o.line}(${o.keys.length})`),
        });
      }
    }
  }
  return { bucketCount: buckets.size, findings };
}

if (process.argv.includes('--selftest')) {
  const dir = 'C:/tmp/qa-r128-selftest';
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // Positive: two sibling create payloads, the second drops notes + terms.
  fs.writeFileSync(path.join(dir, 'Positive.jsx'), [
    'const a = () => estimatesApi.createEstimate({ lead_id: id, title: t, notes: n, terms: tm, line_items: li });',
    'const b = () => estimatesApi.createEstimate({ lead_id: id, title: t, line_items: li });',
  ].join('\n'));
  // Positive 2: the real Run 126 (a380a7a) shape — `const payload = {...}` bound to a name,
  // consumed by the write call on a following line. An args-only extractor scores it clean.
  fs.writeFileSync(path.join(dir, 'Named.jsx'), [
    'function A(){ const payload = { ...form, discounts, signers, profit_margin: pm, footer_notes: fn, financing_enabled: fe, upgrades, deposit: d };',
    '  return estimatesApi.updateEstimate(id, payload); }',
    'function B(){ const payload = { ...form, discounts, signers, profit_margin: pm, footer_notes: fn };',
    '  return estimatesApi.updateEstimate(id, payload); }',
  ].join('\n'));
  // Negative: identical key sets.
  fs.writeFileSync(path.join(dir, 'Negative.jsx'), [
    'const a = () => tasksApi.createTask({ title: t, due_date: d });',
    'const b = () => tasksApi.createTask({ title: t2, due_date: d2 });',
  ].join('\n'));
  const r = analyse(walk(dir));
  const hitPos = r.findings.some(f => f.site.includes('Positive') && f.missing.includes('notes') && f.missing.includes('terms'));
  const hitNamed = r.findings.some(f => f.site.includes('Named') && f.missing.includes('financing_enabled') && f.missing.includes('upgrades'));
  const hitNeg = r.findings.some(f => f.site.includes('Negative'));
  console.log('SELFTEST inline positive:', hitPos, '| named positive:', hitNamed, '| negative silent:', !hitNeg);
  console.log(JSON.stringify(r.findings, null, 1));
  process.exit(hitPos && hitNamed && !hitNeg ? 0 : 1);
}

const files = walk(ROOT);
const r = analyse(files);
console.log(`files=${files.length} buckets=${r.bucketCount} findings=${r.findings.length}`);
for (const f of r.findings) {
  console.log(`\n[${f.bucket}]\n  ${f.site} via ${f.via} (${f.has} keys)\n  MISSING: ${f.missing.join(', ')}\n  siblings: ${f.siblings.join(', ')}`);
}
