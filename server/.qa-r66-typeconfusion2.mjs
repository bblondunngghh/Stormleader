// QA Run 66 — AXIS D, PASS 2: SINGLE-FIELD type confusion.
//
// Pass 1 (.qa-r66-typeconfusion.mjs) set EVERY field wrong at once. That hides
// bugs behind an early-returning guard: if a handler validates field #1 and
// returns 400, fields #2..N are never exercised. The financing crash was only
// isolatable by sending apiKey ALONE, which is exactly this shape.
//
// So: one field wrong per request, every other field omitted.
// Assertion is unchanged — wrong types must 4xx, never 5xx.
//
// Same SKIP list as pass 1. Any 2xx is recorded so rows can be cleaned up.
import fs from 'fs';
import path from 'path';

const BASE = (process.env.QA_BASE || 'http://localhost:3096') + '/api';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const OUT = 'C:/tmp/qa-r66-axisD-pass2.json';

const SKIP = [
  { re: /\/test-email$/ }, { re: /\/send-email$/ }, { re: /\/team\/invite$/ },
  { re: /\/leads\/score-all$/ }, { re: /\/leads\/bulk-/ }, { re: /^\/api\/webhooks/ },
  { re: /^\/api\/drift/ }, { re: /^\/api\/payments/ }, { re: /^\/api\/skip-trace\/(?!.*config)/ },
  { re: /^\/api\/properties/ }, { re: /^\/api\/counties/ },
  { re: /^\/api\/auth\/(register|refresh|logout)/ }, { re: /\/onboarding\// }, { re: /^\/api\/admin/ },
];

const ROUTE_DIR = 'src/routes';
const fileFields = {};
for (const f of fs.readdirSync(ROUTE_DIR).filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(ROUTE_DIR, f), 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/\{([^{}]*)\}\s*=\s*req\.body/g)) {
    for (let part of m[1].split(',')) {
      part = part.trim();
      if (!part) continue;
      const name = part.split(/[:=]/)[0].trim().replace(/^\.\.\./, '');
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  for (const m of src.matchAll(/req\.body\.([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  fileFields[f] = [...names];
}

const SHAPES = [
  ['array', ['x', 'y']],
  ['object', { nested: { deep: 1 } }],
  ['number', 12345],
  ['boolean', true],
];

const UUID_MISSING = '00000000-0000-0000-0000-000000000000';

async function req(method, p, body) {
  try {
    const res = await fetch(BASE + p, {
      method,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, text: (await res.text()).slice(0, 250) };
  } catch (e) {
    return { status: 0, text: 'FETCH_ERROR ' + e.message };
  }
}

const tested = inv.filter(
  (r) => ['POST', 'PUT', 'PATCH'].includes(r.method) && !SKIP.find((s) => s.re.test(r.path))
);

console.log('AXIS D PASS 2 — SINGLE-FIELD TYPE CONFUSION');
const fails = [];
const accepted = [];
let n = 0;

for (const r of tested) {
  const fields = fileFields[r.file] || [];
  const p = r.path.replace(/^\/api/, '').replace(/:[A-Za-z]+/g, UUID_MISSING);
  for (const f of fields) {
    for (const [label, val] of SHAPES) {
      const res = await req(r.method, p, { [f]: val });
      n++;
      if (res.status >= 500 || res.status === 0) {
        fails.push({ method: r.method, path: r.path, file: r.file, field: f, shape: label, status: res.status, body: res.text });
        console.log(`  5xx  ${r.method} ${r.path}  {${f}: ${label}}  -> ${res.status}  ${res.text.slice(0, 110)}`);
        fs.writeFileSync(OUT, JSON.stringify({ n, fails, accepted }, null, 2));
      } else if (res.status >= 200 && res.status < 300) {
        accepted.push({ method: r.method, path: r.path, field: f, shape: label, status: res.status });
        fs.writeFileSync(OUT, JSON.stringify({ n, fails, accepted }, null, 2));
      }
    }
  }
}

fs.writeFileSync(OUT, JSON.stringify({ n, fails, accepted }, null, 2));
console.log(`\nrequests=${n}  5xx=${fails.length}  accepted-2xx=${accepted.length}`);
console.log(`wrote ${OUT}`);
process.exit(0);
