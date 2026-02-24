import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as dashboardService from '../services/dashboardService.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await dashboardService.getStats(req.tenantId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/funnel', async (req, res, next) => {
  try {
    const funnel = await dashboardService.getFunnel(req.tenantId);
    res.json(funnel);
  } catch (err) {
    next(err);
  }
});

router.get('/activity', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const activity = await dashboardService.getActivity(req.tenantId, limit);
    res.json(activity);
  } catch (err) {
    next(err);
  }
});

export default router;
