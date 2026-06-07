// Dump every route definition across server/src/routes/*.js with their mount
// prefix from server/src/routes/index.js. Output JSON to stdout.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES_DIR = 'server/src/routes';
const INDEX_FILE = join(ROUTES_DIR, 'index.js');

// Build file -> mount-prefix map from index.js
const indexSrc = readFileSync(INDEX_FILE, 'utf8');
const imports = {};
for (const m of indexSrc.matchAll(/import\s+(\w+)\s+from\s+'\.\/([^']+)'/g)) {
  imports[m[1]] = m[2]; // varName -> file
}
const mounts = {};
for (const m of indexSrc.matchAll(/router\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
  const file = imports[m[2]];
  if (file) mounts[file] = '/api' + m[1];
}

const files = readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js') && f !== 'index.js');

const all = [];
for (const f of files) {
  const prefix = mounts[f];
  if (!prefix) {
    all.push({ file: f, mount: null, method: null, path: null, note: 'no mount' });
    continue;
  }
  const src = readFileSync(join(ROUTES_DIR, f), 'utf8');
  const routeRe = /^router\.(get|post|put|patch|delete)\s*\(\s*'([^']+)'/gm;
  for (const m of src.matchAll(routeRe)) {
    all.push({
      file: f,
      mount: prefix,
      method: m[1].toUpperCase(),
      path: m[2],
      full: prefix + m[2],
    });
  }
}

console.log(JSON.stringify(all, null, 2));
