// Run 120 s4 — revert the ONE write this stage's harness caused.
// The `scheduled_time_start: ""` probe succeeded (emptyToNull at
// workOrderService.js:369 is deliberate) and cleared a real value.
// Restore the column AND updated_at to their pre-probe values.
import pool from './src/db/pool.js';

const ID = 'a85b7ae6-3004-49fb-9f20-62f38fed3d39';
const before = await pool.query('select scheduled_time_start, updated_at from work_orders where id=$1', [ID]);
console.log('now:   ', before.rows[0]);

await pool.query(
  `update work_orders
      set scheduled_time_start = '00:30:00'::time,
          updated_at = '2026-08-20T10:03:44.830Z'::timestamptz
    where id = $1`, [ID]);

const after = await pool.query('select scheduled_time_start, updated_at from work_orders where id=$1', [ID]);
console.log('after: ', after.rows[0]);
console.log(
  after.rows[0].scheduled_time_start === '00:30:00' &&
  after.rows[0].updated_at.toISOString() === '2026-08-20T10:03:44.830Z'
    ? 'REVERT OK — row byte-identical to pre-probe state'
    : 'REVERT FAILED');
await pool.end();
