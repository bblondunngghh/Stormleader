import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as dashboardService from '../services/dashboardService.js';
import { parsePagination } from '../utils/pagination.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

function extractFilters(query) {
  const f = {};
  if (query.rep) f.rep = query.rep;
  if (query.source) f.source = query.source;
  if (query.date_from) f.dateFrom = query.date_from;
  if (query.date_to) f.dateTo = query.date_to;
  return f;
}

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await dashboardService.getStats(req.tenantId, extractFilters(req.query));
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/funnel', async (req, res, next) => {
  try {
    const funnel = await dashboardService.getFunnel(req.tenantId, extractFilters(req.query));
    res.json(funnel);
  } catch (err) {
    next(err);
  }
});

router.get('/activity', async (req, res, next) => {
  try {
    const { limit } = parsePagination(req.query, { defaultLimit: 20 });
    const activity = await dashboardService.getActivity(req.tenantId, limit, extractFilters(req.query));
    res.json(activity);
  } catch (err) {
    next(err);
  }
});

export default router;
