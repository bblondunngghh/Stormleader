// QA Run 66 — AXIS D: TYPE CONFUSION IN WRITE BODIES.
// The one axis Run 65 planned but never executed (it hit its turn cap first).
//
// Premise: every write route reads named fields off req.body. Handlers routinely
// assume those fields are scalars — they call .trim(), .toLowerCase(), .map(),
// JSON.stringify(), or hand them straight to pg as a bind param. Sending an ARRAY,
// an OBJECT, a BOOLEAN or a NUMBER where a string is expected must produce a 400,
// never an unhandled 500.
//
// Field names are extracted STATICALLY from `const {...} = req.body` in each route
// file, so payloads target the fields the handler actually reads.
//
// SAFETY:
//  - The SKIP list is copied verbatim from .qa-write-validation.mjs (real emails,
//    Stripe, Tracerfy, bulk writes, geocoding, admin scope, auth session).
//  - Every field is wrong-typed SIMULTANEOUSLY, which maximises the chance the
//    handler rejects before any persistence.
//  - Any 2xx is recorded as ACCEPTED-GARBAGE so rows can be cleaned up.
//  - Run with QA_BASE to point at an isolated instance.
import fs from 'fs';
import path from 'path';

const BASE = (process.env.QA_BASE || 'http://localhost:3097') + '/api';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const OUT = 'C:/tmp/qa-r66-axisD.json';

const SKIP = [
  { re: /\/test-email$/, why: 'sends a real email' },
  { re: /\/send-email$/, why: 'sends a real email' },
  { re: /\/team\/invite$/, why: 'sends a real invite email + creates a user' },
  { re: /\/leads\/score-all$/, why: 'bulk DB write (Neon free tier)' },
  { re: /\/leads\/bulk-/, why: 'bulk DB write (Neon free tier)' },
  { re: /^\/api\/webhooks/, why: 'inbound webhook, not client-facing' },
  { re: /^\/api\/drift/, why: 'triggers storm ingestion (bulk write + external fetch)' },
  { re: /^\/api\/payments/, why: 'Stripe — real money movement' },
  { re: /^\/api\/skip-trace\/(?!.*config)/, why: 'paid third-party API (Tracerfy)' },
  { re: /^\/api\/properties/, why: 'geocoding / bulk property writes' },
  { re: /^\/api\/counties/, why: 'bulk county/geo ingestion' },
  { re: /^\/api\/auth\/(register|refresh|logout)/, why: 'would mutate/invalidate the QA session' },
  { re: /\/onboarding\//, why: 'mutates tenant onboarding + billing state' },
  { re: /^\/api\/admin/, why: 'platform-admin scope' },
];

// ---- static extraction of req.body field names, per route file ----------------
const ROUTE_DIR = 'src/routes';
const fileFields = {};
for (const f of fs.readdirSync(ROUTE_DIR).filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(ROUTE_DIR, f), 'utf8');
  const names = new Set();
  // const { a, b, c = 1, d: e } = req.body
  for (const m of src.matchAll(/\{([^{}]*)\}\s*=\s*req\.body/g)) {
    for (let part of m[1].split(',')) {
      part = part.trim();
      if (!part) continue;
      const name = part.split(/[:=]/)[0].trim().replace(/^\.\.\./, '');
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  // req.body.foo
  for (const m of src.matchAll(/req\.body\.([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  fileFields[f] = [...names];
}

// Wrong-type values. Each pass replaces EVERY field with the same shape.
const PASSES = [
  ['array', () => ['x', 'y']],
  ['object', () => ({ nested: { deep: 1 } })],
  ['number', () => 12345],
  ['boolean', () => true],
  ['nested-array', () => [{ a: [1, 2] }]],
];

const UUID_MISSING = '00000000-0000-0000-0000-000000000000';

async function req(method, p, body) {
  const opts = { method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } };
  opts.body = JSON.stringify(body);
  try {
    const res = await fetch(BASE + p, opts);
    return { status: res.status, text: (await res.text()).slice(0, 300) };
  } catch (e) {
    return { status: 0, text: 'FETCH_ERROR ' + e.message };
  }
}

const writes = inv.filter((r) => ['POST', 'PUT', 'PATCH'].includes(r.method));
const tested = [];
const skipped = [];
for (const r of writes) {
  const hit = SKIP.find((s) => s.re.test(r.path));
  if (hit) skipped.push({ ...r, why: hit.why });
  else tested.push(r);
}

console.log(`AXIS D — TYPE CONFUSION`);
console.log(`write routes: ${writes.length} | testing: ${tested.length} | skipped: ${skipped.length}`);

const fails = [];
const accepted = [];
let n = 0;

for (const r of tested) {
  const fields = fileFields[r.file] || [];
  if (!fields.length) continue;
  const p = r.path.replace(/^\/api/, '').replace(/:[A-Za-z]+/g, UUID_MISSING);

  for (const [label, mk] of PASSES) {
    const body = {};
    for (const f of fields) body[f] = mk();
    const res = await req(r.method, p, body);
    n++;
    if (res.status >= 500 || res.status === 0) {
      fails.push({ method: r.method, path: r.path, file: r.file, pass: label, status: res.status, body: res.text, fields });
      console.log(`  5xx  ${r.method} ${r.path}  [${label}]  -> ${res.status}  ${res.text.slice(0, 120)}`);
      fs.writeFileSync(OUT, JSON.stringify({ n, fails, accepted, skipped }, null, 2));
    } else if (res.status >= 200 && res.status < 300) {
      accepted.push({ method: r.method, path: r.path, file: r.file, pass: label, status: res.status, body: res.text });
      console.log(`  2xx  ${r.method} ${r.path}  [${label}]  -> ACCEPTED GARBAGE`);
      fs.writeFileSync(OUT, JSON.stringify({ n, fails, accepted, skipped }, null, 2));
    }
  }
}

fs.writeFileSync(OUT, JSON.stringify({ n, fails, accepted, skipped }, null, 2));
console.log(`\nrequests=${n}  5xx=${fails.length}  accepted-garbage=${accepted.length}`);
console.log(`skipped (side-effecting): ${skipped.length}`);
for (const s of skipped) console.log(`  - ${s.method} ${s.path} (${s.why})`);
console.log(`\nwrote ${OUT}`);
process.exit(0);
