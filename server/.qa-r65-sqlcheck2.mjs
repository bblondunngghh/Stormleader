import pool from './src/db/pool.js';
const c = await pool.connect();
try {
  await c.query('BEGIN');
  try {
    await c.query(`UPDATE skip_trace_usage
     SET records_returned = $1
     WHERE tenant_id = $2 AND provider = 'tracerfy'
     ORDER BY created_at DESC
     LIMIT 1`, [5,'791bb51d-3293-4839-92e9-bd4d4f873af2']);
    console.log('svc:183 RESULT: ACCEPTED (no bug)');
  } catch (e) { console.log('svc:183 RESULT: REJECTED |', e.code, '|', e.message); }
  await c.query('ROLLBACK');
} finally { c.release(); await pool.end(); }
