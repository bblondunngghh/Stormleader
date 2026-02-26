import bcrypt from 'bcryptjs';
import pool from './pool.js';
import logger from '../utils/logger.js';

async function seedWaterloo() {
  try {
    // Check if waterloo user already exists
    const { rows: existing } = await pool.query(
      `SELECT u.id FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1 AND t.slug = $2`,
      ['waterlooconstruction1@gmail.com', 'waterloo']
    );

    if (existing.length > 0) {
      logger.info('Waterloo user already exists — skipping seed');
      return;
    }

    // Ensure tenant exists
    const { rows: tenantRows } = await pool.query(
      `SELECT id FROM tenants WHERE slug = $1`, ['waterloo']
    );

    let tenantId;
    if (tenantRows.length > 0) {
      tenantId = tenantRows[0].id;
    } else {
      const { rows: [t] } = await pool.query(
        `INSERT INTO tenants (name, slug, subscription_tier) VALUES ($1, $2, $3) RETURNING id`,
        ['Waterloo Construction', 'waterloo', 'pro']
      );
      tenantId = t.id;
    }
    logger.info(`Tenant: ${tenantId}`);

    // Create user
    const hash = await bcrypt.hash('2Wealth&health', 10);
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [tenantId, 'waterlooconstruction1@gmail.com', hash, 'Waterloo', 'Admin', 'admin']
    );
    logger.info(`User: ${user.id}`);

    // Pipeline stages — best effort
    try {
      const { rows: tc } = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_stages') AS e`
      );
      if (tc[0].e) {
        const stages = ['new','contacted','appt_set','inspected','estimate_sent','negotiating','sold','in_production','on_hold','lost'];
        for (let i = 0; i < stages.length; i++) {
          await pool.query(
            `INSERT INTO pipeline_stages (tenant_id, key, label, color, position, is_won, is_lost, is_default, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) ON CONFLICT DO NOTHING`,
            [tenantId, stages[i], stages[i].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
             'oklch(0.72 0.19 250)', i, stages[i] === 'sold', stages[i] === 'lost', stages[i] === 'new']
          );
        }
        logger.info('Pipeline stages seeded');
      }
    } catch (e) {
      logger.warn('Pipeline stages skipped');
    }

    logger.info('=== Waterloo seed complete ===');
  } catch (err) {
    // Log but do NOT exit with error — let the server start
    logger.error({ err }, 'Waterloo seed error (non-fatal)');
  } finally {
    await pool.end();
  }
}

seedWaterloo();
