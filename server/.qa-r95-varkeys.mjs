// Run 95 (s2-frontend-test) — CHECK B: single-object entity reads.
//
// The loop-variable check (.qa-r95-loopkeys.mjs) only sees `coll.map(v => v.key)`.
// Tonight's FIRST defect was not in a loop at all:
//   ContractsView.jsx:305  client.get(`/estimates/${id}`).then(res => { const est = res.data;
//                          setCustomerEmail(est.customer_email || '')  <- dropped est.lead_email
// So resolve by VARIABLE NAME instead, and diff every snake_case read on those
// names against that entity's real payload keys.
//
// This side over-reports by construction (a variable named `lead` may be a
// locally-built object, not an API row), so every hit needs a source grep before
// it is filed. Over-reporting is the safe direction: it can only invent hits,
// never hide one.
//
// Usage: node .qa-r95-varkeys.mjs [walkRoot] [--selftest]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEYS = JSON.parse(fs.readFileSync(path.join(__dirname, '.qa-r95-entitykeys.json'), 'utf8'));

const selftest = process.argv.includes('--selftest');
const walkRoot = selftest
  ? 'C:/tmp/qa-r95-selftest'
  : (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'C:/Projects/stormleads/client/src');

const VAR = {
  est: 'estimates', estimate: 'estimates',
  lead: 'leads',
  inv: 'invoices', invoice: 'invoices',
  wo: 'workOrders', workOrder: 'workOrders',
  contract: 'contracts',
};

function stripComments(src) {
  const out = src.split('');
  let i = 0;
  while (i < src.length - 1) {
    if (src[i] === '/' && src[i + 1] === '/' && src[i - 1] !== ':') {
      let j = i; while (j < src.length && src[j] !== '\n') { out[j] = ' '; j++; }
      i = j;
    } else if (src[i] === '/' && src[i + 1] === '*') {
      let j = i; while (j < src.length - 1 && !(src[j] === '*' && src[j + 1] === '/')) { if (src[j] !== '\n') out[j] = ' '; j++; }
      if (j < src.length) out[j] = ' ';
      if (j + 1 < src.length) out[j + 1] = ' ';
      i = j + 2;
    } else i++;
  }
  const res = out.join('');
  if (res.length !== src.length) throw new Error('offset drift');
  return res;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.jsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const findings = [];
const files = walk(walkRoot);

for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const code = stripComments(raw);
  const lines = raw.split('\n');
  for (const [v, entity] of Object.entries(VAR)) {
    const valid = new Set(KEYS[entity] || []);
    if (!valid.size) continue;
    // snake_case only: API fields are snake_case while JS/DOM/React APIs are
    // camelCase, which makes it the ideal filter (documented Run 79 finding).
    const re = new RegExp('(?<![\\w$.])' + v + '\\s*\\.\\s*([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\\b', 'g');
    let m;
    const seen = new Set();
    while ((m = re.exec(code))) {
      const key = m[1];
      if (valid.has(key)) continue;
      const line = code.slice(0, m.index).split('\n').length;
      const sig = `${f}:${key}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      findings.push({
        file: path.relative(walkRoot, f).replace(/\\/g, '/'),
        line, read: `${v}.${key}`, entity,
        src: (lines[line - 1] || '').trim().slice(0, 110)
      });
    }
  }
}

console.log(`walkRoot: ${walkRoot}`);
console.log(`files: ${files.length}   findings: ${findings.length}`);
for (const f of findings) {
  console.log(`\n  ${f.file}:${f.line}  ${f.read}   [${f.entity}]`);
  console.log(`    ${f.src}`);
}
if (selftest) {
  const caught = findings.some(f => f.read === 'est.lead_email') && findings.some(f => f.read === 'est.lead_phone');
  console.log(`\nSELFTEST (expects est.lead_email/est.lead_phone ABSENT from the pre-fix file): ${caught ? 'unexpected' : 'n/a'}`);
}
