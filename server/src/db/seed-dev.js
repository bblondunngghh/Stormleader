/**
 * Dev-only seed script: creates a test tenant + user for local development.
 * Usage: node server/src/db/seed-dev.js
 *
 * Login with: email=brandon, password=1234, tenant=waterloo
 */
import bcrypt from 'bcryptjs';
import pool from './pool.js';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create tenant "waterloo" if not exists
    const { rows: existingTenant } = await client.query(
      `SELECT id FROM tenants WHERE slug = 'waterloo'`
    );

    let tenantId;
    if (existingTenant.length > 0) {
      tenantId = existingTenant[0].id;
      console.log('Tenant "waterloo" already exists:', tenantId);
    } else {
      const { rows } = await client.query(
        `INSERT INTO tenants (name, slug, subscription_tier, subscription_status, onboarding_completed)
         VALUES ('Waterloo Roofing', 'waterloo', 'pro', 'active', true)
         RETURNING id`
      );
      tenantId = rows[0].id;
      console.log('Created tenant "waterloo":', tenantId);
    }

    // Create user "brandon" if not exists
    const { rows: existingUser } = await client.query(
      `SELECT id FROM users WHERE email = 'brandon' AND tenant_id = $1`,
      [tenantId]
    );

    if (existingUser.length > 0) {
      // Update password to 1234
      const hash = await bcrypt.hash('1234', 10);
      await client.query(
        `UPDATE users SET password_hash = $1 WHERE id = $2`,
        [hash, existingUser[0].id]
      );
      console.log('Updated existing user "brandon" password to 1234');
    } else {
      const hash = await bcrypt.hash('1234', 10);
      await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
         VALUES ($1, 'brandon', $2, 'Brandon', 'Admin', 'admin')`,
        [tenantId, hash]
      );
      console.log('Created user "brandon" with password 1234');
    }

    await client.query('COMMIT');
    console.log('\nLogin with:\n  Email: brandon\n  Password: 1234\n  Tenant: waterloo');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
