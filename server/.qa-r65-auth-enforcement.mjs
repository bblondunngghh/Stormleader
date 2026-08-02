// Run 65 — Axis A: auth enforcement.
// Every route hit with NO Authorization header must reject (401/403), never 200 and never 5xx.
// Uses a nonexistent-but-well-formed UUID for :id params so nothing real can be mutated.
import fs from 'fs';

const BASE = 'http://localhost:3001';
const FAKE_UUID = '00000000-0000-4000-8000-000000000000';
const routes = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

// Intentionally-public surfaces: auth entry points, inbound webhooks, customer-facing estimate links.
const PUBLIC_RE = [
  /^\/api\/auth\/(login|register|refresh|forgot-password|reset-password|verify)/,
  /^\/api\/webhooks/,
  /^\/api\/estimates\/public/,
  /^\/api\/onboarding\/(plans|signup)/,
  /^\/api\/health/,
];
const isPublic = (p) => PUBLIC_RE.some((re) => re.test(p));

const fill = (p) => p.replace(/:[A-Za-z0-9_]+/g, FAKE_UUID);

const results = [];
let checked = 0, ok = 0, leaked = 0, crashed = 0, skipped = 0;

for (const r of routes) {
  if (isPublic(r.path)) { skipped++; continue; }
  const url = BASE + fill(r.path);
  const init = { method: r.method, headers: {} };
  if (['POST', 'PUT', 'PATCH'].includes(r.method)) {
    init.headers['Content-Type'] = 'application/json';
    init.body = '{}';
  }
  let status, bodyText = '';
  try {
    const res = await fetch(url, init);
    status = res.status;
    bodyText = (await res.text()).slice(0, 200);
  } catch (e) {
    status = 'ERR';
    bodyText = String(e.message).slice(0, 200);
  }
  checked++;
  let verdict;
  if (status === 401 || status === 403) { verdict = 'OK'; ok++; }
  else if (typeof status === 'number' && status >= 500) { verdict = 'CRASH-5xx'; crashed++; }
  else if (typeof status === 'number' && status >= 200 && status < 300) { verdict = 'LEAK-unauthed-2xx'; leaked++; }
  else { verdict = `SUSPECT-${status}`; leaked++; }
  if (verdict !== 'OK') {
    results.push({ ...r, status, verdict, body: bodyText });
  }
}

console.log(`AXIS A — AUTH ENFORCEMENT`);
console.log(`checked=${checked}  correct-401/403=${ok}  unauthed-2xx=${leaked}  5xx=${crashed}  public-skipped=${skipped}`);
if (results.length) {
  console.log('\n--- NON-401 RESPONSES (candidate defects) ---');
  for (const x of results) console.log(`${x.verdict}\t${x.method}\t${x.path}\t[${x.file}]\t${x.body.replace(/\s+/g, ' ')}`);
} else {
  console.log('\nAll non-public routes correctly rejected unauthenticated requests.');
}
fs.writeFileSync('C:/tmp/r65-auth-enforcement.json', JSON.stringify(results, null, 1));
