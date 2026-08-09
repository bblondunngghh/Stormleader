// Run 71 — JSONB write-path probe, REMAINING columns.
// Snapshot -> probe -> restore, so net DB change is zero.
import { PATCH, POST, GET, snip } from './.qa-r71-lib.mjs';
import pool from './src/db/pool.js';

const BAD = [
  ['"a string"        ', 'a string'],
  ['12345             ', 12345],
  ['true              ', true],
  ['[1,2,3]           ', [1, 2, 3]],
  ['[null]            ', [null]],
];

async function col(table, id, c) {
  const r = await pool.query(`SELECT ${c} AS v FROM ${table} WHERE id = $1`, [id]);
  return JSON.stringify(r.rows[0] && r.rows[0].v);
}

async function probe({ label, path, table, id, field, method = 'PATCH' }) {
  console.log('\n' + '='.repeat(74));
  console.log(`${label}   [${field}]`);
  console.log(path);
  console.log('='.repeat(74));
  const before = await col(table, id, field);
  console.log('  snapshot BEFORE:', before.slice(0, 90));
  const findings = [];
  for (const [name, val] of BAD) {
    const send = method === 'POST' ? POST : PATCH;
    const r = await send(path, { [field]: val });
    const after = await col(table, id, field);
    const changed = after !== before;
    let verdict;
    if (r.status >= 500) { verdict = '*** 5xx SERVER ERROR *** ' + snip(r.body, 70); findings.push('5xx on ' + name.trim()); }
    else if (r.status === 400) verdict = 'rejected 400';
    else if (changed) { verdict = '*** ACCEPTED + STORED -> ' + after.slice(0, 60); findings.push('stored ' + name.trim()); }
    else verdict = `accepted ${r.status} (value unchanged)`;
    console.log(`  ${name} -> ${String(r.status).padEnd(4)} ${verdict}`);
    if (changed) {
      await pool.query(`UPDATE ${table} SET ${field} = $1::jsonb WHERE id = $2`, [before === 'null' ? null : before, id]);
    }
  }
  const restored = await col(table, id, field);
  console.log('  restored:', restored.slice(0, 90), restored === before ? '  [MATCHES SNAPSHOT]' : '  *** RESTORE MISMATCH ***');
  return findings;
}

const ids = {};
const lead = (await GET('/api/crm/leads')).body;
ids.lead = (Array.isArray(lead) ? lead : Object.values(lead).find(Array.isArray))[0].id;
const con = (await GET('/api/crm/contracts')).body;
const conArr = Array.isArray(con) ? con : Object.values(con).find(Array.isArray);
ids.contract = conArr[0] && conArr[0].id;

const all = {};
all.leadCustomFields = await probe({
  label: 'LEAD custom_fields (written via jsonb || concat operator)',
  path: `/api/crm/leads/${ids.lead}`, table: 'leads', id: ids.lead, field: 'custom_fields',
});
if (ids.contract) {
  all.contractContent = await probe({
    label: 'CONTRACT content',
    path: `/api/crm/contracts/${ids.contract}`, table: 'contracts', id: ids.contract, field: 'content',
  });
}

console.log('\n' + '='.repeat(74));
console.log('FINDINGS');
for (const [k, v] of Object.entries(all)) {
  console.log(`  ${k}: ${v.length ? v.join(', ') : 'clean'}`);
}
await pool.end();
