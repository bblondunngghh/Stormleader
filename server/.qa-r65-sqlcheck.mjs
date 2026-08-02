import pool from './src/db/pool.js';
const c = await pool.connect();
try {
  await c.query('BEGIN');
  try {
    await c.query(`UPDATE skip_trace_usage SET job_id = $1
       WHERE tenant_id = $2 AND job_id IS NULL
       ORDER BY created_at DESC LIMIT 1`, ['test-job','791bb51d-3293-4839-92e9-bd4d4f873af2']);
    console.log('RESULT: query ACCEPTED by Postgres (no bug)');
  } catch (e) {
    console.log('RESULT: POSTGRES REJECTS IT');
    console.log('  code:', e.code, '| severity:', e.severity);
    console.log('  message:', e.message);
    console.log('  position:', e.position);
  }
  await c.query('ROLLBACK');
} finally { c.release(); await pool.end(); }
