import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as skipTraceService from '../services/skipTraceService.js';
import logger from '../utils/logger.js';

const router = Router();

// All skip trace routes require auth + tenant scope
router.use(authenticate, tenantScope);

/**
 * POST /api/skip-trace/submit
 * Submit a skip trace job for selected properties.
 * Body: { propertyIds: string[], webhookUrl?: string }
 */
router.post('/submit', async (req, res, next) => {
  try {
    const { propertyIds, webhookUrl } = req.body;

    if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ error: 'propertyIds array is required' });
    }

    if (propertyIds.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 properties per skip trace batch' });
    }

    const result = await skipTraceService.submitSkipTrace(
      req.tenantId,
      propertyIds,
      webhookUrl
    );

    res.json(result);
  } catch (err) {
    if (err.message.includes('not configured')) {
      return res.status(503).json({ error: 'Skip trace service not configured. Set TRACERFY_API_KEY.' });
    }
    next(err);
  }
});

/**
 * GET /api/skip-trace/job/:jobId
 * Check status of a skip trace job.
 */
router.get('/job/:jobId', async (req, res, next) => {
  try {
    const status = await skipTraceService.getJobStatus(req.params.jobId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/skip-trace/usage
 * Get skip trace usage stats for the tenant.
 */
router.get('/usage', async (req, res, next) => {
  try {
    const usage = await skipTraceService.getUsage(req.tenantId);
    res.json(usage);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/skip-trace/jobs
 * Get recent skip trace jobs for the tenant.
 */
router.get('/jobs', async (req, res, next) => {
  try {
    const jobs = await skipTraceService.getRecentJobs(req.tenantId);
    res.json(jobs);
  } catch (err) {
    next(err);
  }
});

export default router;
