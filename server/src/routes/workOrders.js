import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as workOrderService from '../services/workOrderService.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

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

// Get milestones for a work order
router.get('/:id/milestones', async (req, res, next) => {
  try {
    const milestones = await workOrderService.getMilestones(req.params.id);
    res.json({ milestones });
  } catch (err) {
    next(err);
  }
});

// Update a milestone (toggle complete, set photo)
router.patch('/:id/milestones/:milestoneId', async (req, res, next) => {
  try {
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
