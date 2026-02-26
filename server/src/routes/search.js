import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as searchService from '../services/searchService.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// GET /api/search?q=...
router.get('/', async (req, res, next) => {
  try {
    const { q, limit = '20' } = req.query;
    const results = await searchService.globalSearch(req.tenantId, q, parseInt(limit, 10));
    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
