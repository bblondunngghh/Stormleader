import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as estimateService from '../services/estimateService.js';

const router = Router();

// ============================================================
// PUBLIC routes (no auth — customer-facing)
// ============================================================

router.get('/public/:token', async (req, res, next) => {
  try {
    const estimate = await estimateService.getEstimateByToken(req.params.token);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

router.post('/public/:token/accept', async (req, res, next) => {
  try {
    const { signer_name, signature_data } = req.body;
    if (!signer_name) return res.status(400).json({ error: 'signer_name required' });
    const estimate = await estimateService.acceptEstimate(req.params.token, signer_name, signature_data || null);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found or already resolved' });
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

router.post('/public/:token/decline', async (req, res, next) => {
  try {
    const estimate = await estimateService.declineEstimate(req.params.token);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found or already resolved' });
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// AUTHENTICATED routes
// ============================================================

router.use(authenticate);
router.use(tenantScope);

// List estimates
router.get('/', async (req, res, next) => {
  try {
    const { status, lead_id, limit = '50', offset = '0' } = req.query;
    const result = await estimateService.getEstimates(req.tenantId, {
      status: status || undefined,
      lead_id: lead_id || undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Get templates
router.get('/templates', async (req, res, next) => {
  try {
    const templates = await estimateService.getTemplates(req.tenantId);
    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

// Get single estimate
router.get('/:id', async (req, res, next) => {
  try {
    const estimate = await estimateService.getEstimateDetail(req.tenantId, req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

// Create estimate
router.post('/', async (req, res, next) => {
  try {
    const estimate = await estimateService.createEstimate(req.tenantId, req.user.id, req.body);
    res.status(201).json(estimate);
  } catch (err) {
    next(err);
  }
});

// Update estimate
router.patch('/:id', async (req, res, next) => {
  try {
    const estimate = await estimateService.updateEstimate(req.tenantId, req.params.id, req.body);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

// Send estimate to customer
router.post('/:id/send', async (req, res, next) => {
  try {
    const estimate = await estimateService.sendEstimate(req.tenantId, req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found or already sent' });
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

// Duplicate estimate
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const estimate = await estimateService.duplicateEstimate(req.tenantId, req.user.id, req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
    res.status(201).json(estimate);
  } catch (err) {
    next(err);
  }
});

export default router;
