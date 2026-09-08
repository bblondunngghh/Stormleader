// Run 129 (s4-verify) — PROVES the `LEFT JOIN users ... AND u.tenant_id = X` predicate
// added by 31ed5f0 actually suppresses a foreign user, WITHOUT writing anything.
//
// Strategy: build the same join shape against a synthetic one-row VALUES table holding
// (foreign_user_id, our_tenant_id). Pure SELECT. Zero writes, zero geocoding.
import pool from './src/db/pool.js';

const OUR_TENANT = process.argv[2];
const rows = [];

const foreign = await pool.query(
  `SELECT id, tenant_id, first_name, last_name FROM users WHERE tenant_id <> $1 LIMIT 1`,
  [OUR_TENANT]
);
if (!foreign.rows.length) {
  console.log('SKIP — only one tenant has users; cannot construct a cross-tenant case');
  process.exit(0);
}
const f = foreign.rows[0];
console.log(`foreign user ${f.id} (${f.first_name} ${f.last_name}) belongs to tenant ${f.tenant_id}`);

// UNSCOPED join (the pre-fix shape) vs SCOPED join (the shipped shape).
const q = async (label, on) => {
  const { rows: r } = await pool.query(
    `SELECT u.first_name, u.last_name
       FROM (SELECT $1::uuid AS assigned_rep_id, $2::uuid AS tenant_id) l
       LEFT JOIN users u ON ${on}`,
    [f.id, OUR_TENANT]
  );
  const leaked = r[0].first_name != null;
  rows.push({ label, leaked, name: `${r[0].first_name} ${r[0].last_name}` });
  console.log(`${label}: ${leaked ? 'LEAKS -> ' + r[0].first_name + ' ' + r[0].last_name : 'no row (correct)'}`);
};

await q('pre-fix   u.id = l.assigned_rep_id', 'u.id = l.assigned_rep_id');
await q('shipped   + AND u.tenant_id = l.tenant_id', 'u.id = l.assigned_rep_id AND u.tenant_id = l.tenant_id');

// Every `LEFT JOIN users` in the server source must now carry a tenant predicate.
import fs from 'fs';
import path from 'path';
const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
};
const files = walk('./src');
const unscoped = [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const m = /(LEFT\s+)?JOIN\s+users\s+(\w+)\s+ON\s+(.+)$/i.exec(line);
    if (!m) return;
    const alias = m[2];
    // the ON clause may continue on the next line
    const clause = (m[3] + ' ' + (lines[i + 1] || '')).toLowerCase();
    if (!clause.includes(`${alias.toLowerCase()}.tenant_id`)) {
      unscoped.push(`${file.replace(/\\/g, '/')}:${i + 1}  ${line.trim()}`);
    }
  });
}
console.log(`\nSTATIC SWEEP — JOIN users with no tenant predicate: ${unscoped.length}`);
unscoped.forEach((u) => console.log('  ' + u));

const pass = !rows[1].leaked && rows[0].leaked && unscoped.length === 0;
console.log(`\n${pass ? 'PASS' : 'FAIL'} — 31ed5f0 join fix`);
await pool.end();
process.exit(pass ? 0 : 1);
