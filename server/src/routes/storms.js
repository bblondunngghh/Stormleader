import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import * as stormService from '../services/stormService.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { source, limit = '50', offset = '0' } = req.query;
    const result = await stormService.listEvents({
      source: source || undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const event = await stormService.getEvent(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Storm event not found' });
    }
    res.json(event);
  } catch (err) {
    next(err);
  }
});

export default router;
