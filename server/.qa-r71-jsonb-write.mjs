// Run 71 — JSONB WRITE-PATH validation probe.
// Question: do write routes still accept malformed shapes INTO jsonb columns?
// That is the ROOT CAUSE of the stored junk the survey found.
//
// DB-COST DISCIPLINE: every PATCH target already holds [null] in the column under
// test, so writing [null] back is a NET-ZERO data change. Non-array shapes are
// restored to [null] immediately after each probe.
import { PATCH, GET, snip } from './.qa-r71-lib.mjs';
import pool from './src/db/pool.js';

const WO = '89a5ed32-231b-4f19-9c2f-c5776e9858a6';   // work_orders.line_items = [null]
const INV = '7da721cc-9436-400b-9808-09d1b4f62a7a';  // invoices.line_items    = [null]
const EST = '1252940b-b691-4182-8d4f-680ac71a0711';  // estimates.line_items   = [null] (control: has a guard)

const SHAPES = [
  ['[null]            ', [null]],
  ['"a string"        ', 'a string'],
  ['{"not":"an array"}', { not: 'an array' }],
  ['12345             ', 12345],
  ['true              ', true],
  ['[1,"",null]       ', [1, '', null]],
];

async function stored(table, id) {
  const r = await pool.query(`SELECT line_items FROM ${table} WHERE id = $1`, [id]);
  return JSON.stringify(r.rows[0] && r.rows[0].line_items);
}

async function probe(label, path, table, id) {
  console.log('\n' + '='.repeat(74));
  console.log(label, ' ', path);
  console.log('='.repeat(74));
  console.log('  stored BEFORE:', await stored(table, id));
  for (const [name, val] of SHAPES) {
    const r = await PATCH(path, { line_items: val });
    const after = await stored(table, id);
    const accepted = r.status >= 200 && r.status < 300;
    const changed = after !== '[null]';
    let verdict;
    if (!accepted) verdict = 'REJECTED ' + r.status;
    else if (changed) verdict = '*** ACCEPTED + STORED -> ' + after.slice(0, 50);
    else verdict = 'accepted (value unchanged)';
    console.log(`  ${name}  ->  ${String(r.status).padEnd(4)} ${verdict}`);
    // restore to the original [null] so net data change is zero
    if (changed) {
      await pool.query(`UPDATE ${table} SET line_items = $1 WHERE id = $2`, [JSON.stringify([null]), id]);
    }
  }
  console.log('  stored AFTER (restored):', await stored(table, id));
}

await probe('WORK ORDER  (no write-path guard found)', `/api/crm/work-orders/${WO}`, 'work_orders', WO);
await probe('INVOICE     (no write-path guard found)', `/api/crm/invoices/${INV}`, 'invoices', INV);
await probe('ESTIMATE    (CONTROL - has validateJsonShapes)', `/api/estimates/${EST}`, 'estimates', EST);

await pool.end();
