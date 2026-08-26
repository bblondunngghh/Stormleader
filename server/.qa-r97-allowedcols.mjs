// Run 97 (s1-api-test) — SET DIFFERENCE: PATCH `allowedFields` whitelists vs REAL DB columns.
//
// WHY THIS IS NEW: Run 82 closed "client payload keys vs server allowedFields" (they match).
// Nobody has ever checked the OTHER side of that whitelist — `allowedFields` vs the columns
// that actually exist on the table it UPDATEs. Every one of these lists is spliced directly
// into `UPDATE <table> SET <field> = $n`, so a name in the list that is NOT a column makes
// that PATCH fail with 42703 "column does not exist" -> a 500, but ONLY when the client
// happens to send that exact field. A sweep that PATCHes one known-good field never sees it.
//
// Read-only: information_schema + static source. Zero writes.
//
// Self-test (`--selftest`): plants two known positives (a bogus field, and a real column
// moved to the wrong table) and asserts the diff rediscovers both.
import pool from './src/db/pool.js';
import fs from 'fs';
import path from 'path';

const SERVICES = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : './src/services';
const SELFTEST = process.argv.includes('--selftest');

// Strip comments ONLY (never track quotes — Run 86 trap: an apostrophe in prose
// destroys a naive string-stripper). Keep newlines so offsets/line numbers survive.
function stripComments(src) {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    // line comment — but not the // inside a URL scheme (`http://`)
    if (src[i] === '/' && src[i + 1] === '/' && src[i - 1] !== ':') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
      out += '\n';
      continue;
    }
    if (src[i] === '/' && src[i + 1] === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += '  ';
      i++;
      continue;
    }
    out += src[i];
  }
  if (out.length !== src.length) throw new Error('stripComments changed length');
  return out;
}

// Bracket-scan from the `[` so a nested array/object can never truncate the span.
function scanBracket(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

function findWhitelists(src, file) {
  const clean = stripComments(src);
  const out = [];
  // any `const <name>Fields = [` / `allowedFields = [`
  const re = /\b(allowedFields|allowed_fields)\s*=\s*\[/g;
  let m;
  while ((m = re.exec(clean))) {
    const open = clean.indexOf('[', m.index);
    const close = scanBracket(clean, open);
    if (close < 0) continue;
    const span = clean.slice(open + 1, close);
    const fields = [...span.matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] || x[2]);
    // Find the table this list is spliced into: the next UPDATE <table> SET.
    const after = clean.slice(close);
    const upd = after.match(/UPDATE\s+(\w+)\s+SET/i) || after.match(/INTO\s+(\w+)\s*\(/i);
    out.push({
      file,
      line: lineOf(clean, m.index),
      table: upd ? upd[1] : null,
      fields,
    });
  }
  return out;
}

const files = fs.readdirSync(SERVICES).filter((f) => f.endsWith('.js'));
let lists = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(SERVICES, f), 'utf8');
  lists.push(...findWhitelists(src, f));
}

if (SELFTEST) {
  // known positive 1: a field that is not a column anywhere
  lists.push({ file: 'SELFTEST', line: 0, table: 'leads', fields: ['stage', 'qa_bogus_column_xyz'] });
  // known positive 2: a REAL column, but on the wrong table
  lists.push({ file: 'SELFTEST', line: 0, table: 'leads', fields: ['tax_rate'] });
}

console.log(`whitelists found: ${lists.length} across ${files.length} service files\n`);

const colCache = new Map();
async function columnsOf(table) {
  if (colCache.has(table)) return colCache.get(table);
  const { rows } = await pool.query(
    'SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = current_schema()',
    [table]
  );
  const set = new Set(rows.map((r) => r.column_name));
  colCache.set(table, set);
  return set;
}

const defects = [];
const noTable = [];

for (const L of lists) {
  if (!L.table) { noTable.push(L); continue; }
  const cols = await columnsOf(L.table);
  if (cols.size === 0) {
    noTable.push({ ...L, why: `table '${L.table}' has no columns / does not exist` });
    continue;
  }
  const missing = L.fields.filter((f) => !cols.has(f));
  const tag = missing.length ? 'DEFECT' : '  ok  ';
  console.log(`  ${tag} ${L.file}:${L.line}  UPDATE ${L.table}  (${L.fields.length} fields)${missing.length ? '  -> NOT COLUMNS: ' + missing.join(', ') : ''}`);
  if (missing.length) defects.push({ ...L, missing });
}

if (noTable.length) {
  console.log('\n--- could not resolve a target table (skipped, not a verdict) ---');
  for (const L of noTable) console.log(`  ${L.file}:${L.line}  ${L.why || 'no UPDATE/INSERT found after the list'}  fields=${L.fields.length}`);
}

console.log(`\nDEFECTS: ${defects.length}`);
for (const d of defects) console.log(`  ${d.file}:${d.line}  ${d.table}  <-  ${d.missing.join(', ')}`);

if (SELFTEST) {
  const found = defects.filter((d) => d.file === 'SELFTEST');
  const gotBogus = found.some((d) => d.missing.includes('qa_bogus_column_xyz'));
  const gotWrongTable = found.some((d) => d.missing.includes('tax_rate'));
  console.log(`\nSELFTEST: bogus-field=${gotBogus ? 'CAUGHT' : 'MISSED'}  wrong-table-column=${gotWrongTable ? 'CAUGHT' : 'MISSED'}  => ${gotBogus && gotWrongTable ? 'PASS 2/2' : 'FAIL'}`);
}

await pool.end();
