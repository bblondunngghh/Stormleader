import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as estimateService from '../services/estimateService.js';
import pool from '../db/pool.js';

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

// Create template
router.post('/templates', async (req, res, next) => {
  try {
    const { name, description, unit, default_unit_price, section } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const { rows } = await pool.query(
      `INSERT INTO estimate_templates (tenant_id, name, description, unit, default_unit_price, section, position)
       VALUES ($1, $2, $3, $4, $5, $6, (SELECT COALESCE(MAX(position), -1) + 1 FROM estimate_templates WHERE tenant_id = $1))
       RETURNING *`,
      [req.tenantId, name, description || '', unit || 'each', Number(default_unit_price) || 0, section || 'Roof']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update template
router.patch('/templates/:id', async (req, res, next) => {
  try {
    const { name, description, unit, default_unit_price, section } = req.body;
    const fields = [];
    const vals = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); vals.push(name); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); vals.push(description); }
    if (unit !== undefined) { fields.push(`unit = $${idx++}`); vals.push(unit); }
    if (default_unit_price !== undefined) { fields.push(`default_unit_price = $${idx++}`); vals.push(Number(default_unit_price)); }
    if (section !== undefined) { fields.push(`section = $${idx++}`); vals.push(section); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.params.id, req.tenantId);
    const { rows } = await pool.query(
      `UPDATE estimate_templates SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'Template not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete template
router.delete('/templates/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM estimate_templates WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
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

// Delete estimate
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await estimateService.deleteEstimate(req.tenantId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Estimate not found' });
    res.json({ success: true });
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

// Generate Good/Better/Best tiers from a single estimate
router.post('/:id/generate-tiers', async (req, res, next) => {
  try {
    const tiers = await estimateService.generateTiers(req.tenantId, req.user.id, req.params.id);
    if (!tiers) return res.status(404).json({ error: 'Estimate not found' });
    res.status(201).json({ tiers });
  } catch (err) {
    next(err);
  }
});

export default router;
