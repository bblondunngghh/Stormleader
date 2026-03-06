import cron from 'node-cron';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { ingestMRMS } from './mrmsIngester.js';
import { ingestNWS } from './nwsIngester.js';
import { ingestSPC } from './spcIngester.js';
import { checkAndAlert } from '../services/alertService.js';
import { correctAllPending } from '../services/windDriftService.js';
import { autoImportForStorms } from '../services/countyService.js';

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
      await checkAndAlert();
      // Auto-import county property data for areas with recent storms
      await autoImportForStorms().catch(err =>
        logger.error({ err }, 'Scheduler: storm auto-import failed')
      );
    } catch (err) {
      logger.error({ err }, 'Scheduler: MRMS ingestion failed');
    }
  });

  // NWS active alerts — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Scheduler: running NWS ingestion');
    try {
      await ingestNWS();
      await checkAndAlert();
      await autoImportForStorms().catch(err =>
        logger.error({ err }, 'Scheduler: storm auto-import failed')
      );
    } catch (err) {
      logger.error({ err }, 'Scheduler: NWS ingestion failed');
    }
  });

  // SPC hail reports — every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.info('Scheduler: running SPC ingestion');
    try {
      await ingestSPC();
      await correctAllPending();
      await checkAndAlert();
      await autoImportForStorms().catch(err =>
        logger.error({ err }, 'Scheduler: storm auto-import failed')
      );
    } catch (err) {
      logger.error({ err }, 'Scheduler: SPC ingestion failed');
    }
  });

  // Monthly skip trace batch billing — 1st of every month at midnight
  cron.schedule('0 0 1 * *', async () => {
    logger.info('Scheduler: running monthly skip trace batch billing');
    try {
      const { processBatchBilling } = await import('../services/stripeService.js');
      const results = await processBatchBilling();
      logger.info({ results }, 'Scheduler: batch billing complete');
    } catch (err) {
      logger.error({ err }, 'Scheduler: batch billing failed');
    }
  });

  logger.info('Ingestion scheduler started (MRMS: 30m, NWS: 5m, SPC: 15m)');
}
