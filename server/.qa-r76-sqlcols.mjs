// Run 76 s1 — SET DIFFERENCE #2: table/column identifiers referenced in server SQL
// vs what actually exists in the database.
//
// Why: a black-box sweep can only reach handler branches that this tenant's data
// triggers. A reference to a column that does not exist (the known
// `estimates.tier_label` case) throws 42703 ONLY when that branch runs, so it is
// invisible until a user hits it. Comparing the two sets finds it statically.
//
// STRUCTURALLY UNABLE TO FIND: dynamic/interpolated identifiers, and anything in
// a query built from a variable rather than a literal template.
import fs from 'fs';
import path from 'path';
import pool from './src/db/pool.js';

const SRC = 'C:/Projects/stormleads/server/src';

// ---- live schema ----------------------------------------------------------
const { rows: cols } = await pool.query(
  `SELECT table_name, column_name FROM information_schema.columns
   WHERE table_schema='public' ORDER BY table_name, column_name`
);
const tables = new Map();          // table -> Set(columns)
for (const r of cols) {
  if (!tables.has(r.table_name)) tables.set(r.table_name, new Set());
  tables.get(r.table_name).add(r.column_name);
}
const allColumns = new Set(cols.map((r) => r.column_name));
console.log('live schema:', tables.size, 'tables,', allColumns.size, 'distinct column names');

// ---- gather SQL string literals from server source ------------------------
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(SRC);

const BT = String.fromCharCode(96);
const tplRe = new RegExp(BT + '([^' + BT + ']*)' + BT, 'g');

const KEYWORDS = new Set(['select', 'from', 'where', 'join', 'left', 'right', 'inner', 'outer', 'on',
  'and', 'or', 'not', 'null', 'is', 'as', 'order', 'by', 'group', 'having', 'limit', 'offset', 'insert',
  'into', 'values', 'update', 'set', 'delete', 'returning', 'case', 'when', 'then', 'else', 'end',
  'count', 'sum', 'avg', 'min', 'max', 'coalesce', 'distinct', 'asc', 'desc', 'exists', 'in', 'like',
  'ilike', 'between', 'union', 'all', 'with', 'over', 'partition', 'true', 'false', 'cast', 'interval',
  'now', 'current_date', 'current_timestamp', 'extract', 'date_trunc', 'nullif', 'greatest', 'least',
  'array_agg', 'json_agg', 'jsonb_agg', 'json_build_object', 'jsonb_build_object', 'string_agg',
  'lower', 'upper', 'trim', 'concat', 'length', 'round', 'abs', 'to_char', 'to_date', 'conflict',
  'do', 'nothing', 'using', 'cross', 'lateral', 'filter', 'within', 'row_number', 'rank', 'text',
  'integer', 'boolean', 'numeric', 'timestamptz', 'uuid', 'jsonb', 'json', 'date', 'int', 'bigint',
  'decimal', 'varchar', 'float', 'double', 'precision', 'unnest', 'generate_series', 'any', 'some',
  'first_value', 'last_value', 'lag', 'lead', 'percentile_cont', 'mode', 'nulls', 'first', 'last',
  'position', 'substring', 'replace', 'split_part', 'regexp_replace', 'strpos', 'left', 'right',
  'timestamp', 'time', 'zone', 'at', 'day', 'month', 'year', 'week', 'hour', 'minute', 'second',
  'st_intersects', 'st_dwithin', 'st_contains', 'st_geomfromtext', 'st_setsrid', 'st_makepoint',
  'st_x', 'st_y', 'st_astext', 'st_asgeojson', 'st_transform', 'st_buffer', 'st_area', 'st_centroid',
  'geography', 'geometry', 'srid', 'returns', 'language', 'plpgsql', 'begin', 'declare', 'if',
  'elsif', 'loop', 'return', 'new', 'old', 'trigger', 'before', 'after', 'each', 'row', 'execute',
  'function', 'procedure', 'create', 'alter', 'drop', 'table', 'index', 'constraint', 'primary',
  'key', 'foreign', 'references', 'unique', 'default', 'add', 'column', 'type', 'cascade', 'to_jsonb',
  'array', 'bool_or', 'bool_and', 'every', 'nowait', 'share', 'no', 'only', 'for', 'of', 'tablesample']);

const findings = [];
let sqlBlocks = 0;

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  tplRe.lastIndex = 0;
  let m;
  while ((m = tplRe.exec(src))) {
    const raw = m[1];
    if (!/\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i.test(raw)) continue;
    sqlBlocks++;
    const line = src.slice(0, m.index).split('\n').length;
    const rel = path.relative(SRC, f).replace(/\\/g, '/');
    // blank out ${...} interpolations and string literals so we don't parse them
    const sql = raw.replace(/\$\{[^}]*\}/g, ' ? ').replace(/'[^']*'/g, " 'lit' ");

    // ---- tables referenced: FROM x / JOIN x / INSERT INTO x / UPDATE x -----
    const tblRe = /\b(?:from|join|into|update)\s+([a-z_][a-z0-9_]*)/gi;
    let t;
    const localTables = new Set();
    const aliases = new Map();   // alias -> table
    while ((t = tblRe.exec(sql))) {
      const name = t[1].toLowerCase();
      if (KEYWORDS.has(name)) continue;
      localTables.add(name);
      // capture an alias directly after the table name
      const after = sql.slice(t.index + t[0].length);
      const am = after.match(/^\s+(?:as\s+)?([a-z][a-z0-9_]*)/i);
      if (am && !KEYWORDS.has(am[1].toLowerCase())) aliases.set(am[1].toLowerCase(), name);
      if (!tables.has(name)) {
        findings.push({ kind: 'MISSING_TABLE', file: rel, line, name, sql: raw.replace(/\s+/g, ' ').trim().slice(0, 150) });
      }
    }

    // ---- qualified columns alias.column -----------------------------------
    const qcRe = /\b([a-z][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/gi;
    let c;
    const seen = new Set();
    while ((c = qcRe.exec(sql))) {
      const al = c[1].toLowerCase();
      const col = c[2].toLowerCase();
      const tbl = aliases.get(al) || (tables.has(al) ? al : null);
      if (!tbl) continue;
      if (KEYWORDS.has(col)) continue;
      const k = tbl + '.' + col;
      if (seen.has(k)) continue;
      seen.add(k);
      const tcols = tables.get(tbl);
      if (tcols && !tcols.has(col)) {
        findings.push({ kind: 'MISSING_COLUMN', file: rel, line, name: k, sql: raw.replace(/\s+/g, ' ').trim().slice(0, 150) });
      }
    }
  }
}

console.log('SQL template blocks scanned:', sqlBlocks, 'in', files.length, 'files');
console.log('\n=== FINDINGS (' + findings.length + ') ===');
const dedup = new Map();
for (const f of findings) {
  const k = f.kind + '|' + f.name + '|' + f.file + ':' + f.line;
  if (!dedup.has(k)) dedup.set(k, f);
}
for (const f of dedup.values()) {
  console.log(`${f.kind.padEnd(15)} ${f.name.padEnd(42)} ${f.file}:${f.line}`);
  console.log(`                ${f.sql}`);
}
fs.writeFileSync('C:/tmp/qa-r76-sqlcols.json', JSON.stringify([...dedup.values()], null, 1));
await pool.end();
