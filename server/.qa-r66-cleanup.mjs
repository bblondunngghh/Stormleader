// Run 66 cleanup — removes ONLY the rows the Axis D sweep created.
// Deletes by explicit id (gathered from the garbage signature) rather than by a
// time window, so a real row created during the run can never be caught.
// Pass --delete to act; default is inspect-only.
import pool from './src/db/pool.js';

const DELETE = process.argv.includes('--delete');
const SINCE = "now() - interval '120 minutes'";

// Every payload the sweep sent stringifies to one of these exact values.
const GARBAGE = ['12345', 'true', '{"x","y"}', '{"nested":{"deep":1}}', '{"{\\"a\\":[1,2]}"}'];

const targets = [
  ['automations', 'automations', 'name'],
  ['contract templates', 'contract_templates', 'name'],
  ['subcontractors', 'subcontractors', 'name'],
  ['estimate templates', 'estimate_templates', 'name'],
];

let total = 0;
for (const [label, table, col] of targets) {
  try {
    const { rows } = await pool.query(
      `SELECT id, ${col} FROM ${table}
       WHERE created_at > ${SINCE} AND ${col} = ANY($1::text[])`,
      [GARBAGE]
    );
    console.log(`${label.padEnd(20)} garbage rows: ${rows.length}`);
    if (DELETE && rows.length) {
      const { rowCount } = await pool.query(`DELETE FROM ${table} WHERE id = ANY($1::uuid[])`, [rows.map((r) => r.id)]);
      console.log(`  -> deleted ${rowCount}`);
      total += rowCount;
    }
  } catch (e) {
    console.log(`${label.padEnd(20)} SKIP: ${e.message.slice(0, 80)}`);
  }
}

// The two contacts this run created by hand while isolating the 22001 bug.
const { rows: cts } = await pool.query(
  `SELECT id, first_name, phone FROM contacts
   WHERE created_at > ${SINCE} AND (first_name = 'qa2026ctl' OR phone IN ('555-1234','555-9999'))`
);
console.log(`${'contacts (manual)'.padEnd(20)} garbage rows: ${cts.length}`);
if (DELETE && cts.length) {
  const { rowCount } = await pool.query(`DELETE FROM contacts WHERE id = ANY($1::uuid[])`, [cts.map((r) => r.id)]);
  console.log(`  -> deleted ${rowCount}`);
  total += rowCount;
}

console.log(DELETE ? `\nTOTAL DELETED: ${total}` : `\n(inspect only — pass --delete to remove)`);
process.exit(0);
