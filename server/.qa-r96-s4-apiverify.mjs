// Run 96 / s4-verify — re-verify tonight's API fix commits against the LIVE server.
//
//   d49813c  /api/leads?needs_followup=true returned 400 for every tenant
//   db6c7d5  revert of 323bf72 — /api/crm/leads must still be healthy after the revert
//
// Read-only: every request is a GET. Prints a compact table.
import fs from 'node:fs';

const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const BASE = 'http://localhost:3001';

async function get(path) {
  const t0 = Date.now();
  const r = await fetch(BASE + path, { headers: { authorization: 'Bearer ' + TOKEN } });
  const ms = Date.now() - t0;
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, ms, body };
}

function shape(b) {
  if (b == null) return 'null';
  if (Array.isArray(b)) return `array(${b.length})`;
  const rows = b.leads || b.data || b.items;
  const parts = [];
  if (Array.isArray(rows)) parts.push(`rows=${rows.length}`);
  if (b.total !== undefined) parts.push(`total=${b.total}`);
  if (b.error) parts.push(`error=${JSON.stringify(b.error).slice(0, 80)}`);
  if (b.message && !b.error) parts.push(`message=${String(b.message).slice(0, 80)}`);
  return parts.length ? parts.join(' ') : Object.keys(b).slice(0, 6).join(',');
}

const CASES = [
  // --- d49813c: the fixed endpoint, plus the neighbours that share the code path
  ['d49813c', '/api/leads?needs_followup=true', 200],
  ['d49813c', '/api/leads?needs_followup=false', 200],
  ['d49813c', '/api/leads?needs_followup=1', 200],
  ['d49813c', '/api/leads?needs_followup=garbage', 200],
  ['d49813c', '/api/leads?needs_followup=true&limit=5', 200],
  ['d49813c', '/api/leads?needs_followup=true&stage=new', 200],
  ['d49813c', '/api/leads?needs_followup=true&unassigned=true', 200],
  ['baseline', '/api/leads', 200],
  ['baseline', '/api/leads?unassigned=true', 200],
  ['baseline', '/api/leads?stage=sold', 200],
  // --- db6c7d5: the reverted surface must still answer 200 and ignore the params
  ['db6c7d5', '/api/crm/leads', 200],
  ['db6c7d5', '/api/crm/leads?needs_followup=true', 200],
  ['db6c7d5', '/api/crm/leads?unassigned=true', 200],
  ['db6c7d5', '/api/crm/leads?stage=sold', 200],
  ['db6c7d5', '/api/crm/leads?search=a', 200],
];

let fails = 0;
console.log('COMMIT    STATUS  EXP  MS    PATH');
for (const [commit, path, expect] of CASES) {
  const r = await get(path);
  const ok = r.status === expect;
  if (!ok) fails++;
  console.log(
    `${commit.padEnd(9)} ${String(r.status).padEnd(6)} ${String(expect).padEnd(4)} ${String(r.ms).padEnd(5)} ${path}`
  );
  console.log(`          -> ${shape(r.body)}`);
}

// The revert's whole point: /crm/leads must return the SAME set with and without
// the params it no longer advertises. If the filter were still live the counts
// would differ.
const a = await get('/api/crm/leads');
const b = await get('/api/crm/leads?needs_followup=true&unassigned=true');
const ca = (a.body?.leads || a.body?.data || []).length;
const cb = (b.body?.leads || b.body?.data || []).length;
console.log(`\nREVERT CHECK  /crm/leads bare=${ca} rows, with-both-params=${cb} rows -> ${ca === cb ? 'IGNORED (revert intact)' : 'FILTERED (revert did NOT land)'}`);

// d49813c ground truth: the fixed predicate should match rows, not error.
const nf = await get('/api/leads?needs_followup=true');
const all = await get('/api/leads');
console.log(`NEEDS_FOLLOWUP  total=${nf.body?.total} of all total=${all.body?.total}`);

console.log(`\n${fails === 0 ? 'PASS' : 'FAIL'} — ${CASES.length - fails}/${CASES.length} status codes as expected`);
process.exit(fails === 0 ? 0 : 1);
