// Verify the impactedAssetService fix: EXPLAIN validates every identifier against
// the live schema WITHOUT executing the INSERT. Net zero writes.
import fs from 'fs';
import pool from './src/db/pool.js';

const src = fs.readFileSync('./src/services/impactedAssetService.js', 'utf8');
console.log('is_active still referenced in the file?', /is_active/.test(src));

const tenantId = (await pool.query(`SELECT tenant_id FROM users LIMIT 1`)).rows[0].tenant_id;
const leadId = (await pool.query(`SELECT id FROM leads WHERE deleted_at IS NULL LIMIT 1`)).rows[0].id;

// the exact statement now in the file
const sql = `INSERT INTO notifications (tenant_id, user_id, type, title, body, reference_type, reference_id)
       SELECT u.tenant_id, u.id, 'storm_alert',
              'Property re-impacted by storm',
              $2,
              'lead', $3
       FROM users u
       WHERE u.tenant_id = $1`;

try {
  const r = await pool.query('EXPLAIN ' + sql, [tenantId, 'verify', leadId]);
  console.log('EXPLAIN OK — every identifier resolves:');
  r.rows.forEach((x) => console.log('   ', x['QUERY PLAN']));
} catch (e) {
  console.log('EXPLAIN FAILED:', e.code, e.message);
}

// and prove the OLD statement still fails, so the test is meaningful
try {
  await pool.query('EXPLAIN ' + sql + ' AND u.is_active = true', [tenantId, 'verify', leadId]);
  console.log('\nold statement: unexpectedly OK');
} catch (e) {
  console.log('\nold statement still fails as expected:', e.code, '-', e.message);
}
await pool.end();
