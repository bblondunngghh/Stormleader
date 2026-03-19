import pg from 'pg';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const poolConfig = { connectionString: config.DATABASE_URL };

// Enable SSL for cloud databases (Neon, Railway, Supabase)
if (config.DATABASE_URL.includes('neon.tech') || config.DATABASE_URL.includes('supabase.com') || config.NODE_ENV === 'production') {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new pg.Pool(poolConfig);

let poolConnected = false;
pool.on('connect', () => {
  if (!poolConnected) {
    poolConnected = true;
    logger.info('Database pool connected');
  }
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
});

export default pool;
