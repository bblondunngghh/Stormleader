import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './pool.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows: applied } = await client.query('SELECT name FROM _migrations ORDER BY name');
    const appliedSet = new Set(applied.map((r) => r.name));

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending = files.filter((f) => !appliedSet.has(f));

    if (pending.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      const noTransaction = sql.includes('@notransaction');

      if (noTransaction) {
        // Run without transaction wrapper (needed for ALTER TYPE ADD VALUE)
        try {
          await client.query(sql);
          await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
          logger.info(`Applied migration (no-tx): ${file}`);
        } catch (err) {
          logger.error({ err }, `Failed migration: ${file}`);
          throw err;
        }
      } else {
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          logger.info(`Applied migration: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          logger.error({ err }, `Failed migration: ${file}`);
          throw err;
        }
      }
    }

    logger.info(`All migrations applied (${pending.length} new)`);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
