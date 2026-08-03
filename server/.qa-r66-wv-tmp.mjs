// QA PHASE 3 — validation sweep across EVERY write route (POST/PUT/PATCH/DELETE).
// Sends an empty body (and a bad-id variant for :id routes) and asserts the server
// responds 4xx, never 5xx. Validation rejects before any side effect, so this is safe.
// Routes with real-world side effects (email, Stripe, bulk writes, ingestion) are
// SKIPPED EXPLICITLY and listed in the output — no silent caps.
import fs from 'fs';

const BASE = 'http://localhost:3096/api';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

// Side-effecting routes we deliberately do NOT fire with a valid body.
// Empty-body validation is still safe for most; these are skipped entirely.
const SKIP = [
  { re: /\/test-email$/, why: 'sends a real email' },
  { re: /\/send-email$/, why: 'sends a real email' },
  { re: /\/team\/invite$/, why: 'sends a real invite email + creates a user' },
  { re: /\/leads\/score-all$/, why: 'bulk DB write (Neon free tier)' },
  { re: /\/leads\/bulk-/, why: 'bulk DB write (Neon free tier)' },
  { re: /^\/api\/webhooks/, why: 'inbound webhook — unsigned payload would be rejected anyway; not a client-facing route' },
  { re: /^\/api\/drift/, why: 'triggers storm-data ingestion (bulk write + external fetch)' },
  { re: /^\/api\/payments/, why: 'Stripe — real money movement' },
  { re: /^\/api\/skip-trace\/(?!.*config)/, why: 'paid third-party API (Tracerfy)' },
  { re: /^\/api\/properties/, why: 'geocoding / bulk property writes (charter: zero bulk geocoding)' },
  { re: /^\/api\/counties/, why: 'bulk county/geo ingestion' },
  { re: /^\/api\/auth\/(register|refresh|logout)/, why: 'would mutate/invalidate the QA session' },
  { re: /\/onboarding\//, why: 'mutates tenant onboarding + billing state' },
  { re: /^\/api\/admin/, why: 'platform-admin scope; PUT would mutate another tenant' },
];

const rows = [];
async function req(method, path, body) {
  const opts = { method, headers: { Authorization: `Bearer ${TOKEN}` } };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  try {
    const res = await fetch(BASE + path, opts);
    const text = await res.text();
    return { status: res.status, text };
  } catch (e) { return { status: 0, text: 'FETCH_ERROR ' + e.message }; }
}

const UUID_MISSING = '00000000-0000-0000-0000-000000000000';
const BAD_ID = 'not-a-uuid';

const writes = inv.filter((r) => r.method !== 'GET');
const skipped = [];
const tested = [];

for (const r of writes) {
  const hit = SKIP.find((s) => s.re.test(r.path));
  if (hit) { skipped.push({ ...r, why: hit.why }); continue; }
  tested.push(r);
}

console.log(`write routes total: ${writes.length} | testing: ${tested.length} | skipped: ${skipped.length}`);

for (const r of tested) {
  // Substitute path params: one pass with a well-formed-but-missing UUID,
  // one pass with a malformed id (must be 400 from validateId, never 500).
  const variants = [];
  if (r.path.includes(':')) {
    variants.push({ label: 'missing-uuid', p: r.path.replace(/:[A-Za-z]+/g, UUID_MISSING) });
    variants.push({ label: 'malformed-id', p: r.path.replace(/:[A-Za-z]+/g, BAD_ID) });
  } else {
    variants.push({ label: 'empty-body', p: r.path });
  }
  for (const v of variants) {
    const path = v.p.replace(/^\/api/, '');
    const body = r.method === 'DELETE' ? undefined : {};
    const res = await req(r.method, path, body);
    const is5xx = res.status >= 500;
    const ok = !is5xx && res.status !== 0;
    rows.push({
      method: r.method, path: v.p, variant: v.label, status: res.status, ok,
      file: r.file, note: ok ? '' : res.text.slice(0, 300).replace(/\s+/g, ' '),
    });
    if (!ok) console.log(`  ✗ ${r.method} ${v.p} [${v.label}] -> ${res.status} :: ${res.text.slice(0, 200)}`);
  }
}

// group results
const byStatus = {};
rows.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

console.log('\n================ PHASE 3 SUMMARY ================');
console.log('requests:', rows.length);
console.log('status distribution:', JSON.stringify(byStatus, null, 0));
const bad = rows.filter((r) => !r.ok);
console.log('5xx / transport failures:', bad.length);
if (bad.length) {
  console.log('\n--- 5xx (REAL BUGS) ---');
  bad.forEach((r) => console.log(`${r.method} ${r.path} [${r.variant}] -> ${r.status} (${r.file}) :: ${r.note}`));
}

// malformed-id must be 400, not 404/200 — report any that are not
const malformed = rows.filter((r) => r.variant === 'malformed-id');
const malformedNot400 = malformed.filter((r) => r.status !== 400);
console.log(`\nmalformed-id guard: ${malformed.length - malformedNot400.length}/${malformed.length} returned 400`);
if (malformedNot400.length) {
  console.log('--- malformed id NOT rejected with 400 ---');
  malformedNot400.forEach((r) => console.log(`${r.method} ${r.path} -> ${r.status} (${r.file}) :: ${r.note.slice(0, 140)}`));
}

console.log('\n--- DELIBERATELY SKIPPED (side effects) ---');
skipped.forEach((r) => console.log(`${r.method.padEnd(6)} ${r.path.padEnd(56)} ${r.why}`));

fs.writeFileSync('C:/tmp/write-validation-raw.json', JSON.stringify({ rows, skipped }, null, 1));
