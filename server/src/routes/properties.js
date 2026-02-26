import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import * as propertyService from '../services/propertyService.js';
import * as leadService from '../services/leadService.js';

const router = Router();
router.use(authenticate);

// GET /api/properties — List properties with optional bbox filter
router.get('/', async (req, res, next) => {
  try {
    const { bbox, limit = '500' } = req.query;

    if (!bbox) {
      return res.status(400).json({ error: 'bbox query parameter is required (west,south,east,north)' });
    }

    const bboxArr = bbox.split(',').map(Number);
    if (bboxArr.length !== 4 || bboxArr.some(isNaN)) {
      return res.status(400).json({ error: 'bbox must be 4 comma-separated numbers: west,south,east,north' });
    }

    const result = await propertyService.getPropertiesInViewport(bboxArr, parseInt(limit, 10));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/properties/in-swath/:stormEventId — Properties within a storm swath
router.get('/in-swath/:stormEventId', async (req, res, next) => {
  try {
    const { limit = '500', offset = '0' } = req.query;
    const result = await propertyService.findPropertiesInSwath(
      req.params.stormEventId,
      { limit: parseInt(limit, 10), offset: parseInt(offset, 10) }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/properties/:id — Single property detail
router.get('/:id', async (req, res, next) => {
  try {
    const property = await propertyService.getProperty(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(property);
  } catch (err) {
    next(err);
  }
});

// POST /api/properties/generate-leads — Generate leads from storm + property IDs
router.post('/generate-leads', async (req, res, next) => {
  try {
    const { stormEventId, propertyIds, assignedRepId } = req.body;

    if (!stormEventId) {
      return res.status(400).json({ error: 'stormEventId is required' });
    }
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ error: 'propertyIds must be a non-empty array' });
    }

    const tenantId = req.user.tenantId;
    const result = await leadService.generateLeadsFromStorm(
      tenantId, stormEventId, propertyIds, assignedRepId
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
