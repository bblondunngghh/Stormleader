// Run 74 s1 — master API sweep: GET + write + auth phases.
// Method (from Run 70): path params get a VALID-BUT-NONEXISTENT uuid, never a real id,
// so a PATCH can never null columns on a live row. Write bodies are empty ({}).
import fs from 'fs';

const BASE = 'http://localhost:3001';
const DEAD_UUID = '00000000-0000-4000-8000-000000000000';
const routes = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

// Permanently excluded: real money / outward effect / bulk cost (charter constraints).
const EXCLUDE = [
  // NB: use /import/ not /\/import/ — "trigger-import" has a HYPHEN before "import",
  // so a slash-anchored pattern misses it and starts a real bulk property import.
  /geocode/i, /import/i, /send-email/i, /\/send\b/i, /test-email/i,
  /\/payments\//i, /skip-trace/i, /plans\/sync/i, /\/charge/i, /\/refund/i,
];
const isExcluded = (p) => EXCLUDE.some((r) => r.test(p));

async function mint() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'waterlooconstruction1@gmail.com',
      password: '2Wealth&health',
      tenantSlug: 'waterloo',
    }),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error('mint failed: ' + JSON.stringify(j).slice(0, 200));
  return j.accessToken;
}

const fill = (p) => p.replace(/:[A-Za-z_]+/g, DEAD_UUID);

async function hit(method, path, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const ctl = AbortSignal.timeout(20000);
  try {
    const r = await fetch(BASE + path, {
      method, headers, signal: ctl,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    return { status: r.status, body: text.slice(0, 600) };
  } catch (e) {
    return { status: 0, body: 'FETCH_ERR ' + e.message };
  }
}

const results = { get: [], write: [], auth: [], excluded: [] };
let token = await mint();
let n = 0;
// DO NOT re-mint on a counter. POST /api/auth/login is rate-limited (5xx-free but
// "Too many login attempts, try again in 15 minutes" after ~10 tries), which locks
// the harness out mid-sweep. One token covers a phase; re-mint only on a real 401.
const tick = async () => { n++; };

// ---------- PHASE 1: GET sweep ----------
const gets = routes.filter((r) => r.method === 'GET');
for (const r of gets) {
  if (isExcluded(r.path)) { results.excluded.push({ ...r, phase: 'get' }); continue; }
  const res = await hit('GET', fill(r.path), token);
  results.get.push({ ...r, filled: fill(r.path), ...res });
  await tick();
}
console.log('PHASE1 GET done:', results.get.length);
fs.writeFileSync('C:/tmp/r74-sweep.json', JSON.stringify(results, null, 1));

// ---------- PHASE 2: write sweep (empty body) ----------
const writes = routes.filter((r) => r.method !== 'GET');
for (const r of writes) {
  if (isExcluded(r.path)) { results.excluded.push({ ...r, phase: 'write' }); continue; }
  const res = await hit(r.method, fill(r.path), token, {});
  results.write.push({ ...r, filled: fill(r.path), ...res });
  await tick();
}
console.log('PHASE2 WRITE done:', results.write.length);
fs.writeFileSync('C:/tmp/r74-sweep.json', JSON.stringify(results, null, 1));

// ---------- PHASE 3: auth sweep (no credentials at all) ----------
for (const r of routes) {
  if (isExcluded(r.path)) continue;
  const res = await hit(r.method, fill(r.path), null, r.method === 'GET' ? undefined : {});
  results.auth.push({ ...r, status: res.status, body: res.body.slice(0, 160) });
}
console.log('PHASE3 AUTH done:', results.auth.length);

fs.writeFileSync('C:/tmp/r74-sweep.json', JSON.stringify(results, null, 1));

const tally = (arr) => arr.reduce((a, x) => { const k = String(x.status)[0] + 'xx'; a[k] = (a[k] || 0) + 1; return a; }, {});
console.log('GET  tally:', JSON.stringify(tally(results.get)));
console.log('WRITE tally:', JSON.stringify(tally(results.write)));
console.log('AUTH tally:', JSON.stringify(tally(results.auth)));
console.log('EXCLUDED:', results.excluded.length, [...new Set(results.excluded.map(e => e.path))].join(' | '));
console.log('--- 5xx GET ---');
results.get.filter(r => r.status >= 500 || r.status === 0).forEach(r => console.log(r.status, r.method, r.path, r.body.slice(0, 200)));
console.log('--- 5xx WRITE ---');
results.write.filter(r => r.status >= 500 || r.status === 0).forEach(r => console.log(r.status, r.method, r.path, r.body.slice(0, 200)));
console.log('--- AUTH LEAKS (2xx with no creds) ---');
results.auth.filter(r => r.status >= 200 && r.status < 300).forEach(r => console.log(r.status, r.method, r.path));
