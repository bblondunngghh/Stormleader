import pg from 'pg';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

pool.on('connect', () => {
  logger.info('Database pool connected');
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

export default pool;
