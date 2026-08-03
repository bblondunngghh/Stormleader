// Run 66 — s4 verification harness. READ-ONLY except one deliberate control
// contact insert (cleaned up by .qa-r66-s4-cleanup.mjs).
// Re-verifies the three API fixes of Run 66 against a POST-FIX instance, and
// (optionally) against the pre-fix :3001 to prove the delta.
//   a2edcdb  negative pagination + NUL byte  -> 400   (errorHandler.js)
//   6127783  over-long value (22001)         -> 400   (errorHandler.js)
//   e9c5024  non-string apiKey on PATCH lender -> 400 (financing.js)
//
// Usage: QA_BASE=http://localhost:3100 node .qa-r66-s4-verify.mjs
import fs from 'fs';

const BASE = process.env.QA_BASE || 'http://localhost:3100';
const TOKEN = fs.readFileSync('C:/tmp/r66s4-token.txt', 'utf8').trim();
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

let pass = 0, fail = 0;
const lines = [];
function rec(ok, label, detail) {
  (ok ? pass++ : fail++);
  const line = `${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  :: ' + detail : ''}`;
  lines.push(line);
  console.log(line);
}

async function req(method, path, body) {
  const r = await fetch(BASE + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  let j = null;
  const text = await r.text();
  try { j = JSON.parse(text); } catch { j = { raw: text.slice(0, 120) }; }
  return { status: r.status, body: j };
}

function expect(label, res, want, extra) {
  const ok = res.status === want && (!extra || extra(res));
  rec(ok, label, `got ${res.status} ${JSON.stringify(res.body).slice(0, 110)}`);
  return ok;
}

// leak guard: the 400 body must not echo Postgres schema internals
const NO_LEAK = (res) => {
  const s = JSON.stringify(res.body).toLowerCase();
  return !/character varying|nodelimit|syntax|column |relation |select |0x00/.test(s);
};

console.log(`\n=== RUN 66 s4 VERIFY — BASE=${BASE} ===\n`);

// ---------------------------------------------------------------- FIX a2edcdb
console.log('--- a2edcdb: negative pagination + NUL byte (10 cases, all were hard 500) ---');
const NUL = '%00x';
const cases = [
  ['GET /api/leads?limit=-1', '/api/leads?limit=-1'],
  ['GET /api/leads?offset=-5', '/api/leads?offset=-5'],
  ['GET /api/leads?stage=NUL', `/api/leads?stage=${NUL}`],
  ['GET /api/crm/leads?stage=NUL', `/api/crm/leads?stage=${NUL}`],
  ['GET /api/crm/dashboard/properties-affected/list?limit=-1', '/api/crm/dashboard/properties-affected/list?limit=-1'],
  ['GET /api/crm/dashboard/properties-affected/list?offset=-5', '/api/crm/dashboard/properties-affected/list?offset=-5'],
  ['GET /api/crm/subcontractors?limit=-1', '/api/crm/subcontractors?limit=-1'],
  ['GET /api/crm/subcontractors?offset=-5', '/api/crm/subcontractors?offset=-5'],
  ['GET /api/materials/orders?limit=-1', '/api/materials/orders?limit=-1'],
  ['GET /api/materials/orders?offset=-5', '/api/materials/orders?offset=-5'],
];
for (const [label, path] of cases) {
  expect(label + ' -> 400', await req('GET', path), 400, NO_LEAK);
}

console.log('\n--- a2edcdb CONTROLS: legitimate pagination still works ---');
for (const p of ['/api/leads?limit=5', '/api/crm/leads?limit=5',
  '/api/crm/dashboard/properties-affected/list?limit=5', '/api/crm/subcontractors?limit=5',
  '/api/materials/orders?limit=5']) {
  expect(`GET ${p} -> 200`, await req('GET', p), 200);
}
// zero and large values must not have been broken by the clamp
expect('GET /api/leads?limit=0 -> 200 (zero is legal)', await req('GET', '/api/leads?limit=0'), 200);
expect('GET /api/leads?offset=0 -> 200', await req('GET', '/api/leads?offset=0'), 200);
expect('GET /api/leads?limit=abc -> 400 (pre-existing guard intact)', await req('GET', '/api/leads?limit=abc'), 400);
expect('GET /api/crm/leads?stage=contacted -> 200 (real stage key still filters)',
  await req('GET', '/api/crm/leads?stage=contacted'), 200);

// ---------------------------------------------------------------- FIX e9c5024
console.log('\n--- e9c5024: PATCH /crm/financing/lenders/:id non-string apiKey ---');
const FAKE = '11111111-1111-4111-8111-111111111111';
for (const [label, val] of [['array', ['a']], ['number', 5], ['object', { a: 1 }], ['boolean', true], ['null-in-array', [null]]]) {
  const r = await req('PATCH', `/api/crm/financing/lenders/${FAKE}`, { apiKey: val });
  expect(`apiKey=${label} -> 400`, r, 400, (res) => /apiKey must be a string/.test(JSON.stringify(res.body)));
}
console.log('  CONTROLS: legitimate callers unaffected');
expect('apiKey="abc" (valid string, unknown lender) -> 404',
  await req('PATCH', `/api/crm/financing/lenders/${FAKE}`, { apiKey: 'abc' }), 404);
expect('body without apiKey -> 404 (reaches handler)',
  await req('PATCH', `/api/crm/financing/lenders/${FAKE}`, { merchantId: 'x' }), 404);
expect('apiKey omitted entirely, empty body -> 404',
  await req('PATCH', `/api/crm/financing/lenders/${FAKE}`, {}), 404);
expect('malformed id still 400 (validateId intact)',
  await req('PATCH', '/api/crm/financing/lenders/not-a-uuid', { apiKey: 'abc' }), 400);

// ---------------------------------------------------------------- FIX 6127783
console.log('\n--- 6127783: over-long value (PG 22001) -> 400, message sanitized ---');
const leads = await req('GET', '/api/crm/leads?limit=1');
const leadId = leads.body?.leads?.[0]?.id || leads.body?.data?.[0]?.id || (Array.isArray(leads.body) ? leads.body[0]?.id : null);
if (!leadId) {
  rec(false, '22001: could not obtain a lead id', JSON.stringify(leads.body).slice(0, 160));
} else {
  console.log(`  using lead ${leadId}`);
  const long = '1'.repeat(26); // contacts.phone is varchar(20)
  const r = await req('POST', `/api/crm/leads/${leadId}/contacts`, { firstName: 'qa2026s4', phone: long });
  expect('26-char phone -> 400', r, 400, NO_LEAK);
  expect('  message is the sanitized one', r, 400,
    (res) => /exceed the maximum allowed length/i.test(JSON.stringify(res.body)));
  // control: a normal phone still writes (single row; cleaned up after)
  const ok = await req('POST', `/api/crm/leads/${leadId}/contacts`, { firstName: 'qa2026s4', phone: '555-0142' });
  rec(ok.status === 200 || ok.status === 201, 'CONTROL normal phone still accepted', `got ${ok.status}`);
  fs.writeFileSync('C:/tmp/r66s4-made-contact.json', JSON.stringify({ leadId, contact: ok.body }, null, 2));
}

// ------------------------------------------------------------- REGRESSION NET
console.log('\n--- REGRESSION NET: other PG_BAD_INPUT_CODES mappings still behave ---');
expect('bad uuid in path -> 400 (22P02 mapping)', await req('GET', '/api/crm/leads/not-a-uuid'), 400);
expect('unknown but well-formed uuid -> 404', await req('GET', `/api/crm/leads/${FAKE}`), 404);
expect('no token -> 401', await (async () => {
  const r = await fetch(BASE + '/api/crm/leads', { headers: { 'Content-Type': 'application/json' } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
})(), 401);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
fs.writeFileSync('C:/tmp/r66s4-api-verify.txt', `BASE=${BASE}\n` + lines.join('\n') + `\n\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
