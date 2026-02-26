import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import * as stormService from '../services/stormService.js';
import * as propertyService from '../services/propertyService.js';

const router = Router();
router.use(authenticate);

// GET /api/map/properties?bbox=w,s,e,n — All properties in viewport (legacy)
router.get('/properties', async (req, res, next) => {
  try {
    const { bbox } = req.query;

    if (!bbox) {
      return res.status(400).json({ error: 'bbox query parameter is required (west,south,east,north)' });
    }

    const bboxArr = bbox.split(',').map(Number);
    if (bboxArr.length !== 4 || bboxArr.some(isNaN)) {
      return res.status(400).json({ error: 'bbox must be 4 comma-separated numbers: west,south,east,north' });
    }

    const result = await propertyService.getPropertiesInViewport(bboxArr);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/map/affected-properties?bbox=w,s,e,n&timeRange=30d — Only properties inside storm zones
router.get('/affected-properties', async (req, res, next) => {
  try {
    const { bbox, timeRange } = req.query;

    if (!bbox) {
      return res.status(400).json({ error: 'bbox query parameter is required (west,south,east,north)' });
    }

    const bboxArr = bbox.split(',').map(Number);
    if (bboxArr.length !== 4 || bboxArr.some(isNaN)) {
      return res.status(400).json({ error: 'bbox must be 4 comma-separated numbers: west,south,east,north' });
    }

    const result = await propertyService.getPropertiesInStormZones(bboxArr, timeRange || '30d');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/swaths', async (req, res, next) => {
  try {
    const { bbox, timeRange, startDate, endDate } = req.query;

    if (!bbox) {
      return res.status(400).json({ error: 'bbox query parameter is required (west,south,east,north)' });
    }

    const bboxArr = bbox.split(',').map(Number);
    if (bboxArr.length !== 4 || bboxArr.some(isNaN)) {
      return res.status(400).json({ error: 'bbox must be 4 comma-separated numbers: west,south,east,north' });
    }

    const result = await stormService.getSwathsByViewport(
      bboxArr,
      timeRange || '7d',
      startDate,
      endDate
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
