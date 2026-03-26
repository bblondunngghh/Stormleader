import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

/**
 * GET /api/data/fema-housing?zip=77657
 * FEMA Housing Assistance damage density by ZIP code.
 */
router.get('/fema-housing', async (req, res, next) => {
  try {
    const { zip } = req.query;
    if (!zip) return res.status(400).json({ error: 'zip query parameter required' });

    const { getHousingAssistance } = await import('../services/femaHousingService.js');
    const result = await getHousingAssistance(zip);

    if (!result) return res.json({ found: false, zipCode: zip });
    res.json({ found: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/data/optimize-route
 * Optimize canvassing route through a list of property stops.
 * Body: { stops: [{ lat, lng, id?, address? }, ...] }
 */
router.post('/optimize-route', async (req, res, next) => {
  try {
    const { stops } = req.body;
    if (!Array.isArray(stops) || stops.length < 2) {
      return res.status(400).json({ error: 'stops array with at least 2 items required' });
    }

    const { optimizeRoute } = await import('../services/routeOptimizerService.js');
    const result = await optimizeRoute(stops);

    if (result?.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/data/directions?fromLat=30.19&fromLng=-94.16&toLat=30.20&toLng=-94.15
 * Get driving directions between two points.
 */
router.get('/directions', async (req, res, next) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;
    if (!fromLat || !fromLng || !toLat || !toLng) {
      return res.status(400).json({ error: 'fromLat, fromLng, toLat, toLng required' });
    }

    const { getDirections } = await import('../services/routeOptimizerService.js');
    const result = await getDirections(
      parseFloat(fromLat), parseFloat(fromLng),
      parseFloat(toLat), parseFloat(toLng)
    );

    if (!result) return res.json({ found: false });
    res.json({ found: true, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
