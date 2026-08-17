// Run 77 s1 — SET DIFFERENCE #3 (static half): fields the CLIENT sends on an update
// vs the server's `allowedFields` whitelist for that entity.
//
// The user-visible failure this hunts: you edit a field, hit Save, the request 200s, the
// modal closes — and the value silently reverts on reload, because the server dropped it.
// Run 74's `8a45209` was one instance of this family, found by hand. This enumerates it.
//
// STRUCTURALLY UNABLE TO FIND: fields renamed in transit (client `dueDate` -> API layer
// maps to `due_date`), and fields the whitelist accepts but the SQL then ignores.
// Runtime confirmation (.qa-r77-wlprobe.mjs) settles every candidate.
import fs from 'fs';
import path from 'path';

// ---------- server side: entity -> allowed field set ----------
const sdir = 'server/src/services';
const whitelists = {};
for (const f of fs.readdirSync(sdir).filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(sdir, f), 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (!/const allowedFields\s*=/.test(line)) return;
    // grab until the closing bracket
    let buf = line;
    for (let j = i + 1; j < lines.length && !buf.includes(']'); j++) buf += '\n' + lines[j];
    const inner = buf.slice(buf.indexOf('[') + 1, buf.indexOf(']'));
    const fields = [...inner.matchAll(/['"`]([\w]+)['"`]/g)].map((m) => m[1]);
    // which exported function is this inside?
    let fn = '?';
    for (let j = i; j >= 0; j--) {
      const m = lines[j].match(/export async function (\w+)/);
      if (m) { fn = m[1]; break; }
    }
    whitelists[`${f}:${fn}`] = { file: f, fn, line: i + 1, fields };
  });
}

// ---------- client side: keys sent in update payloads ----------
const cdirs = ['client/src/components', 'client/src/pages', 'client/src/api'];
const clientFiles = [];
function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.jsx?$/.test(e.name)) clientFiles.push(p);
  }
}
cdirs.forEach(walk);

// find update call sites and the object literal passed as the payload
const calls = [];
for (const p of clientFiles) {
  const src = fs.readFileSync(p, 'utf8');
  const re = /(update|patch|save|edit)\w*\s*\(\s*[^,()]*,\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*\)/gi;
  for (const m of src.matchAll(re)) {
    const keys = [...m[2].matchAll(/(?:^|[,{\s])([A-Za-z_$][\w$]*)\s*:/g)].map((k) => k[1]);
    if (keys.length) {
      const lineNo = src.slice(0, m.index).split('\n').length;
      calls.push({ file: p.replace(/\\/g, '/'), line: lineNo, fn: m[1], keys: [...new Set(keys)] });
    }
  }
}

console.log('=== SERVER UPDATE WHITELISTS ===');
for (const [k, v] of Object.entries(whitelists)) {
  console.log(`  ${k} (line ${v.line}): ${v.fields.join(', ')}`);
}

// union of everything any whitelist permits — a client key absent from EVERY whitelist
// is the strongest candidate (it cannot be a mis-attribution to the wrong entity)
const union = new Set(Object.values(whitelists).flatMap((w) => w.fields));
const suspect = [];
for (const c of calls) {
  const miss = c.keys.filter((k) => !union.has(k));
  if (miss.length) suspect.push({ ...c, miss });
}

console.log('\n=== CLIENT UPDATE PAYLOAD KEYS ABSENT FROM EVERY SERVER WHITELIST ===');
console.log('(candidates only — many are local state objects, not API payloads)');
suspect.forEach((s) => console.log(`  ${s.file}:${s.line}  ${s.fn}(...)  missing: ${s.miss.join(', ')}`));

fs.writeFileSync('C:/tmp/qa-r77-whitelist.json', JSON.stringify({ whitelists, calls, suspect }, null, 1));
console.log(`\nwhitelists: ${Object.keys(whitelists).length}  client update call sites: ${calls.length}  with unknown keys: ${suspect.length}`);
