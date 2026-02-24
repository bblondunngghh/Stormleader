import cron from 'node-cron';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { ingestMRMS } from './mrmsIngester.js';
import { ingestNWS } from './nwsIngester.js';
import { ingestSPC } from './spcIngester.js';

export function startScheduler() {
  if (config.NODE_ENV === 'test') {
    logger.info('Scheduler disabled in test environment');
    return;
  }

  // MRMS MESH data — every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    logger.info('Scheduler: running MRMS ingestion');
    try {
      await ingestMRMS();
    } catch (err) {
      logger.error({ err }, 'Scheduler: MRMS ingestion failed');
    }
  });

  // NWS active alerts — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Scheduler: running NWS ingestion');
    try {
      await ingestNWS();
    } catch (err) {
      logger.error({ err }, 'Scheduler: NWS ingestion failed');
    }
  });

  // SPC hail reports — every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.info('Scheduler: running SPC ingestion');
    try {
      await ingestSPC();
    } catch (err) {
      logger.error({ err }, 'Scheduler: SPC ingestion failed');
    }
  });

  logger.info('Ingestion scheduler started (MRMS: 30m, NWS: 5m, SPC: 15m)');
}
