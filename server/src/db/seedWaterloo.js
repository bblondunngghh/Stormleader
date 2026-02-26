import bcrypt from 'bcryptjs';
import pool from './pool.js';
import logger from '../utils/logger.js';

async function seedWaterloo() {
  try {
    // Clean up any orphans from previous attempts
    await pool.query(`DELETE FROM users WHERE email = $1`, ['waterlooconstruction1@gmail.com']);
    await pool.query(`DELETE FROM tenants WHERE slug = $1`, ['waterloo']);

    // Create tenant
    const { rows: [tenant] } = await pool.query(
      `INSERT INTO tenants (name, slug, subscription_tier)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['Waterloo Construction', 'waterloo', 'pro']
    );
    logger.info(`Tenant: ${tenant.id}`);

    // Create user
    const password = '2Wealth&health';
    const hash = await bcrypt.hash(password, 10);
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [tenant.id, 'waterlooconstruction1@gmail.com', hash, 'Waterloo', 'Admin', 'admin']
    );
    logger.info(`User: ${user.id}`);

    // Pipeline stages — best effort, skip if table doesn't exist
    try {
      const { rows: tableCheck } = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_stages') AS exists`
      );
      if (tableCheck[0].exists) {
        const stages = [
          { key: 'new', label: 'New', position: 0, is_won: false, is_lost: false, is_default: true },
          { key: 'contacted', label: 'Contacted', position: 1, is_won: false, is_lost: false, is_default: false },
          { key: 'appt_set', label: 'Appt Set', position: 2, is_won: false, is_lost: false, is_default: false },
          { key: 'inspected', label: 'Inspected', position: 3, is_won: false, is_lost: false, is_default: false },
          { key: 'estimate_sent', label: 'Estimate Sent', position: 4, is_won: false, is_lost: false, is_default: false },
          { key: 'negotiating', label: 'Negotiating', position: 5, is_won: false, is_lost: false, is_default: false },
          { key: 'sold', label: 'Sold', position: 6, is_won: true, is_lost: false, is_default: false },
          { key: 'in_production', label: 'In Production', position: 7, is_won: false, is_lost: false, is_default: false },
          { key: 'on_hold', label: 'On Hold', position: 8, is_won: false, is_lost: false, is_default: false },
          { key: 'lost', label: 'Lost', position: 9, is_won: false, is_lost: true, is_default: false },
        ];
        for (const s of stages) {
          await pool.query(
            `INSERT INTO pipeline_stages (tenant_id, key, label, color, position, is_won, is_lost, is_default, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
             ON CONFLICT DO NOTHING`,
            [tenant.id, s.key, s.label, 'oklch(0.72 0.19 250)', s.position, s.is_won, s.is_lost, s.is_default]
          );
        }
        logger.info('Pipeline stages seeded');
      }
    } catch (stageErr) {
      logger.warn('Pipeline stages skipped (non-fatal)');
    }

    logger.info('=== Waterloo seed complete ===');
    logger.info('Login: waterlooconstruction1@gmail.com / 2Wealth&health');
    logger.info('Tenant slug: waterloo');
  } catch (err) {
    throw err;
  } finally {
    await pool.end();
  }
}

seedWaterloo().catch((err) => {
  logger.error({ err }, 'Waterloo seed failed');
  process.exit(1);
});
