import cron from 'node-cron';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import pool from '../db/pool.js';
import { ingestMRMS } from './mrmsIngester.js';
import { ingestNWS } from './nwsIngester.js';
import { ingestSPC } from './spcIngester.js';
import { backfillSPC } from './spcHistoryIngester.js';
import { checkAndAlert } from '../services/alertService.js';
import { correctAllPending } from '../services/windDriftService.js';
import { autoImportForStorms } from '../services/countyService.js';
import { checkImpactedAssetsForEvents } from '../services/impactedAssetService.js';
import { processScheduledSteps } from '../services/dripService.js';
import { sendOverdueInvoiceReminders } from '../services/emailService.js';

export function startScheduler() {
  if (config.NODE_ENV === 'test') {
    logger.info('Scheduler disabled in test environment');
    return;
  }

  // MRMS MESH data — every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    logger.info('Scheduler: running MRMS ingestion');
    try {
      const result = await ingestMRMS();
      await checkAndAlert();
      if (result.insertedIds?.length > 0) {
        checkImpactedAssetsForEvents(result.insertedIds).catch(err =>
          logger.error({ err }, 'Impacted asset check failed after MRMS ingestion')
        );
      }
    } catch (err) {
      logger.error({ err }, 'Scheduler: MRMS ingestion failed');
    }
  });

  // NWS active alerts — every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Scheduler: running NWS ingestion');
    try {
      const result = await ingestNWS();
      await checkAndAlert();
      if (result?.insertedIds?.length > 0) {
        checkImpactedAssetsForEvents(result.insertedIds).catch(err =>
          logger.error({ err }, 'Impacted asset check failed after NWS ingestion')
        );
      }
    } catch (err) {
      logger.error({ err }, 'Scheduler: NWS ingestion failed');
    }
  });

  // SPC hail reports — every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    logger.info('Scheduler: running SPC ingestion');
    try {
      const result = await ingestSPC();
      await correctAllPending();
      await checkAndAlert();
      if (result.insertedIds?.length > 0) {
        checkImpactedAssetsForEvents(result.insertedIds).catch(err =>
          logger.error({ err }, 'Impacted asset check failed after SPC ingestion')
        );
      }
    } catch (err) {
      logger.error({ err }, 'Scheduler: SPC ingestion failed');
    }
  });

  // Auto-import county parcels + FEMA NSI data for storm areas — 3x/day (6am, 2pm, 10pm)
  cron.schedule('0 6,14,22 * * *', async () => {
    logger.info('Scheduler: running storm area auto-import (county + FEMA)');
    try {
      await autoImportForStorms();
    } catch (err) {
      logger.error({ err }, 'Scheduler: storm auto-import failed');
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

  // Drip sequence processing — every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await processScheduledSteps();
    } catch (err) {
      logger.error({ err }, 'Drip processing failed');
    }
  });

  // Overdue invoice payment reminders — daily at 9am
  cron.schedule('0 9 * * *', async () => {
    logger.info('Scheduler: checking for overdue invoice reminders');
    try {
      await sendOverdueInvoiceReminders();
    } catch (err) {
      logger.error({ err }, 'Overdue invoice reminders failed');
    }
  });

  logger.info('Ingestion scheduler started (MRMS: 30m, NWS: 1h, SPC: 2h, auto-import: 3x/day, drip: 15m, invoices: 9am daily, cleanup: 3am daily)');

  // Run NWS + SPC ingestion immediately on startup (don't wait for first cron tick)
  setTimeout(async () => {
    try {
      logger.info('Scheduler: running immediate NWS ingestion on startup');
      const nwsResult = await ingestNWS();
      logger.info('Scheduler: startup NWS ingestion complete');
      if (nwsResult?.insertedIds?.length > 0) {
        checkImpactedAssetsForEvents(nwsResult.insertedIds).catch(err =>
          logger.error({ err }, 'Impacted asset check failed after startup NWS ingestion')
        );
      }
    } catch (err) {
      logger.error({ err }, 'Scheduler: startup NWS ingestion failed');
    }

    try {
      logger.info('Scheduler: running immediate SPC ingestion on startup');
      const spcResult = await ingestSPC();
      logger.info('Scheduler: startup SPC ingestion complete');
      if (spcResult.insertedIds?.length > 0) {
        checkImpactedAssetsForEvents(spcResult.insertedIds).catch(err =>
          logger.error({ err }, 'Impacted asset check failed after startup SPC ingestion')
        );
      }
    } catch (err) {
      logger.error({ err }, 'Scheduler: startup SPC ingestion failed');
    }

    // Re-ingest last 7 days of SPC data so historical point reports get buffered into polygons
    try {
      logger.info('Scheduler: running startup SPC backfill (7 days)');
      // Delete old SPC point reports so they get re-ingested as buffered polygons
      const { rowCount: deleted } = await pool.query(
        `DELETE FROM storm_events
         WHERE source = 'spc_report'
         AND ST_GeometryType(geom) = 'ST_Point'
         AND event_start >= NOW() - INTERVAL '7 days'`
      );
      if (deleted > 0) {
        logger.info(`Scheduler: deleted ${deleted} SPC point records for re-ingestion as polygons`);
      }
      const backfillResult = await backfillSPC(7);
      logger.info(`Scheduler: startup backfill complete — ${backfillResult.inserted} reports processed`);
      if (backfillResult.insertedIds?.length > 0) {
        checkImpactedAssetsForEvents(backfillResult.insertedIds).catch(err =>
          logger.error({ err }, 'Impacted asset check failed after startup SPC backfill')
        );
      }
    } catch (err) {
      logger.error({ err }, 'Scheduler: startup SPC backfill failed');
    }
  }, 5000); // delay 5s to let the server finish booting
}
