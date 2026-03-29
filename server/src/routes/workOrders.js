import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as workOrderService from '../services/workOrderService.js';
import pool from '../db/pool.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// List available milestone templates
router.get('/milestone-templates', (req, res) => {
  const templates = Object.entries(workOrderService.MILESTONE_TEMPLATES).map(([key, val]) => ({
    key,
    label: val.label,
    milestones: val.milestones,
    count: val.milestones.length,
  }));
  res.json({ templates });
});

// List work orders
router.get('/', async (req, res, next) => {
  try {
    const { status, assigned_to, limit = '50', offset = '0' } = req.query;
    const result = await workOrderService.getWorkOrders(req.tenantId, {
      status: status || undefined,
      assignedTo: assigned_to || undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Get single work order
router.get('/:id', async (req, res, next) => {
  try {
    const wo = await workOrderService.getWorkOrder(req.tenantId, req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    res.json(wo);
  } catch (err) {
    next(err);
  }
});

// Create work order
router.post('/', async (req, res, next) => {
  try {
    const wo = await workOrderService.createWorkOrder(req.tenantId, req.body);
    res.status(201).json(wo);
  } catch (err) {
    next(err);
  }
});

// Create from estimate
router.post('/from-estimate/:estimateId', async (req, res, next) => {
  try {
    const wo = await workOrderService.createFromEstimate(req.tenantId, req.params.estimateId);
    if (!wo) return res.status(404).json({ error: 'Estimate not found' });
    res.status(201).json(wo);
  } catch (err) {
    next(err);
  }
});

// Update work order
router.patch('/:id', async (req, res, next) => {
  try {
    const wo = await workOrderService.updateWorkOrder(req.tenantId, req.params.id, req.body);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    res.json(wo);
  } catch (err) {
    next(err);
  }
});

// Mark complete
router.patch('/:id/complete', async (req, res, next) => {
  try {
    const wo = await workOrderService.completeWorkOrder(req.tenantId, req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    res.json(wo);
  } catch (err) {
    next(err);
  }
});

// Get milestones for a work order (tenant-scoped)
router.get('/:id/milestones', async (req, res, next) => {
  try {
    // Verify work order belongs to this tenant before returning milestones
    const wo = await workOrderService.getWorkOrder(req.tenantId, req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    const milestones = await workOrderService.getMilestones(req.params.id);
    res.json({ milestones });
  } catch (err) {
    next(err);
  }
});

// Create a new milestone — tenant-scoped
router.post('/:id/milestones', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Milestone name required' });
    const wo = await workOrderService.getWorkOrder(req.tenantId, req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    const { rows: [maxOrder] } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM work_order_milestones WHERE work_order_id = $1',
      [req.params.id]
    );
    const { rows: [milestone] } = await pool.query(
      `INSERT INTO work_order_milestones (work_order_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, name.trim(), maxOrder.next_order]
    );
    res.status(201).json(milestone);
  } catch (err) { next(err); }
});

// Delete a milestone — tenant-scoped
router.delete('/:woId/milestones/:milestoneId', async (req, res, next) => {
  try {
    const wo = await workOrderService.getWorkOrder(req.tenantId, req.params.woId);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    await pool.query(
      'DELETE FROM work_order_milestones WHERE id = $1 AND work_order_id = $2',
      [req.params.milestoneId, req.params.woId]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Update a milestone (toggle complete, set photo) — tenant-scoped
router.patch('/:id/milestones/:milestoneId', async (req, res, next) => {
  try {
    // Verify work order belongs to this tenant
    const wo = await workOrderService.getWorkOrder(req.tenantId, req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    const { completed, photo_url } = req.body;
    const milestone = await workOrderService.updateMilestone(
      req.params.id, req.params.milestoneId,
      { completed, photoUrl: photo_url }
    );
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    // Check if all milestones complete → auto-complete work order
    if (completed) {
      await workOrderService.checkAndCompleteWorkOrder(req.params.id);
    }

    res.json(milestone);
  } catch (err) {
    next(err);
  }
});

export default router;
