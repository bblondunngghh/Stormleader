import pg from 'pg';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const poolConfig = { connectionString: config.DATABASE_URL };

// Railway Postgres requires SSL in production
if (config.NODE_ENV === 'production') {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new pg.Pool(poolConfig);

pool.on('connect', () => {
  logger.info('Database pool connected');
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

export default pool;
