import { Router } from 'express';
import * as skipTraceService from '../services/skipTraceService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/webhooks/tracerfy
 * Webhook endpoint for Tracerfy skip trace completion.
 * No auth required — Tracerfy posts results here when a job finishes.
 */
router.post('/tracerfy', async (req, res) => {
  try {
    const { queue_id, tenant_id, results, status } = req.body;

    logger.info({ queue_id, status, resultCount: results?.length }, 'Tracerfy webhook received');

    if (status === 'completed' && results && tenant_id) {
      await skipTraceService.processSkipTraceResults(tenant_id, results);
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, 'Tracerfy webhook processing failed');
    // Always return 200 to prevent Tracerfy from retrying
    res.json({ received: true, error: err.message });
  }
});

export default router;
