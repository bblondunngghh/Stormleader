import cron from 'node-cron';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import pool from '../db/pool.js';
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
    } catch (err) {
      logger.error({ err }, 'Scheduler: NWS ingestion failed');
    }
  });

  // SPC hail reports — every 15 minutes, then auto-import county data for storm areas
  cron.schedule('*/15 * * * *', async () => {
    logger.info('Scheduler: running SPC ingestion');
    try {
      await ingestSPC();
      await correctAllPending();
      await checkAndAlert();
      // Auto-import county property data for areas with recent storms
      await autoImportForStorms().catch(err =>
        logger.error({ err }, 'Scheduler: storm auto-import failed')
      );
    } catch (err) {
      logger.error({ err }, 'Scheduler: SPC ingestion failed');
    }
  });

  // Cleanup old data — daily at 3am
  cron.schedule('0 3 * * *', async () => {
    logger.info('Scheduler: running daily cleanup');
    try {
      // Delete storm events older than 30 days
      const { rowCount: storms } = await pool.query(
        `DELETE FROM storm_events WHERE event_start < NOW() - INTERVAL '30 days'`
      );
      // Delete properties that aren't in any active storm zone and aren't linked to any lead
      const { rowCount: props } = await pool.query(
        `DELETE FROM properties p
         WHERE NOT EXISTS (
           SELECT 1 FROM storm_events se
           WHERE ST_Intersects(p.location, se.geom)
         )
         AND NOT EXISTS (
           SELECT 1 FROM leads l WHERE l.property_id = p.id
         )`
      );
      logger.info({ storms, props }, 'Daily cleanup complete');
    } catch (err) {
      logger.error({ err }, 'Scheduler: daily cleanup failed');
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

  logger.info('Ingestion scheduler started (MRMS: 30m, NWS: 5m, SPC: 15m, cleanup: 3am daily)');
}
