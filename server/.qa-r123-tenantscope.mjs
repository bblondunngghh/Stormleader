// Run 123-s1 — TENANT-SCOPE AUDIT OF SQL. A dead-uuid probe CANNOT detect a missing
// `tenant_id` in a WHERE clause (a dead uuid 404s either way). Only a REAL foreign-tenant
// id can — and this tenant holds ~0 foreign rows. So audit the SQL statically instead:
// every statement that keys on a row id must also constrain tenant_id (or be explicitly
// public / user-scoped / platform-admin).
import fs from 'fs';
import path from 'path';

const ROOT = 'src';
const files = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p);
  else if (e.name.endsWith('.js') && !e.name.includes('.bak')) files.push(p);
});
walk(ROOT);

// Extract every backtick template literal that looks like SQL.
const SQLRE = /`([^`]*?(?:SELECT|INSERT|UPDATE|DELETE)[^`]*?)`/gis;
const findings = [];
let total = 0;

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  let m;
  SQLRE.lastIndex = 0;
  while ((m = SQLRE.exec(src))) {
    const sql = m[1];
    if (!/\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(sql)) continue;
    const line = src.slice(0, m.index).split('\n').length;
    total++;
    const isWrite = /^\s*(UPDATE|DELETE)/im.test(sql);
    const hasTenant = /tenant_id/i.test(sql);
    const hasUser = /\buser_id\s*=\s*\$/i.test(sql);
    // does it key on a row id supplied by the caller?
    const keysOnId = /\b(?:\w+\.)?id\s*=\s*\$\d/i.test(sql) || /\b\w+_id\s*=\s*\$\d/i.test(sql);
    if (!keysOnId) continue;
    if (hasTenant || hasUser) continue;
    findings.push({
      file: f.replace(/\\/g, '/'), line, isWrite,
      sql: sql.replace(/\s+/g, ' ').trim().slice(0, 180),
    });
  }
}

console.log(`scanned ${files.length} files, ${total} SQL literals`);
console.log(`\n=== ${findings.length} id-keyed statements with NO tenant_id and NO user_id ===\n`);
const writes = findings.filter((x) => x.isWrite);
const reads = findings.filter((x) => !x.isWrite);
console.log(`--- WRITES (${writes.length}) ---`);
writes.forEach((x) => console.log(`${x.file}:${x.line}\n    ${x.sql}\n`));
console.log(`--- READS (${reads.length}) ---`);
reads.forEach((x) => console.log(`${x.file}:${x.line}\n    ${x.sql}\n`));
fs.writeFileSync('C:/tmp/qa-r123-tenantscope.json', JSON.stringify(findings, null, 1));
