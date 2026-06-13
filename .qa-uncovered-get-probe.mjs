// Run 45 — hit every UNCOVERED GET route to surface unintentional 5xx.
// Read-only sweep: GET routes only, no writes. Substitutes sample params.
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:3001';
const loginRes = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
});
const loginBody = await loginRes.json();
const token = loginBody.accessToken || loginBody.token;
if (!token) { console.error('LOGIN FAILED', JSON.stringify(loginBody)); process.exit(1); }
const routes = JSON.parse(readFileSync('.qa-routes.json', 'utf8'));

// Reuse the same "uncovered" logic as .qa-coverage-check.mjs
const probeFiles = ['.qa-api-probe.mjs', '.qa-api-write-probe.mjs', '.qa-api-edge-probe.mjs', '.qa-hearth-fin.mjs', '.qa-patch-delete-probe.mjs', '.qa-uncovered-probe.mjs', '.qa-gaps-probe.mjs'];
const probeText = probeFiles.map(f => { try { return readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n');
function needle(r) {
  const parts = r.full.split('/');
  const lit = [];
  for (const p of parts) { if (p.startsWith(':')) break; lit.push(p); }
  return lit.join('/');
}

const SAMPLE_UUID = '3fa29df8-589c-44a6-ac4d-88cb78243cbe';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
function fill(path) {
  return path
    .replace(/:token/g, 'sampletoken123')
    .replace(/:stormEventId/g, '12345')
    .replace(/:propertyId/g, ZERO_UUID)
    .replace(/:jobId/g, ZERO_UUID)
    .replace(/:[a-zA-Z]+/g, SAMPLE_UUID);
}

const uncoveredGets = routes.filter(r => r.full && r.method === 'GET' && !probeText.includes(needle(r)));

const fivexx = [];
let ok = 0, intentional = 0;
for (const r of uncoveredGets) {
  const url = BASE + fill(r.full);
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.text();
    const tag = `${String(res.status).padEnd(3)} GET ${r.full}`;
    if (res.status >= 500) {
      // skip-trace 503 (no TRACERFY_API_KEY) is documented-intentional
      if (res.status === 503 && /TRACERFY_API_KEY|not configured/i.test(body)) { intentional++; console.log('   (intentional)', tag); }
      else { fivexx.push({ tag, body: body.slice(0, 300) }); console.log('!! ', tag, body.slice(0, 200)); }
    } else { ok++; console.log('   ', tag); }
  } catch (e) {
    fivexx.push({ tag: r.full, body: 'FETCH ERR ' + e.message });
    console.log('!! FETCH ERR', r.full, e.message);
  }
}

console.log(`\n=== ${uncoveredGets.length} uncovered GETs probed | ${ok} <500 | ${intentional} intentional 503 | ${fivexx.length} UNINTENTIONAL 5xx ===`);
if (fivexx.length) { console.log('\nUNINTENTIONAL 5xx:'); fivexx.forEach(f => console.log(f.tag, '\n  ', f.body)); }
