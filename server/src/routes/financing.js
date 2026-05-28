import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import validateId from '../middleware/validateId.js';
import * as svc from '../services/financing/index.js';

const router = Router();

// --- Public routes (no auth, token-based) ---

router.get('/public/:token/plans', async (req, res, next) => {
  try {
    const plans = await svc.getPublicPlans(req.params.token);
    res.json(plans);
  } catch (err) { next(err); }
});

router.get('/public/:token/applications', async (req, res, next) => {
  try {
    const apps = await svc.getPublicApplications(req.params.token);
    res.json(apps);
  } catch (err) { next(err); }
});

router.post('/public/:token/apply', async (req, res, next) => {
  try {
    if (!req.body.planId) return res.status(400).json({ error: 'planId is required' });
    const app = await svc.createPublicApplication(req.params.token, req.body.planId);
    res.status(201).json(app);
  } catch (err) {
    if (err.message === 'Estimate not found or financing not enabled') {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// --- Authenticated routes ---

router.use(authenticate);
router.use(tenantScope);

// Lenders
router.get('/lenders', async (req, res, next) => {
  try {
    const lenders = await svc.getLenders(req.tenantId);
    res.json(lenders);
  } catch (err) { next(err); }
});

router.post('/lenders', async (req, res, next) => {
  try {
    const { provider, apiKey, merchantId, config } = req.body;
    if (!provider || !apiKey || !merchantId) return res.status(400).json({ error: 'provider, apiKey, and merchantId are required' });
    const lender = await svc.connectLender(req.tenantId, { provider, apiKey, merchantId, config });
    res.status(201).json(lender);
  } catch (err) {
    if (err.message === 'Invalid lender credentials') return res.status(400).json({ error: err.message });
    next(err);
  }
});

router.patch('/lenders/:id', validateId(), async (req, res, next) => {
  try {
    const lender = await svc.updateLender(req.tenantId, req.params.id, req.body);
    if (!lender) return res.status(404).json({ error: 'Lender not found' });
    res.json(lender);
  } catch (err) { next(err); }
});

router.delete('/lenders/:id', validateId(), async (req, res, next) => {
  try {
    const result = await svc.deactivateLender(req.tenantId, req.params.id);
    if (!result) return res.status(404).json({ error: 'Lender not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Plans
router.get('/plans', async (req, res, next) => {
  try {
    const plans = await svc.getPlans(req.tenantId, { lenderId: req.query.lenderId });
    res.json(plans);
  } catch (err) { next(err); }
});

router.post('/plans/sync', async (req, res, next) => {
  try {
    const { lenderId } = req.body;
    if (!lenderId) return res.status(400).json({ error: 'lenderId is required' });
    const plans = await svc.syncPlans(req.tenantId, lenderId);
    res.json(plans);
  } catch (err) { next(err); }
});

router.patch('/plans/:id', validateId(), async (req, res, next) => {
  try {
    const plan = await svc.updatePlan(req.tenantId, req.params.id, req.body);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (err) { next(err); }
});

// Applications
router.get('/applications', async (req, res, next) => {
  try {
    const apps = await svc.getApplications(req.tenantId, req.query);
    res.json(apps);
  } catch (err) { next(err); }
});

router.get('/applications/:id', validateId(), async (req, res, next) => {
  try {
    const app = await svc.getApplication(req.tenantId, req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    res.json(app);
  } catch (err) { next(err); }
});

router.post('/applications', async (req, res, next) => {
  try {
    if (!req.body.leadId) {
      return res.status(400).json({ error: 'leadId is required' });
    }
    if (!req.body.planId) {
      return res.status(400).json({ error: 'planId is required' });
    }
    const app = await svc.createApplication(req.tenantId, req.body);
    res.status(201).json(app);
  } catch (err) { next(err); }
});

export default router;
