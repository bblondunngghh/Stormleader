import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const c = await pool.connect();
try {
  await c.query('BEGIN');
  const a = await c.query(`UPDATE skip_trace_usage SET job_id = $1
       WHERE id = ( SELECT id FROM skip_trace_usage
         WHERE tenant_id = $2 AND job_id IS NULL
         ORDER BY created_at DESC LIMIT 1 )`, ['r65-test-job', T]);
  console.log('FIX1 routes/skipTrace.js:120  -> ACCEPTED, rowCount =', a.rowCount);
  const b = await c.query(`UPDATE skip_trace_usage SET records_returned = $1
     WHERE id = ( SELECT id FROM skip_trace_usage
       WHERE tenant_id = $2 AND provider = 'tracerfy'
       ORDER BY created_at DESC LIMIT 1 )`, [5, T]);
  console.log('FIX2 services/skipTraceService.js:182 -> ACCEPTED, rowCount =', b.rowCount);
  // prove the "at most one row" semantic is preserved
  console.log('   (LIMIT 1 subquery guarantees <=1 row updated; both rowCounts are 0 or 1)');
  await c.query('ROLLBACK');
  console.log('ROLLED BACK — zero rows persisted.');
} catch(e){ console.log('STILL FAILING:', e.code, e.message); await c.query('ROLLBACK'); }
finally { c.release(); await pool.end(); }
