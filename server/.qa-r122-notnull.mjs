// Run 122-s1 — NEW DIMENSION: EXPLICIT `null` ON A NOT-NULL WHITELISTED COLUMN.
// Type confusion (wrong scalar/jsonb TYPE) was closed in Runs 114/117. `null` is a
// different animal: it is valid JSON, passes every `typeof` guard, and an unset
// form control sends it routinely. Postgres answers 23502 (not_null_violation),
// which is NOT in errorHandler.js PG_BAD_INPUT_CODES -> 500.
// Set difference: (fields in an allowedFields whitelist) INTERSECT (NOT NULL columns).
import fs from 'fs';
import path from 'path';
import pool from './src/db/pool.js';

const SRC = 'C:/Projects/stormleads/server/src';
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js') && !e.name.endsWith('.bak')) files.push(p);
  }
})(SRC);

// 1. every allowedFields whitelist + the table its UPDATE targets
const whitelists = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = f.replace(/\\/g, '/').replace('C:/Projects/stormleads/', '');
  for (const m of src.matchAll(/allowedFields\s*=\s*\[([\s\S]{0,600}?)\]/g)) {
    const fields = [...m[1].matchAll(/'([a-z_0-9]+)'/g)].map(x => x[1]);
    const after = src.slice(m.index, m.index + 2500);
    const t = after.match(/UPDATE\s+([a-z_0-9]+)\s+SET/i);
    const line = src.slice(0, m.index).split('\n').length;
    whitelists.push({ file: rel, line, table: t ? t[1] : null, fields });
  }
}

// 2. NOT NULL columns per table (excluding ones with a default that the client cannot reach)
const notNull = {};
const rows = (await pool.query(
  `SELECT table_name, column_name, is_nullable, column_default, data_type, udt_name
     FROM information_schema.columns
    WHERE table_schema='public' ORDER BY table_name, ordinal_position`
)).rows;
for (const r of rows) {
  if (r.is_nullable === 'NO') (notNull[r.table_name] ||= []).push({ c: r.column_name, d: r.column_default, t: r.udt_name });
}

// 3. intersect
const reachable = [];
for (const w of whitelists) {
  if (!w.table || !notNull[w.table]) continue;
  const nn = notNull[w.table].map(x => x.c);
  const hit = w.fields.filter(f => nn.includes(f));
  if (hit.length) reachable.push({ ...w, notNullFields: hit });
}

fs.writeFileSync('C:/tmp/qa-r122-notnull.json', JSON.stringify({ whitelists, reachable }, null, 1));
console.log('allowedFields whitelists found:', whitelists.length,
  '| with a resolved table:', whitelists.filter(w => w.table).length);
console.log('whitelists with NO resolvable UPDATE table (check by hand):');
whitelists.filter(w => !w.table).forEach(w => console.log('   ', w.file + ':' + w.line, '[' + w.fields.slice(0, 8).join(',') + ']'));
console.log('\n=== NOT NULL COLUMNS REACHABLE FROM A CLIENT PATCH BODY ===');
if (!reachable.length) console.log('  none');
for (const r of reachable) {
  console.log(`  ${r.table.padEnd(20)} <- ${r.file}:${r.line}`);
  for (const f of r.notNullFields) {
    const meta = notNull[r.table].find(x => x.c === f);
    console.log(`      ${f.padEnd(16)} ${meta.t.padEnd(12)} default=${meta.d || 'NONE'}`);
  }
}
await pool.end();
