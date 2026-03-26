import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as stormHistoryService from '../services/stormHistoryService.js';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

/**
 * GET /api/storm-history?lat=32.45&lng=-96.78&radius=5&years=5
 * On-demand storm history lookup via NOAA SWDI API.
 * No bulk data stored — queries external API at runtime with 24hr cache.
 */
router.get('/', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = Math.min(parseFloat(req.query.radius) || 5, 25); // Cap at 25 miles
    const years = Math.min(parseInt(req.query.years) || 5, 10); // Cap at 10 years

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Valid lat and lng query parameters are required' });
    }

    const result = await stormHistoryService.getStormHistory(lat, lng, radius, years);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/storm-history/heatmap?bbox=west,south,east,north&years=10
 * Returns hail event points for heat map visualization.
 */
router.get('/heatmap', async (req, res, next) => {
  try {
    const bbox = (req.query.bbox || '').split(',').map(Number);
    if (bbox.length !== 4 || bbox.some(isNaN)) {
      return res.status(400).json({ error: 'bbox parameter required: west,south,east,north' });
    }
    const [west, south, east, north] = bbox;
    const years = Math.min(parseInt(req.query.years) || 10, 10);

    // Limit bbox size to prevent huge queries
    if (east - west > 12 || north - south > 12) {
      return res.status(400).json({ error: 'Bounding box too large — zoom in more (max 12° span)' });
    }

    const points = await stormHistoryService.getHailHeatmapData(west, south, east, north, years);
    res.json({ points, count: points.length });
  } catch (err) {
    next(err);
  }
});

export default router;
