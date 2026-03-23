import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import {
  getSequences,
  getSequence,
  createSequence,
  updateSequence,
  deleteSequence,
  enrollLead,
  cancelEnrollment,
  getEnrollments,
} from '../services/dripService.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// GET /api/crm/drip-sequences — list all sequences for tenant
router.get('/', async (req, res, next) => {
  try {
    const sequences = await getSequences(req.tenantId);
    res.json(sequences);
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/drip-sequences/:id — detail with steps
router.get('/:id', async (req, res, next) => {
  try {
    const sequence = await getSequence(req.tenantId, req.params.id);
    if (!sequence) return res.status(404).json({ error: 'Sequence not found' });
    res.json(sequence);
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/drip-sequences — create with steps
router.post('/', async (req, res, next) => {
  try {
    const { name, trigger_type, trigger_config, steps } = req.body;
    if (!name || !trigger_type) {
      return res.status(400).json({ error: 'name and trigger_type are required' });
    }
    if (!steps?.length) {
      return res.status(400).json({ error: 'At least one step is required' });
    }
    const sequence = await createSequence(req.tenantId, { name, trigger_type, trigger_config, steps });
    res.status(201).json(sequence);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/crm/drip-sequences/:id — update
router.patch('/:id', async (req, res, next) => {
  try {
    const sequence = await updateSequence(req.tenantId, req.params.id, req.body);
    if (!sequence) return res.status(404).json({ error: 'Sequence not found' });
    res.json(sequence);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/crm/drip-sequences/:id — delete
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await deleteSequence(req.tenantId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Sequence not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/drip-sequences/:id/enroll — enroll a lead
router.post('/:id/enroll', async (req, res, next) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return res.status(400).json({ error: 'leadId is required' });
    const enrollment = await enrollLead(req.tenantId, req.params.id, leadId);
    res.status(201).json(enrollment);
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/drip-sequences/:id/cancel — cancel enrollment
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return res.status(400).json({ error: 'leadId is required' });
    const enrollment = await cancelEnrollment(req.tenantId, req.params.id, leadId);
    if (!enrollment) return res.status(404).json({ error: 'Active enrollment not found' });
    res.json(enrollment);
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/drip-sequences/:id/enrollments — list enrolled leads
router.get('/:id/enrollments', async (req, res, next) => {
  try {
    const enrollments = await getEnrollments(req.tenantId, req.params.id);
    res.json(enrollments);
  } catch (err) {
    next(err);
  }
});

export default router;
