import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import {
  applyDriftCorrection,
  correctAllPending,
  getDriftInfo,
  recordCalibration,
  calculateDrift,
} from '../services/windDriftService.js';

const router = Router();

router.use(authenticate);

// GET /api/drift/:stormEventId — get drift info for a storm
router.get('/:stormEventId', async (req, res, next) => {
  try {
    const info = await getDriftInfo(req.params.stormEventId);
    if (!info) return res.status(404).json({ error: 'Storm event not found' });
    res.json(info);
  } catch (err) { next(err); }
});

// POST /api/drift/:stormEventId/correct — apply drift correction to a single storm
router.post('/:stormEventId/correct', async (req, res, next) => {
  try {
    const detectionAltM = parseInt(req.body.detection_alt_m) || 5500;
    const drift = await applyDriftCorrection(req.params.stormEventId, { detectionAltM });
    res.json({ drift });
  } catch (err) { next(err); }
});

// POST /api/drift/correct-all — apply drift correction to all pending hail events
router.post('/correct-all', async (req, res, next) => {
  try {
    const count = await correctAllPending();
    res.json({ corrected: count });
  } catch (err) { next(err); }
});

// POST /api/drift/simulate — run a drift simulation without saving
router.post('/simulate', async (req, res, next) => {
  try {
    const { hail_size_in, detection_alt_m = 5500, wind_profile } = req.body;
    if (!hail_size_in) return res.status(400).json({ error: 'hail_size_in is required' });

    // Use provided wind profile or climatological default
    const profile = wind_profile || (await import('../services/windDriftService.js'))
      .fetchHRRRWindProfile
      ? undefined
      : undefined;

    const drift = calculateDrift(hail_size_in, profile || [], detection_alt_m);
    res.json({ drift });
  } catch (err) { next(err); }
});

// POST /api/drift/calibrate — record ground-truth damage location
router.post('/calibrate', async (req, res, next) => {
  try {
    const { storm_event_id, lat, lng, notes } = req.body;
    if (!storm_event_id || !lat || !lng) {
      return res.status(400).json({ error: 'storm_event_id, lat, and lng are required' });
    }
    const cal = await recordCalibration(req.user.tenantId, storm_event_id, lat, lng, notes);
    res.json(cal);
  } catch (err) { next(err); }
});

export default router;
