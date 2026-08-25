// Run 95 (s2-frontend-test) — cross-entity key set difference.
//
// Both defects found tonight had the SAME shape: JSX iterating one entity's
// collection while reading a key that belongs to a DIFFERENT entity.
//   WorkOrdersView.jsx:805  estimates.map(est => est.title)        <- workOrders key
//   WorkOrdersView.jsx:806  estimates.map(est => est.contact_name) <- invoices/WO key
// A UNION-of-all-keys check cannot see either one, because both names are
// legitimate keys somewhere else. So resolve the loop variable to ITS OWN
// collection and diff against only that entity's real payload keys.
//
// Usage:  node .qa-r95-loopkeys.mjs [walkRoot] [--selftest]
// --selftest points the walk at C:/tmp/qa-r95-selftest, which should hold the
// PRE-FIX WorkOrdersView.jsx (git show HEAD~2:...). A zero there means the
// harness is broken, not that the code is clean.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEYS = JSON.parse(fs.readFileSync(path.join(__dirname, '.qa-r95-entitykeys.json'), 'utf8'));

const selftest = process.argv.includes('--selftest');
const walkRoot = selftest
  ? 'C:/tmp/qa-r95-selftest'
  : (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'C:/Projects/stormleads/client/src');

// Collection identifiers that resolve to an entity key set. The left side is
// what the JSX actually iterates; several views hold the same rows under a
// local name.
const COLLECTION = {
  estimates: 'estimates', filteredEstimates: 'estimates', sortedEstimates: 'estimates',
  leads: 'leads', filteredLeads: 'leads', sortedLeads: 'leads', leadResults: 'leads', searchResults: 'leads',
  invoices: 'invoices', filteredInvoices: 'invoices',
  workOrders: 'workOrders', filteredWorkOrders: 'workOrders',
  contracts: 'contracts', filteredContracts: 'contracts',
  expenses: 'expenses', filteredExpenses: 'expenses',
  subcontractors: 'subcontractors', filteredSubs: 'subcontractors', subs: 'subcontractors',
  templates: 'templates', contractTemplates: 'templates',
  customFields: 'customFields',
};

// Strip COMMENTS ONLY. Never track quotes: JSX text apostrophes ("you're all
// clear", "Don't") open a phantom string and blank the rest of the file, which
// manufactures confident false positives (Run 83 / Run 86, 20 of 27 findings).
// Blank with spaces and keep newlines so offsets still map to the raw file.
function stripComments(src) {
  let out = src.split('');
  let i = 0;
  while (i < src.length - 1) {
    // `:` before `//` means a URL (https://...), not a line comment. Blanking
    // there would delete real code sharing the line.
    if (src[i] === '/' && src[i + 1] === '/' && src[i - 1] !== ':') {
      let j = i; while (j < src.length && src[j] !== '\n') { out[j] = ' '; j++; }
      i = j;
    } else if (src[i] === '/' && src[i + 1] === '*') {
      let j = i; while (j < src.length - 1 && !(src[j] === '*' && src[j + 1] === '/')) { if (src[j] !== '\n') out[j] = ' '; j++; }
      // stay in bounds: an unterminated block comment ends at the last index,
      // and writing out[j+1] there would GROW the array and drift every offset.
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

// Find the body of `<collection>.map(<v> => ... )` by brace/paren depth so an
// inner arrow function does not truncate the region (Run 86 trap #2).
function mapBodies(code) {
  const found = [];
  const re = /\b(\w+)\s*\.\s*map\s*\(\s*\(?\s*(\w+)\s*(?:,\s*\w+\s*)?\)?\s*=>/g;
  let m;
  while ((m = re.exec(code))) {
    const [, coll, v] = m;
    if (!COLLECTION[coll]) continue;
    let depth = 0, i = re.lastIndex, start = i;
    for (; i < code.length; i++) {
      const c = code[i];
      if (c === '(' || c === '{' || c === '[') depth++;
      else if (c === ')' || c === '}' || c === ']') { if (depth === 0) break; depth--; }
    }
    found.push({ coll, entity: COLLECTION[coll], v, body: code.slice(start, i), offset: start });
  }
  return found;
}

const files = walk(walkRoot);
const findings = [];

for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const code = stripComments(raw);
  for (const b of mapBodies(code)) {
    const valid = new Set(KEYS[b.entity] || []);
    if (!valid.size) continue;
    // snake_case member reads on the loop variable only
    const re = new RegExp('\\b' + b.v + '\\s*\\.\\s*([a-z][a-z0-9]*(?:_[a-z0-9]+)+|title|name|total|status|content|address|category|amount|company|phone|email|specialty|notes|date|options|type)\\b', 'g');
    const seen = new Set();
    let m;
    while ((m = re.exec(b.body))) {
      const key = m[1];
      if (valid.has(key) || seen.has(key)) continue;
      seen.add(key);
      const line = code.slice(0, b.offset + m.index).split('\n').length;
      findings.push({
        file: path.relative(walkRoot, f).replace(/\\/g, '/'),
        line, coll: b.coll, entity: b.entity, read: `${b.v}.${key}`,
        src: raw.split('\n')[line - 1].trim().slice(0, 110)
      });
    }
  }
}

console.log(`walkRoot: ${walkRoot}`);
console.log(`files scanned: ${files.length}`);
console.log(`findings: ${findings.length}`);
for (const f of findings) {
  console.log(`\n  ${f.file}:${f.line}  ${f.read}   [iterates ${f.coll} -> ${f.entity}]`);
  console.log(`    ${f.src}`);
}
if (selftest) {
  const hitTitle = findings.some(f => f.read.endsWith('.title'));
  const hitContact = findings.some(f => f.read.endsWith('.contact_name'));
  console.log(`\nSELFTEST: est.title=${hitTitle ? 'CAUGHT' : 'MISSED'}  est.contact_name=${hitContact ? 'CAUGHT' : 'MISSED'}`);
  process.exit(hitTitle && hitContact ? 0 : 1);
}
