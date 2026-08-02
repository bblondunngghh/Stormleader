// Run 65 s4-verify — independent re-verification of 9c6eb2f + df5d1ce.
// Writes at most 2 rows and deletes both. Rolls back all SQL-syntax probes.
import pool from './src/db/pool.js';

const MINE  = '791bb51d-3293-4839-92e9-bd4d4f873af2'; // waterloo (the logged-in tenant)
const OTHER = 'e3961fce-802b-4c68-99c0-1f52bcaabe20'; // waterloo-roofco
const BASE  = `http://localhost:${process.env.QA_PORT || 3001}/api`;
let pass = 0, fail = 0;
const ok  = (n, d) => { pass++; console.log(`PASS  ${n}${d ? '  — ' + d : ''}`); };
const bad = (n, d) => { fail++; console.log(`FAIL  ${n}${d ? '  — ' + d : ''}`); };

const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
})).json();
const H = { Authorization: `Bearer ${login.accessToken}` };

// ============ FIX 9c6eb2f — the two UPDATE statements ============
console.log('\n=== 9c6eb2f  MySQL-only ORDER BY/LIMIT on UPDATE ===');
const c = await pool.connect();
try {
  await c.query('BEGIN');
  // A. the ORIGINAL forms must still be rejected — proves the probe is meaningful
  for (const [name, sql, params] of [
    ['routes/skipTrace.js:120 PRE-FIX', `UPDATE skip_trace_usage SET job_id = $1 WHERE tenant_id = $2 AND job_id IS NULL ORDER BY created_at DESC LIMIT 1`, ['x', MINE]],
    ['services/skipTraceService.js:182 PRE-FIX', `UPDATE skip_trace_usage SET records_returned = $1 WHERE tenant_id = $2 AND provider = 'tracerfy' ORDER BY created_at DESC LIMIT 1`, [5, MINE]],
  ]) {
    try { await c.query(sql, params); bad(`${name} unexpectedly ACCEPTED`); }
    catch (e) { await c.query('ROLLBACK'); await c.query('BEGIN');
      e.code === '42601' ? ok(`${name} rejected 42601`, e.message.slice(0, 50)) : bad(name, `${e.code} ${e.message}`); }
  }
  // B. the SHIPPED forms, read verbatim off disk, must execute
  const fs = await import('fs');
  const routeSrc = fs.readFileSync('./src/routes/skipTrace.js', 'utf8');
  const svcSrc   = fs.readFileSync('./src/services/skipTraceService.js', 'utf8');
  const grab = (src, anchor) => {
    const i = src.indexOf(anchor); const s = src.lastIndexOf('`', i); const e = src.indexOf('`', i);
    return src.slice(s + 1, e);
  };
  const sqlA = grab(routeSrc, 'UPDATE skip_trace_usage SET job_id');
  const sqlB = grab(svcSrc, 'SET records_returned');
  for (const [name, sql, params] of [
    ['routes/skipTrace.js SHIPPED', sqlA, ['s4-probe', MINE]],
    ['services/skipTraceService.js SHIPPED', sqlB, [5, MINE]],
  ]) {
    try { const r = await c.query(sql, params); ok(`${name} executes`, `rowCount=${r.rowCount} (<=1 by LIMIT 1 subquery)`); }
    catch (e) { bad(name, `${e.code} ${e.message}`); }
  }
  await c.query('ROLLBACK');
  console.log('  (all syntax probes ROLLED BACK — 0 rows persisted)');
} finally { c.release(); }

// ============ FIX df5d1ce — tenant scoping of GET /skip-trace/job/:jobId ============
console.log('\n=== df5d1ce  GET /skip-trace/job/:jobId tenant scope ===');
const OWNED   = '11111111-2222-4333-8444-555555555555';
const FOREIGN = '99999999-8888-4777-8666-555555555555';
const get = async (path, headers) => {
  const r = await fetch(`${BASE}${path}`, { headers });
  let b; try { b = await r.json(); } catch { b = null; }
  return { s: r.status, b };
};

// 1. unauthenticated still blocked
let r = await get(`/skip-trace/job/${OWNED}`, {});
r.s === 401 ? ok('unauthenticated -> 401') : bad('unauthenticated', `got ${r.s}`);

// 2. job the tenant does not own -> 404, NOT proxied
r = await get(`/skip-trace/job/${FOREIGN}`, H);
r.s === 404 && r.b?.error === 'Job not found'
  ? ok('unowned job -> 404 "Job not found" (no proxy)')
  : bad('unowned job', `got ${r.s} ${JSON.stringify(r.b)}`);

// 3. malformed (pre-existing validateId guard) -> 400
r = await get('/skip-trace/job/not-a-uuid', H);
r.s === 400 ? ok('malformed jobId -> 400 (validateId, predates fix)') : bad('malformed jobId', `got ${r.s}`);

// 4. THE CROSS-TENANT LEAK: same job id owned by ANOTHER tenant -> must still 404
await pool.query(
  `INSERT INTO skip_trace_usage (tenant_id, provider, records_requested, cost_cents, job_id)
   VALUES ($1,'tracerfy',1,15,$2)`, [OTHER, FOREIGN]);
r = await get(`/skip-trace/job/${FOREIGN}`, H);
r.s === 404 ? ok('job owned by OTHER tenant -> 404 (leak closed)') : bad('CROSS-TENANT LEAK', `got ${r.s} ${JSON.stringify(r.b)}`);

// 5. the gate must NOT block a legitimate owner — must fall through to the proxy
await pool.query(
  `INSERT INTO skip_trace_usage (tenant_id, provider, records_requested, cost_cents, job_id)
   VALUES ($1,'tracerfy',1,15,$2)`, [MINE, OWNED]);
r = await get(`/skip-trace/job/${OWNED}`, H);
r.s === 503 ? ok('OWNED job passes gate -> 503 (no TRACERFY_API_KEY = reached proxy)')
            : bad('owner blocked by gate', `expected 503 (proxy reached), got ${r.s} ${JSON.stringify(r.b)}`);

// 6. sibling routes unaffected
for (const p of ['/skip-trace/config', '/skip-trace/balance', '/skip-trace/usage']) {
  r = await get(p, H);
  r.s === 200 ? ok(`sibling ${p} -> 200`) : bad(`sibling ${p}`, `got ${r.s}`);
}

// cleanup — remove BOTH probe rows
const del = await pool.query('DELETE FROM skip_trace_usage WHERE job_id = ANY($1)', [[OWNED, FOREIGN]]);
console.log(`\nCLEANUP: deleted ${del.rowCount} probe rows (expected 2)`);
const left = await pool.query('SELECT COUNT(*)::int n FROM skip_trace_usage');
console.log(`skip_trace_usage row count now: ${left.rows[0].n} (was 0 at start)`);

console.log(`\n---- ${pass} passed, ${fail} failed ----`);
await pool.end();
