// Find routes from the inventory that are NOT covered by any standing probe.
import { readFileSync } from 'node:fs';

const routes = JSON.parse(readFileSync('.qa-routes.json', 'utf8'));
const probeFiles = [
  '.qa-api-probe.mjs',
  '.qa-api-write-probe.mjs',
  '.qa-api-edge-probe.mjs',
  '.qa-hearth-fin.mjs',
  '.qa-patch-delete-probe.mjs',
];

const probeText = probeFiles.map(f => readFileSync(f, 'utf8')).join('\n');

// Build a canonical "search needle" for each route.
// For routes with :param, we look for the prefix (everything up to the first :param).
function needle(r) {
  // full is mount + path, e.g. /api/crm/leads/:id/contacts
  // probe URLs use real UUIDs, so we match on the literal path before any :param.
  const parts = r.full.split('/');
  const literalParts = [];
  for (const p of parts) {
    if (p.startsWith(':')) break;
    literalParts.push(p);
  }
  return literalParts.join('/');
}

const uncovered = [];
for (const r of routes) {
  if (!r.full) continue;
  const n = needle(r);
  // Look for path appearing in the probe text. We need the path AND method to match.
  // Simpler: search for the literal needle - if absent, surely uncovered.
  if (!probeText.includes(n)) {
    uncovered.push(r);
    continue;
  }
  // If path covered, check method too. Probes encode methods as 'GET', 'POST', 'PATCH', etc.
  // Build per-method patterns: probe uses fetch with method: 'POST' etc.
  // Conservative check: if the route uses an unusual method (DELETE/PUT/PATCH), we may have false hits.
  // For now, just dedupe on path; we'll refine if needed.
}

// Also list routes covered but want to print stats
console.log(`Total routes: ${routes.length}`);
console.log(`Uncovered (by path): ${uncovered.length}`);
console.log('\n=== UNCOVERED ===');
const byFile = {};
for (const r of uncovered) {
  byFile[r.file] = byFile[r.file] || [];
  byFile[r.file].push(`${r.method.padEnd(6)} ${r.full}`);
}
for (const f of Object.keys(byFile).sort()) {
  console.log(`\n${f}:`);
  for (const line of byFile[f]) console.log(`  ${line}`);
}
