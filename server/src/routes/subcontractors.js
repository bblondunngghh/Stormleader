import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import validateId from '../middleware/validateId.js';
import * as subcontractorService from '../services/subcontractorService.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// List subcontractors
router.get('/', async (req, res, next) => {
  try {
    const { specialty, status, search, limit = '50', offset = '0' } = req.query;
    const result = await subcontractorService.listSubcontractors(req.tenantId, {
      specialty: specialty || undefined,
      status: status || undefined,
      search: search || undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Get single subcontractor
router.get('/:id', validateId(), async (req, res, next) => {
  try {
    const sub = await subcontractorService.getSubcontractor(req.tenantId, req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subcontractor not found' });
    res.json(sub);
  } catch (err) {
    next(err);
  }
});

// Create subcontractor
router.post('/', async (req, res, next) => {
  try {
    const { name, company, phone, email, specialty, hourly_rate, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const sub = await subcontractorService.createSubcontractor(req.tenantId, {
      name, company, phone, email, specialty, hourly_rate, notes,
    });
    res.status(201).json(sub);
  } catch (err) {
    next(err);
  }
});

// Update subcontractor
router.patch('/:id', validateId(), async (req, res, next) => {
  try {
    const sub = await subcontractorService.updateSubcontractor(req.tenantId, req.params.id, req.body);
    if (!sub) return res.status(404).json({ error: 'Subcontractor not found' });
    res.json(sub);
  } catch (err) {
    next(err);
  }
});

// Delete subcontractor
router.delete('/:id', validateId(), async (req, res, next) => {
  try {
    const deleted = await subcontractorService.deleteSubcontractor(req.tenantId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Subcontractor not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Assign subcontractor to work order
router.post('/assign', async (req, res, next) => {
  try {
    const { work_order_id, subcontractor_id, role, agreed_rate, notes } = req.body;
    if (!work_order_id || !subcontractor_id) {
      return res.status(400).json({ error: 'work_order_id and subcontractor_id are required' });
    }
    const assignment = await subcontractorService.assignToWorkOrder(
      req.tenantId, work_order_id, subcontractor_id, { role, agreed_rate, notes }
    );
    if (!assignment) return res.status(404).json({ error: 'Work order not found' });
    res.status(201).json(assignment);
  } catch (err) {
    next(err);
  }
});

// Get subcontractors for a work order
router.get('/work-order/:workOrderId', validateId('workOrderId'), async (req, res, next) => {
  try {
    const subs = await subcontractorService.getWorkOrderSubcontractors(req.tenantId, req.params.workOrderId);
    res.json(subs);
  } catch (err) {
    next(err);
  }
});

// Remove subcontractor from work order
router.delete('/work-order/:workOrderId/:subcontractorId', validateId('workOrderId', 'subcontractorId'), async (req, res, next) => {
  try {
    const removed = await subcontractorService.removeFromWorkOrder(
      req.tenantId, req.params.workOrderId, req.params.subcontractorId
    );
    if (!removed) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
