// s4-verify: re-verify the two API fix commits (9cc9562, 8278871) + edge cases
import fs from 'fs';
const TOK = fs.readFileSync(new URL('./.qa-s4-tok.txt', import.meta.url), 'utf8').trim();
const BASE = 'http://localhost:3001/api';
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOK}` };

async function req(method, path, body, opts = {}) {
  const init = { method, headers: opts.noAuth ? { 'Content-Type': 'application/json' } : H };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  if (opts.noBody) delete init.body;
  const r = await fetch(BASE + path, init);
  let j = null;
  try { j = await r.json(); } catch { j = '<non-json>'; }
  return { status: r.status, body: j };
}

const results = [];
function check(name, got, wantStatus, extra) {
  const pass = got.status === wantStatus && (!extra || extra(got));
  results.push({ pass, name, status: got.status, want: wantStatus, body: JSON.stringify(got.body).slice(0, 160) });
  return pass;
}

console.log('=== FIX 9cc9562: PUT /roof-measurement/config rejects missing enabled flag ===');

// capture original value so we restore it at the end
const orig = await req('GET', '/roof-measurement/config');
console.log('original config:', JSON.stringify(orig.body));
const origEnabled = orig.body?.enabled ?? orig.body?.roof_measurement_enabled ?? false;

check('PUT /roof-measurement/config {} -> 400', await req('PUT', '/roof-measurement/config', {}), 400,
  g => /roof_measurement_enabled/.test(JSON.stringify(g.body)));
check('PUT /roof-measurement/config (no body) -> 400', await req('PUT', '/roof-measurement/config', undefined, { noBody: true }), 400);
check('PUT /roof-measurement/config {bogus:1} -> 400', await req('PUT', '/roof-measurement/config', { bogus: 1 }), 400);
check('PUT /roof-measurement/config {roof_measurement_enabled:null} -> 200 (explicit null is not undefined)',
  await req('PUT', '/roof-measurement/config', { roof_measurement_enabled: null }), 200);
check('PUT /roof-measurement/config {roof_measurement_enabled:true} -> 200',
  await req('PUT', '/roof-measurement/config', { roof_measurement_enabled: true }), 200);
const readback = await req('GET', '/roof-measurement/config');
check('GET /roof-measurement/config reads back enabled=true', readback, 200,
  g => g.body.enabled === true || g.body.roof_measurement_enabled === true);
check('PUT {roof_measurement_enabled:false} -> 200', await req('PUT', '/roof-measurement/config', { roof_measurement_enabled: false }), 200);
const readback2 = await req('GET', '/roof-measurement/config');
check('GET reads back enabled=false', readback2, 200,
  g => (g.body.enabled ?? g.body.roof_measurement_enabled) === false);
check('PUT /roof-measurement/config no-auth -> 401', await req('PUT', '/roof-measurement/config', { roof_measurement_enabled: true }, { noAuth: true }), 401);

console.log('--- sibling route must be unchanged ---');
check('PUT /skip-trace/config {} -> 400 (sibling guard intact)', await req('PUT', '/skip-trace/config', {}), 400);

// restore original
await req('PUT', '/roof-measurement/config', { roof_measurement_enabled: !!origEnabled });
const restored = await req('GET', '/roof-measurement/config');
console.log('restored config:', JSON.stringify(restored.body));

console.log('\n=== FIX 8278871: PATCH /auth/me returns 409 on duplicate email ===');
const me = await req('GET', '/auth/me');
console.log('me:', JSON.stringify(me.body).slice(0, 200));
const myEmail = me.body?.user?.email ?? me.body?.email;
const team = await req('GET', '/crm/team');
const list = Array.isArray(team.body) ? team.body : (team.body?.members ?? team.body?.users ?? []);
const others = list.map(u => u.email).filter(e => e && e !== myEmail);
console.log('my email:', myEmail, '| other team emails:', JSON.stringify(others));

if (others.length === 0) {
  results.push({ pass: false, name: 'PATCH /auth/me duplicate email -> 409', status: 'SKIPPED', want: 409, body: 'no second team member found to collide with' });
} else {
  const dup = others[0];
  check(`PATCH /auth/me {email:"${dup}"} (duplicate) -> 409 not 500`, await req('PATCH', '/auth/me', { email: dup }), 409,
    g => /already exists/i.test(JSON.stringify(g.body)));
  // confirm my email was NOT changed by the failed attempt
  const after = await req('GET', '/auth/me');
  const stillMine = (after.body?.user?.email ?? after.body?.email) === myEmail;
  results.push({ pass: stillMine, name: 'my email unchanged after failed duplicate PATCH', status: after.body?.user?.email, want: myEmail, body: '' });
}
// non-destructive happy path: PATCH with my own current values
check('PATCH /auth/me with own current email -> 200 (no false 409 on self)', await req('PATCH', '/auth/me', { email: myEmail }), 200);
check('PATCH /auth/me no-auth -> 401', await req('PATCH', '/auth/me', { email: myEmail }, { noAuth: true }), 401);

console.log('\n=== RESULTS ===');
let fails = 0;
for (const r of results) {
  if (!r.pass) fails++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'} | got ${r.status} want ${r.want} | ${r.name}${r.pass ? '' : '\n       body: ' + r.body}`);
}
console.log(`\n${results.length - fails}/${results.length} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
