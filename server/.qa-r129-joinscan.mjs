// Run 129 (s1 api-test) — cross-tenant JOIN scanner.
// Improves on Run 125's single-line regex: walks whole backtick template literals so a
// multi-line `JOIN x y\n  ON y.id = z.x_id` is caught, and reports the tenant predicate
// state per (query, alias) instead of per line.
import fs from 'fs';
import path from 'path';
import pool from './src/db/pool.js';

const roots = ['src/services', 'src/routes'];
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
}
roots.forEach(walk);

const tenantTables = new Set();
{
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.columns WHERE column_name='tenant_id' AND table_schema='public'"
  );
  rows.forEach((r) => tenantTables.add(r.table_name));
}

const out = [];
const joinRe = /\b(?:LEFT|RIGHT|INNER|FULL|CROSS)?\s*(?:OUTER\s+)?JOIN\s+([a-z_][a-z0-9_]*)\s+(?:AS\s+)?([a-z][a-z0-9_]*)?\s*ON\s+([^\n]*(?:\n(?!\s*(?:LEFT|RIGHT|INNER|FULL|JOIN|WHERE|GROUP|ORDER|LIMIT|HAVING|\)))[^\n]*)*)/gi;

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  // every backtick template literal (non-greedy across newlines)
  const lits = src.match(/`[^`]*`/g) || [];
  for (const lit of lits) {
    if (!/\bJOIN\b/i.test(lit)) continue;
    const litStart = src.indexOf(lit);
    let m;
    joinRe.lastIndex = 0;
    while ((m = joinRe.exec(lit))) {
      const table = m[1].toLowerCase();
      const alias = (m[2] || table).toLowerCase();
      if (!tenantTables.has(table)) continue;
      const on = m[3].replace(/\s+/g, ' ').trim();
      const aliasTenantRe = new RegExp('\\b' + alias + '\\.tenant_id\\b', 'i');
      const scopedInOn = aliasTenantRe.test(on);
      const scopedInQuery = aliasTenantRe.test(lit);
      if (scopedInOn || scopedInQuery) continue;
      const line = src.slice(0, litStart + m.index).split('\n').length;
      out.push({
        file: f.replace(/\\/g, '/'),
        line,
        table,
        alias,
        on: on.slice(0, 120),
        scopedInOn,
        scopedInQuery,
        hasTenantParamAnywhere: /tenant_id/i.test(lit),
      });
    }
  }
}

out.sort((a, b) => (a.file + a.line).localeCompare(b.file + b.line));
fs.writeFileSync('C:/tmp/qa-r129-joinscan.json', JSON.stringify({ total: out.length, tenantTables: [...tenantTables].sort(), hits: out }, null, 2));
console.log('unscoped joins onto tenant-owned tables:', out.length);
for (const h of out) console.log(`${h.file}:${h.line}  ${h.table} ${h.alias}  | ON ${h.on}`);
await pool.end();
