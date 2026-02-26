import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as leadService from '../services/leadService.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// GET /api/leads — List leads for tenant with filters
router.get('/', async (req, res, next) => {
  try {
    const { stage, priority, storm_event_id, assigned_rep_id, limit = '50', offset = '0' } = req.query;

    const result = await leadService.getLeads(req.tenantId, {
      stage: stage || undefined,
      priority: priority || undefined,
      stormEventId: storm_event_id || undefined,
      assignedRepId: assigned_rep_id || undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/:id — Lead detail
router.get('/:id', async (req, res, next) => {
  try {
    const lead = await leadService.getLead(req.tenantId, req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/leads/:id — Update lead
router.patch('/:id', async (req, res, next) => {
  try {
    const lead = await leadService.updateLead(req.tenantId, req.params.id, req.body);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/from-storm — Generate leads from storm event
router.post('/from-storm', async (req, res, next) => {
  try {
    const { stormEventId, propertyIds, assignedRepId } = req.body;

    if (!stormEventId) {
      return res.status(400).json({ error: 'stormEventId is required' });
    }
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ error: 'propertyIds must be a non-empty array' });
    }

    const result = await leadService.generateLeadsFromStorm(
      req.tenantId, stormEventId, propertyIds, assignedRepId
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
