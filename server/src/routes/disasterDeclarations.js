import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import { getDisasterDeclarations, computeCountyRiskScore } from '../services/disasterDeclarationService.js';

const router = Router();
router.use(authenticate);

// GET /api/disaster-declarations?state=TX&county=Harris
// Returns FEMA disaster declarations for a county (proxies free OpenFEMA API)
router.get('/', async (req, res, next) => {
  try {
    const { state, county } = req.query;
    if (!state || !county) {
      return res.status(400).json({ error: 'state and county parameters required' });
    }

    // Validate state is a 2-letter code
    if (!/^[A-Za-z]{2}$/.test(state)) {
      return res.status(400).json({ error: 'state must be a 2-letter abbreviation' });
    }

    // Validate county name (alphanumeric + spaces, no injection)
    if (!/^[A-Za-z\s.'-]+$/.test(county)) {
      return res.status(400).json({ error: 'Invalid county name' });
    }

    const result = await getDisasterDeclarations(state, county);
    const riskScore = computeCountyRiskScore(result.summary);

    res.json({
      ...result,
      riskScore,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
