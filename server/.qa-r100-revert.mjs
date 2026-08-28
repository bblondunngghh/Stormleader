// Revert the ONE state change this run's sweep caused that is not self-consistent:
// PATCH /api/crm/work-orders/:id/complete (empty body) completed a real work order.
// The route is CORRECT (an action route needs no body) — this was a tester-scope error.
// Seed pattern: untouched rows have updated_at == created_at. Restore to that.
import pool from './src/db/pool.js';
const WO='5b9b4ed9-2b8e-467c-a4bf-0251550c0f66';
const b=(await pool.query(`SELECT id,status,completed_at,created_at,updated_at FROM work_orders WHERE id=$1`,[WO])).rows[0];
console.log('BEFORE:',JSON.stringify(b));
if(b.status!=='completed'||!b.completed_at||b.completed_at.toISOString().slice(0,10)!=='2026-08-28'){
  console.log('ABORT: row is not in the state this run created — leaving it alone.');process.exit(0);
}
const r=await pool.query(
  `UPDATE work_orders SET status='pending', completed_at=NULL, updated_at=created_at
   WHERE id=$1 AND status='completed' AND completed_at::date='2026-08-28' RETURNING id,status,completed_at,updated_at`,[WO]);
console.log('rowCount:',r.rowCount);
console.log('AFTER :',JSON.stringify(r.rows[0]));
console.log('WO status domain now:',JSON.stringify((await pool.query(`SELECT status,count(*)::int n FROM work_orders GROUP BY 1`)).rows));
await pool.end();
