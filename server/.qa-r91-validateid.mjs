// Run 91 (s1-api-test) — which path params reach SQL UNVALIDATED?
//
// THE BUG CLASS: `validateId(...names)` DEFAULTS TO ['id'] when called bare
// (middleware/validateId.js:9). So a route whose params are named :leadId / :woId /
// :contactId but that calls a bare `validateId()` validates NOTHING — the loop reads
// req.params.id, gets undefined, and falls through to next(). A non-UUID then reaches
// Postgres and throws 22P02, which surfaces as a 500 instead of a 400.
//
// This is a DIFFERENT set difference from .qa-r88-orphanparam.mjs (declared vs READ);
// this one is declared vs VALIDATED.
//
// Two independent halves, because either alone can lie:
//   CHECK A (static) — declared path params  MINUS  params covered by validateId
//   CHECK B (dynamic) — fire junk ids at every param route and look for 5xx
// A finds latent holes B cannot reach (row missing -> 404 before SQL); B proves impact.
//
// SELF-TEST: CHECK A is run against a synthetic fixture with a KNOWN hole first. A set
// difference that cannot rediscover a planted defect is not evidence of anything.
import fs from 'fs';
import path from 'path';
import pool from './src/db/pool.js';

const BASE = process.argv[2] || 'http://localhost:3001';
const ROUTES_DIR = path.join(process.cwd(), 'src', 'routes');

// ------------------------------------------------------------------
// PARSER
// ------------------------------------------------------------------
const QUOTE = "['\"" + String.fromCharCode(96) + ']';
const ROUTE_RE = new RegExp(
  'router\\.(get|post|put|patch|delete)\\(\\s*' + QUOTE + '([^\'"' + String.fromCharCode(96) + ']*)' + QUOTE,
  'g'
);

/** Given a route file's source, return [{method, routePath, declared[], validated[], bare}] */
function parseRoutes(src) {
  const out = [];
  ROUTE_RE.lastIndex = 0;
  let m;
  while ((m = ROUTE_RE.exec(src))) {
    const method = m[1].toUpperCase();
    const routePath = m[2];
    const declared = [...routePath.matchAll(/:([A-Za-z0-9_]+)/g)].map((x) => x[1]);
    if (!declared.length) continue;

    // The middleware region runs from the end of the path string to the handler fn.
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 600);
    const stops = [after.indexOf('async (req'), after.indexOf('(req,'), after.indexOf('(req)')]
      .filter((i) => i >= 0);
    const region = stops.length ? after.slice(0, Math.min(...stops)) : after;

    const vm = region.match(/validateId\(([^)]*)\)/);
    let validated = [];
    let bare = false;
    if (vm) {
      const args = [...vm[1].matchAll(/['"`]([A-Za-z0-9_]+)['"`]/g)].map((x) => x[1]);
      if (args.length) validated = args;
      else { validated = ['id']; bare = true; }
    }
    out.push({ method, routePath, declared, validated, hasValidateId: !!vm, bare });
  }
  return out;
}

// ------------------------------------------------------------------
// SELF-TEST — plant a known hole and require the parser to find it
// ------------------------------------------------------------------
const FIXTURE = [
  "router.get('/:id', validateId(), async (req, res) => {});",                       // OK
  "router.delete('/:woId/milestones/:milestoneId', validateId('woId','milestoneId'), async (req, res) => {});", // OK
  "router.delete('/:leadId/contacts/:contactId', validateId(), async (req, res) => {});", // HOLE: bare -> only 'id'
  "router.patch('/:sequenceId', async (req, res) => {});",                            // HOLE: no validateId at all
  "router.get('/:id/items', validateId(), async (req, res) => {});",                  // OK
].join('\n');

const fx = parseRoutes(FIXTURE);
const fxHoles = fx.filter((r) => r.declared.some((d) => !r.validated.includes(d)));
const expected = ['/:leadId/contacts/:contactId', '/:sequenceId'];
const gotFx = fxHoles.map((r) => r.routePath).sort();
const selfTestPass =
  JSON.stringify(gotFx) === JSON.stringify(expected.sort()) && fx.length === 5;
console.log('SELF-TEST:', selfTestPass ? 'PASS' : 'FAIL');
console.log('  parsed', fx.length, 'of 5 fixture routes; holes found:', JSON.stringify(gotFx));
if (!selfTestPass) {
  console.log('  ABORTING — the check cannot find a planted defect, so a zero would be meaningless.');
  await pool.end();
  process.exit(1);
}

// ------------------------------------------------------------------
// CHECK A — static, over the real route files
// ------------------------------------------------------------------
console.log('\n=== CHECK A: declared path params MINUS validateId coverage ===');
const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js') && !f.startsWith('.'));
const holes = [];
let paramRoutes = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(ROUTES_DIR, f), 'utf8');
  for (const r of parseRoutes(src)) {
    paramRoutes++;
    const missing = r.declared.filter((d) => !r.validated.includes(d));
    if (missing.length) holes.push({ file: f, ...r, missing });
  }
}
console.log(`param-bearing routes scanned: ${paramRoutes}`);
console.log(`routes with at least one UNVALIDATED param: ${holes.length}\n`);

// A bare validateId() on a route with no :id at all is the sharpest shape — flag it first.
const bareMismatch = holes.filter((h) => h.bare && !h.declared.includes('id'));
const noGuard = holes.filter((h) => !h.hasValidateId);
const partial = holes.filter((h) => h.hasValidateId && !(h.bare && !h.declared.includes('id')));

const show = (label, list) => {
  console.log(`--- ${label}: ${list.length} ---`);
  for (const h of list) {
    console.log(`  ${h.method.padEnd(6)} ${h.routePath.padEnd(46)} ${h.file.padEnd(22)} unvalidated=${JSON.stringify(h.missing)}`);
  }
  console.log();
};
show('A1 BARE validateId() but NO :id param (validates nothing)', bareMismatch);
show('A2 NO validateId at all', noGuard);
show('A3 PARTIAL coverage (some params guarded, some not)', partial);

// ------------------------------------------------------------------
// CHECK B — dynamic: fire junk ids and look for 5xx
// ------------------------------------------------------------------
console.log('=== CHECK B: junk path params against the live server ===');
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const inventory = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

// Never fire an import/export/sync/skip-trace/send route from a sweep (standing rule:
// trigger-import is hyphenated, so match the word, not a slash).
const DANGEROUS = /import|geocod|skip-trace|sync|refresh|send|export|bulk|trigger|webhook|public/i;

// Snapshot every table's row count so any accidental write is provable, not assumed.
const snapshot = async () => {
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
  );
  const counts = {};
  for (const { tablename } of rows) {
    try {
      const r = await pool.query(`SELECT count(*)::int AS n FROM "${tablename}"`);
      counts[tablename] = r.rows[0].n;
    } catch { /* skip */ }
  }
  return counts;
};
const before = await snapshot();

const JUNK = ['not-a-uuid', '999999999'];
const results = {};
const fivexx = [];
let fired = 0;

for (const r of inventory) {
  if (!r.path.includes(':')) continue;
  if (DANGEROUS.test(r.path)) continue;
  for (const junk of JUNK) {
    const url = r.path.replace(/:([A-Za-z0-9_]+)/g, junk);
    try {
      const res = await fetch(`${BASE}${url}`, {
        method: r.method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: r.method === 'GET' || r.method === 'DELETE' ? undefined : JSON.stringify({}),
      });
      fired++;
      const b = res.status >= 500 ? 500 : res.status;
      results[b] = (results[b] || 0) + 1;
      if (res.status >= 500) {
        const text = await res.text();
        fivexx.push({ route: `${r.method} ${r.path}`, junk, status: res.status, body: text.slice(0, 300) });
      }
    } catch (e) {
      fivexx.push({ route: `${r.method} ${r.path}`, junk, status: 'THREW', body: String(e).slice(0, 200) });
    }
  }
}

const after = await snapshot();
const drift = Object.keys(after).filter((t) => before[t] !== after[t])
  .map((t) => `${t}: ${before[t]} -> ${after[t]}`);

console.log(`requests fired: ${fired}`);
console.log('status buckets:', JSON.stringify(results));
console.log(`DB row-count drift: ${drift.length ? drift.join(', ') : 'NONE (0 net writes)'}`);
console.log(`\n5xx / threw: ${fivexx.length}`);
for (const f of fivexx) {
  console.log(`\n  ${f.status}  ${f.route}   junk="${f.junk}"`);
  console.log(`     ${f.body.replace(/\s+/g, ' ').slice(0, 260)}`);
}

await pool.end();
