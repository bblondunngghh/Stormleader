// Run 76 s1 — reproduce the impactedAssetService 42703 with NET ZERO writes.
// Everything runs inside a transaction that is ALWAYS rolled back.
import pool from './src/db/pool.js';

const client = await pool.connect();
try {
  await client.query('BEGIN');

  // 1) Is there a storm event that actually intersects an existing lead's property?
  const { rows: impacted } = await client.query(
    `SELECT l.id AS lead_id, l.tenant_id, se.id AS storm_event_id
     FROM leads l
     JOIN properties p ON l.property_id = p.id
     JOIN storm_events se ON ST_Intersects(se.geom, p.location)
     WHERE l.deleted_at IS NULL AND p.location IS NOT NULL
     LIMIT 3`
  );
  console.log('leads impacted by a storm event:', impacted.length);
  if (!impacted.length) {
    console.log('NOTE: no intersecting rows right now — the bug is still unconditional, proven below on a real tenant.');
  }

  const tenantId = impacted[0]?.tenant_id
    ?? (await client.query(`SELECT tenant_id FROM users LIMIT 1`)).rows[0].tenant_id;
  const leadId = impacted[0]?.lead_id
    ?? (await client.query(`SELECT id FROM leads WHERE deleted_at IS NULL LIMIT 1`)).rows[0].id;
  console.log('tenant:', tenantId, '| lead:', leadId);
  const { rows: [{ n }] } = await client.query(`SELECT COUNT(*)::int n FROM users WHERE tenant_id=$1`, [tenantId]);
  console.log('users in that tenant:', n);

  // 2) CURRENT code, verbatim from impactedAssetService.js:47-56
  console.log('\n--- CURRENT query (with u.is_active) ---');
  try {
    const r = await client.query(
      `INSERT INTO notifications (tenant_id, user_id, type, title, body, reference_type, reference_id)
       SELECT u.tenant_id, u.id, 'storm_alert',
              'Property re-impacted by storm',
              $2,
              'lead', $3
       FROM users u
       WHERE u.tenant_id = $1
         AND u.is_active = true`,
      [tenantId, 'QA repro body', leadId]
    );
    console.log('  inserted:', r.rowCount, '<-- unexpected, bug would be gone');
  } catch (e) {
    console.log('  THROWS:', e.code, '-', e.message);
    await client.query('ROLLBACK');
    await client.query('BEGIN');
  }

  // 3) FIXED query — predicate dropped, matching notificationService.js:35-37
  console.log('\n--- FIXED query (no is_active predicate) ---');
  const r2 = await client.query(
    `INSERT INTO notifications (tenant_id, user_id, type, title, body, reference_type, reference_id)
     SELECT u.tenant_id, u.id, 'storm_alert',
            'Property re-impacted by storm',
            $2,
            'lead', $3
     FROM users u
     WHERE u.tenant_id = $1`,
    [tenantId, 'QA repro body', leadId]
  );
  console.log('  inserted:', r2.rowCount, 'notification row(s) — one per tenant user. Works.');
} finally {
  await client.query('ROLLBACK');
  client.release();
  console.log('\nROLLED BACK — net zero DB writes.');
  await pool.end();
}
