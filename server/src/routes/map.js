import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import * as stormService from '../services/stormService.js';

const router = Router();
router.use(authenticate);

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
