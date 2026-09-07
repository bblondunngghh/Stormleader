// Read-only static sweep. Rationale (memory, Run 125-s2): divergent sibling payloads are
// the frontend's most productive defect class — the server whitelist skips `undefined`, so
// a field dropped by one of two sibling save paths is silent and still returns 200.
//
// client/src/api/*.js is a thin passthrough (`(data) => client.post(url, data)`), so the
// payload literals live at the CALL SITES of those exported helpers. This resolves the
// api layer to endpoints, then diffs every object literal handed to the same endpoint
// against its siblings.
import fs from 'fs';
import path from 'path';

const BS = String.fromCharCode(92);

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/[.]jsx?$/.test(e.name)) files.push(p);
  }
})('client/src');

function objectBody(s, start) {
  let depth = 0, i = start, str = null, esc = false;
  for (; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === BS) { esc = true; continue; }
    if (str) { if (c === str) str = null; continue; }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  return { body: s.slice(start + 1, i), end: i };
}

function topLevelKeys(body) {
  const parts = [];
  let depth = 0, str = null, esc = false, cur = '';
  for (let j = 0; j < body.length; j++) {
    const c = body[j];
    if (esc) { esc = false; cur += c; continue; }
    if (c === BS) { esc = true; cur += c; continue; }
    if (str) { cur += c; if (c === str) str = null; continue; }
    if (c === '"' || c === "'" || c === '`') { str = c; cur += c; continue; }
    if ('{[('.includes(c)) depth++;
    if ('}])'.includes(c)) depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  const keys = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (t.startsWith('...')) { keys.push(t.slice(0, 30).replace(/[\s\n]+/g, '')); continue; }
    const km = t.match(/^([A-Za-z_$][\w$]*)\s*(:|,|$)/);
    if (km) { keys.push(km[1]); continue; }
    const q = t.match(/^['"]([^'"]+)['"]\s*:/);
    if (q) keys.push(q[1]);
  }
  return keys;
}

// ---- 1. Resolve the api layer: exported helper name -> "VERB endpoint" -------------
const helperEndpoint = new Map();
for (const f of files) {
  if (!f.replace(/[\\]/g, '/').includes('client/src/api/')) continue;
  const s = fs.readFileSync(f, 'utf8');
  const re = /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*\(([^)]*)\)\s*=>\s*client[.](post|put|patch)[(]\s*(`[^`]*`|'[^']*'|"[^"]*")/g;
  let m;
  while ((m = re.exec(s))) {
    const url = m[4].slice(1, -1).replace(/[$][{][^}]*[}]/g, ':x');
    helperEndpoint.set(m[1], { verb: m[3], url, base: url.replace(/[/]:x$/, '') });
  }
}

// ---- 2. Collect every object literal passed to a resolved helper, or inline ---------
const calls = [];
for (const f of files) {
  const rel = f.replace(/[\\]/g, '/').replace('client/src/', '');
  if (rel.startsWith('api/')) continue; // the passthrough layer itself carries no payload
  const s = fs.readFileSync(f, 'utf8');

  for (const [fn, ep] of helperEndpoint) {
    const re = new RegExp('\\b' + fn + '\\s*[(]', 'g');
    let m;
    while ((m = re.exec(s))) {
      // Scan the argument list for the first top-level object literal.
      let i = m.index + m[0].length - 1, depth = 0, str = null, esc = false, objAt = -1;
      for (; i < s.length && i < m.index + 4000; i++) {
        const c = s[i];
        if (esc) { esc = false; continue; }
        if (c === BS) { esc = true; continue; }
        if (str) { if (c === str) str = null; continue; }
        if (c === '"' || c === "'" || c === '`') { str = c; continue; }
        if (c === '(' || c === '[') { depth++; continue; }
        if (c === ')' || c === ']') { depth--; if (depth === 0) break; continue; }
        if (c === '{' && depth === 1) { objAt = i; break; }
      }
      if (objAt < 0) continue;
      const keys = [...new Set(topLevelKeys(objectBody(s, objAt).body))].sort();
      if (keys.length < 2) continue;
      calls.push({ loc: rel + ':' + (s.slice(0, m.index).split('\n').length), fn, ...ep, keys });
    }
  }

  // Inline client.post/put/patch(url, { ... }) in a component.
  const re2 = /client[.](post|put|patch)[(]\s*(`[^`]*`|'[^']*'|"[^"]*")\s*,\s*[{]/g;
  let m2;
  while ((m2 = re2.exec(s))) {
    const at = m2.index + m2[0].length - 1;
    const keys = [...new Set(topLevelKeys(objectBody(s, at).body))].sort();
    if (keys.length < 2) continue;
    const url = m2[2].slice(1, -1).replace(/[$][{][^}]*[}]/g, ':x');
    calls.push({ loc: rel + ':' + (s.slice(0, m2.index).split('\n').length), fn: '(inline)', verb: m2[1], url, base: url.replace(/[/]:x$/, ''), keys });
  }
}

// ---- 3. Diff siblings that hit the same endpoint base -------------------------------
const groups = {};
for (const c of calls) (groups[c.base] ??= []).push(c);

const report = [];
for (const [base, cs] of Object.entries(groups)) {
  if (cs.length < 2) continue;
  const union = [...new Set(cs.flatMap((c) => c.keys))].sort();
  const rows = cs.map((c) => ({
    loc: c.loc, fn: c.fn, verb: c.verb, n: c.keys.length,
    missing: union.filter((k) => !c.keys.includes(k)),
  }));
  if (rows.some((r) => r.missing.length)) report.push({ base, unionSize: union.length, union, rows });
}
report.sort((a, b) => b.unionSize - a.unionSize);

console.log(JSON.stringify({
  helpers: helperEndpoint.size,
  payloadCalls: calls.length,
  groups: Object.keys(groups).length,
  divergent: report.length,
  report,
}, null, 1));
