/**
 * Run 105 (s2 frontend-test) — patch the 7 `res.data.X || res.data || []` list
 * setters so the fallback is required to BE an array.
 *
 * Why: `X || res.data || []` degrades a missing/null key into the WHOLE response
 * object, which is truthy and not an array. Every consumer then calls
 * .filter()/.map()/.length on it and throws, blanking the entire SPA (there is no
 * error boundary). Proven live on /contracts: a 200 body of `{}` or
 * `{contracts:null}` gives `contracts.filter is not a function` and body.innerText
 * drops to 0 chars. The app's own convention at 6 other list setters is
 * `res.data.X || []`, which cannot do this.
 *
 * All-or-nothing: if any pattern misses, nothing is written (Run 98 rule).
 * Run with --check to report without writing.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.argv[2] || 'C:/Projects/stormleads/client/src/components';
const CHECK = process.argv.includes('--check');

// [file, exact source substring, replacement]
const EDITS = [
  ['ContractsView.jsx',
    'setContracts(res.data.contracts || res.data || []);',
    'setContracts(Array.isArray(res.data.contracts) ? res.data.contracts : Array.isArray(res.data) ? res.data : []);'],
  ['ContractsView.jsx',
    'const tpls = res.data.templates || res.data || [];',
    'const tpls = Array.isArray(res.data.templates) ? res.data.templates : Array.isArray(res.data) ? res.data : [];'],
  ['ContractsView.jsx',
    'setLeadResults(res.data.leads || res.data || []);',
    'setLeadResults(Array.isArray(res.data.leads) ? res.data.leads : Array.isArray(res.data) ? res.data : []);'],
  ['LeadDetail.jsx',
    '.then(res => setLeadContracts(res.data.contracts || res.data || []))',
    '.then(res => setLeadContracts(Array.isArray(res.data.contracts) ? res.data.contracts : Array.isArray(res.data) ? res.data : []))'],
  ['SettingsView.jsx',
    '.then(res => setPrefs(res.data.preferences || res.data || []))',
    '.then(res => setPrefs(Array.isArray(res.data.preferences) ? res.data.preferences : Array.isArray(res.data) ? res.data : []))'],
  ['SettingsView.jsx',
    '.then(res => setTemplates(res.data.templates || res.data || []))',
    '.then(res => setTemplates(Array.isArray(res.data.templates) ? res.data.templates : Array.isArray(res.data) ? res.data : []))'],
  ['WorkOrdersView.jsx',
    '.then(res => setEstimates(res.data?.estimates || res.data || []))',
    '.then(res => setEstimates(Array.isArray(res.data?.estimates) ? res.data.estimates : Array.isArray(res.data) ? res.data : []))'],
];

const files = new Map();
const report = [];
let misses = 0;

for (const [file, from, to] of EDITS) {
  const p = path.join(ROOT, file);
  if (!files.has(p)) files.set(p, fs.readFileSync(p, 'utf8'));
  let src = files.get(p);
  const n = src.split(from).length - 1;
  if (n !== 1) {
    misses++;
    report.push({ file, occurrences: n, status: 'MISS', from: from.slice(0, 50) });
    continue;
  }
  files.set(p, src.replace(from, to));
  report.push({ file, occurrences: n, status: 'OK', from: from.slice(0, 50) });
}

console.log(JSON.stringify(report, null, 2));

if (misses > 0) {
  console.log(`ABORT: ${misses} pattern(s) missed, nothing written.`);
  process.exit(1);
}
if (CHECK) {
  console.log('CHECK ONLY: 7/7 patterns matched, nothing written.');
  process.exit(0);
}
for (const [p, src] of files) fs.writeFileSync(p, src);
console.log(`WROTE ${files.size} files, ${EDITS.length} edits.`);
