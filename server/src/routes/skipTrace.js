import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as skipTraceService from '../services/skipTraceService.js';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';

const router = Router();

// All skip trace routes require auth + tenant scope
router.use(authenticate, tenantScope);

// GET /api/skip-trace/config
router.get('/config', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM tenant_skip_trace_config WHERE tenant_id = $1',
      [req.tenantId]
    );
    res.json(rows[0] || { enabled: false, card_last_four: null, card_brand: null });
  } catch (err) { next(err); }
});

// PUT /api/skip-trace/config
router.put('/config', async (req, res, next) => {
  try {
    const { enabled } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO tenant_skip_trace_config (tenant_id, enabled)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE SET enabled = $2, updated_at = NOW()
       RETURNING *`,
      [req.tenantId, enabled]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/skip-trace/setup-payment
router.post('/setup-payment', async (req, res, next) => {
  try {
    const { paymentMethodId, email } = req.body;
    if (!paymentMethodId) return res.status(400).json({ error: 'paymentMethodId required' });

    const stripeService = await import('../services/stripeService.js');
    await stripeService.getOrCreateCustomer(req.tenantId, email);
    const pm = await stripeService.attachPaymentMethod(req.tenantId, paymentMethodId);
    res.json(pm);
  } catch (err) { next(err); }
});

// DELETE /api/skip-trace/payment-method
router.delete('/payment-method', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT stripe_payment_method_id FROM tenant_skip_trace_config WHERE tenant_id = $1',
      [req.tenantId]
    );
    if (!rows[0]?.stripe_payment_method_id) return res.status(404).json({ error: 'No payment method' });

    const stripeService = await import('../services/stripeService.js');
    await stripeService.removePaymentMethod(req.tenantId, rows[0].stripe_payment_method_id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

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

    // Check skip trace is enabled and has payment method
    const { rows: stConfig } = await pool.query(
      'SELECT enabled, stripe_payment_method_id FROM tenant_skip_trace_config WHERE tenant_id = $1',
      [req.tenantId]
    );
    if (!stConfig[0]?.enabled) {
      return res.status(403).json({ error: 'Skip tracing is not enabled for your account' });
    }
    if (!stConfig[0]?.stripe_payment_method_id) {
      return res.status(402).json({ error: 'No payment method configured. Add a card in Settings.' });
    }

    const result = await skipTraceService.submitSkipTrace(
      req.tenantId,
      propertyIds,
      webhookUrl
    );

    // Update usage record with job_id (billing happens in monthly batch)
    await pool.query(
      `UPDATE skip_trace_usage SET job_id = $1
       WHERE tenant_id = $2 AND job_id IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [result.jobId, req.tenantId]
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
 * GET /api/skip-trace/balance
 * Get current unbilled balance for the tenant.
 */
router.get('/balance', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) as unbilled_jobs,
         COALESCE(SUM(records_requested), 0) as unbilled_records,
         COALESCE(SUM(records_requested), 0) * 15 as unbilled_cents
       FROM skip_trace_usage
       WHERE tenant_id = $1 AND billed = false`,
      [req.tenantId]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

/**
 * GET /api/skip-trace/invoices
 * Get billing history for the tenant.
 */
router.get('/invoices', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM skip_trace_invoices
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.tenantId]
    );
    res.json(rows);
  } catch (err) { next(err); }
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
