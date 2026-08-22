// Run 85 s4-verify — re-verify the two API fixes from Run 84 s1 against the LIVE server.
//   76f009a  PATCH /api/crm/financing/{plans,lenders}/:id  no-op body -> 400 (was a false 404)
//   b72b6be  a CHECK-constraint violation (23514) -> 400 (was 500)
// Mints ONE token (login is rate limited ~10/15min). Writes nothing except one
// idempotent same-value PATCH, which is reverted-by-construction (same value in).
import fs from 'fs';

const API = 'http://localhost:3001';
const TOKEN_FILE = 'C:/tmp/qa-r85-token.txt';

async function login() {
  const r = await fetch(API + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'waterlooconstruction1@gmail.com',
      password: '2Wealth&health',
      tenantSlug: 'waterloo',
    }),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error('login failed: ' + r.status + ' ' + JSON.stringify(j).slice(0, 200));
  fs.writeFileSync(TOKEN_FILE, j.accessToken);
  return j.accessToken;
}

let TOKEN;
async function req(method, path, body) {
  const opts = { method, headers: { authorization: 'Bearer ' + TOKEN } };
  if (body !== undefined) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(API + path, opts);
  let j = null;
  try { j = await r.json(); } catch { j = null; }
  return { status: r.status, body: j };
}

const results = [];
function check(name, got, wantStatus, extra) {
  const pass = got.status === wantStatus && (!extra || extra(got));
  results.push({ pass, name, want: wantStatus, got: got.status, msg: got.body && (got.body.error || got.body.message) || '' });
}

const DEAD = '00000000-0000-4000-8000-000000000000';

(async () => {
  TOKEN = process.env.QA_TOKEN || (fs.existsSync(TOKEN_FILE) ? fs.readFileSync(TOKEN_FILE, 'utf8').trim() : null);
  let probe = TOKEN ? await req('GET', '/api/crm/financing/plans') : { status: 401 };
  if (probe.status === 401) { TOKEN = await login(); probe = await req('GET', '/api/crm/financing/plans'); }
  if (probe.status !== 200) throw new Error('cannot list plans: ' + probe.status + ' ' + JSON.stringify(probe.body).slice(0, 200));

  const plans = Array.isArray(probe.body) ? probe.body : (probe.body.plans || probe.body.data || []);
  const lendersRes = await req('GET', '/api/crm/financing/lenders');
  const lenders = Array.isArray(lendersRes.body) ? lendersRes.body : (lendersRes.body && (lendersRes.body.lenders || lendersRes.body.data)) || [];
  console.log('inventory: plans=' + plans.length + ' lenders=' + lenders.length);
  const plan = plans[0];
  const lender = lenders[0];

  // ---- FIX 76f009a: no-op body must be 400 "No fields to update", not 404 ----
  if (plan) {
    check('plans/:id real id + {}            -> 400', await req('PATCH', '/api/crm/financing/plans/' + plan.id, {}), 400,
      g => /no fields/i.test(g.body && g.body.error || ''));
    check('plans/:id real id + {foo:"bar"}   -> 400', await req('PATCH', '/api/crm/financing/plans/' + plan.id, { foo: 'bar' }), 400,
      g => /no fields/i.test(g.body && g.body.error || ''));
  } else {
    results.push({ pass: null, name: 'plans/:id  (no plan rows to test with)', want: 400, got: '-', msg: '' });
  }
  check('plans/:id DEAD uuid + real field  -> 404', await req('PATCH', '/api/crm/financing/plans/' + DEAD, { isActive: true }), 404);
  check('plans/:id bad-format id           -> 400', await req('PATCH', '/api/crm/financing/plans/not-a-uuid', { isActive: true }), 400);

  if (lender) {
    check('lenders/:id real id + {}          -> 400', await req('PATCH', '/api/crm/financing/lenders/' + lender.id, {}), 400,
      g => /no fields/i.test(g.body && g.body.error || ''));
    check('lenders/:id real id + {foo:"bar"} -> 400', await req('PATCH', '/api/crm/financing/lenders/' + lender.id, { foo: 'bar' }), 400,
      g => /no fields/i.test(g.body && g.body.error || ''));
    check('lenders/:id apiKey type guard still wins -> 400 apiKey must be a string',
      await req('PATCH', '/api/crm/financing/lenders/' + lender.id, { apiKey: 123 }), 400,
      g => /apiKey must be a string/i.test(g.body && g.body.error || ''));
  } else {
    results.push({ pass: null, name: 'lenders/:id  (no lender rows to test with)', want: 400, got: '-', msg: '' });
  }
  check('lenders/:id DEAD uuid + real field -> 404', await req('PATCH', '/api/crm/financing/lenders/' + DEAD, { isActive: true }), 404);

  // the positive path: a real field on a real row must still 200. Same-value write.
  if (plan) {
    const cur = plan.is_active !== undefined ? plan.is_active : plan.isActive;
    const r = await req('PATCH', '/api/crm/financing/plans/' + plan.id, { isActive: cur });
    check('plans/:id real id + isActive(same value) -> 200', r, 200);
  }

  // ---- FIX b72b6be: 23514 check_violation -> 400, sanitized ----
  const estRes = await req('GET', '/api/estimates?limit=1');
  const ests = Array.isArray(estRes.body) ? estRes.body : (estRes.body && (estRes.body.estimates || estRes.body.data)) || [];
  const est = ests[0];
  if (est) {
    for (const bad of ['bogus', 12345, ['x']]) {
      const r = await req('PATCH', '/api/estimates/' + est.id, { status: bad });
      check('estimates PATCH status=' + JSON.stringify(bad) + ' -> 400', r, 400,
        g => {
          const m = (g.body && g.body.error) || '';
          return !/constraint|relation "|estimates_status_check/i.test(m);
        });
    }
    const good = await req('PATCH', '/api/estimates/' + est.id, { status: est.status });
    check('estimates PATCH status=(own value "' + est.status + '") -> 200', good, 200);
  } else {
    results.push({ pass: null, name: 'estimates  (no estimate rows)', want: 400, got: '-', msg: '' });
  }

  console.log('');
  for (const r of results) {
    const tag = r.pass === null ? 'SKIP' : r.pass ? 'PASS' : 'FAIL';
    console.log(tag + '  ' + r.name.padEnd(58) + ' got=' + r.got + (r.msg ? '  "' + r.msg + '"' : ''));
  }
  const fails = results.filter(r => r.pass === false).length;
  console.log('\n' + results.filter(r => r.pass === true).length + ' pass, ' + fails + ' fail, ' + results.filter(r => r.pass === null).length + ' skip');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
