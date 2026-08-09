// Run 71 — verify the JSONB write guards. Two halves, both required:
//   (a) malformed container shapes are now REJECTED 400
//   (b) a VALID line_items array still writes successfully (happy path intact)
// (b) is the real risk of adding a guard, and is also carried-forward priority #4
// (real-payload writes — prior runs only ever sent an empty body).
import { PATCH, GET, snip } from './.qa-r71-lib.mjs';
import pool from './src/db/pool.js';

const WO = '89a5ed32-231b-4f19-9c2f-c5776e9858a6';
const INV = '7da721cc-9436-400b-9808-09d1b4f62a7a';

const BAD = [
  ['"a string"        ', 'a string'],
  ['{"not":"an array"}', { not: 'an array' }],
  ['12345             ', 12345],
  ['true              ', true],
];

async function stored(table, id) {
  const r = await pool.query(`SELECT line_items FROM ${table} WHERE id = $1`, [id]);
  return JSON.stringify(r.rows[0] && r.rows[0].line_items);
}

async function check(label, path, table, id) {
  console.log('\n' + '='.repeat(72));
  console.log(label);
  console.log('='.repeat(72));
  console.log('  stored BEFORE:', await stored(table, id));

  console.log('  --- (a) malformed shapes must be REJECTED ---');
  let rejected = 0;
  for (const [name, val] of BAD) {
    const r = await PATCH(path, { line_items: val });
    const after = await stored(table, id);
    const ok = r.status === 400 && after === '[null]';
    if (ok) rejected++;
    console.log(`    ${name} -> ${String(r.status).padEnd(4)} ${ok ? 'REJECTED, unchanged' : '*** LEAKED -> ' + after.slice(0, 40)}  ${snip(r.body, 60)}`);
  }
  console.log(`    rejected ${rejected}/${BAD.length}`);

  console.log('  --- (b) a VALID array must still WRITE (happy path) ---');
  const good = [
    { description: 'QA verify shingles', quantity: 3, unit_price: 125.5 },
    { description: 'QA verify underlayment', quantity: 1, unit_price: 400 },
  ];
  const w = await PATCH(path, { line_items: good });
  const afterGood = await stored(table, id);
  const parsed = JSON.parse(afterGood);
  const wrote = Array.isArray(parsed) && parsed.length === 2
    && parsed[0].description === 'QA verify shingles' && Number(parsed[0].unit_price) === 125.5;
  console.log(`    PATCH valid array -> ${w.status}`);
  console.log(`    stored: ${afterGood.slice(0, 120)}`);
  console.log(`    ROUND-TRIP CORRECT: ${wrote ? 'YES' : 'NO'}`);

  // restore original [null] so this run leaves the DB exactly as it found it
  await pool.query(`UPDATE ${table} SET line_items = $1 WHERE id = $2`, [JSON.stringify([null]), id]);
  console.log('  stored AFTER (restored to original):', await stored(table, id));
  return { rejected, total: BAD.length, wrote };
}

const a = await check('WORK ORDER  PATCH /api/crm/work-orders/:id', `/api/crm/work-orders/${WO}`, 'work_orders', WO);
const b = await check('INVOICE     PATCH /api/crm/invoices/:id', `/api/crm/invoices/${INV}`, 'invoices', INV);

console.log('\n' + '='.repeat(72));
console.log('SUMMARY');
console.log('  work order: rejected', a.rejected + '/' + a.total, '| valid write round-trips:', a.wrote);
console.log('  invoice   : rejected', b.rejected + '/' + b.total, '| valid write round-trips:', b.wrote);
console.log('  PASS:', a.rejected === a.total && b.rejected === b.total && a.wrote && b.wrote);
await pool.end();
