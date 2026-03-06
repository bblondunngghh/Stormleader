import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as roofMeasurementService from '../services/roofMeasurementService.js';
import pool from '../db/pool.js';

const router = Router();

router.use(authenticate, tenantScope);

// GET /api/roof-measurement/config
router.get('/config', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT roof_measurement_enabled FROM tenant_skip_trace_config WHERE tenant_id = $1',
      [req.tenantId]
    );
    res.json({ roof_measurement_enabled: rows[0]?.roof_measurement_enabled || false });
  } catch (err) { next(err); }
});

// PUT /api/roof-measurement/config
router.put('/config', async (req, res, next) => {
  try {
    const { roof_measurement_enabled } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO tenant_skip_trace_config (tenant_id, roof_measurement_enabled)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE SET roof_measurement_enabled = $2, updated_at = NOW()
       RETURNING roof_measurement_enabled`,
      [req.tenantId, roof_measurement_enabled]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/roof-measurement/measure
router.post('/measure', async (req, res, next) => {
  try {
    const { propertyId } = req.body;
    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId is required' });
    }

    // Check roof measurement is enabled and has payment method
    const { rows: config } = await pool.query(
      'SELECT roof_measurement_enabled, stripe_payment_method_id FROM tenant_skip_trace_config WHERE tenant_id = $1',
      [req.tenantId]
    );
    if (!config[0]?.roof_measurement_enabled) {
      return res.status(403).json({ error: 'Roof measurement is not enabled for your account' });
    }
    if (!config[0]?.stripe_payment_method_id) {
      return res.status(402).json({ error: 'No payment method configured. Add a card in Settings.' });
    }

    const result = await roofMeasurementService.measureRoof(req.tenantId, propertyId);
    res.json(result);
  } catch (err) {
    if (err.message.includes('not configured')) {
      return res.status(503).json({ error: 'Roof measurement service not configured. Set GOOGLE_SOLAR_API_KEY.' });
    }
    if (err.message.includes('No roof data available')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('No roof segment data')) {
      return res.status(404).json({ error: 'No roof segment data available for this location.' });
    }
    next(err);
  }
});

// GET /api/roof-measurement/usage
router.get('/usage', async (req, res, next) => {
  try {
    const usage = await roofMeasurementService.getUsage(req.tenantId);
    res.json(usage);
  } catch (err) { next(err); }
});

// GET /api/roof-measurement/balance
router.get('/balance', async (req, res, next) => {
  try {
    const balance = await roofMeasurementService.getBalance(req.tenantId);
    res.json(balance);
  } catch (err) { next(err); }
});

export default router;
