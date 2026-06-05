import { Router } from 'express';
import { handleWebhook } from '../services/financing/index.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    // express.raw({ type: 'application/json' }) only populates req.body when
    // Content-Type matches. Anything else (missing header, wrong type, empty
    // body) leaves req.body as undefined — guard before .toString() to avoid
    // leaking "Cannot read properties of undefined".
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: 'Missing or invalid request body' });
    }
    const signature = req.headers['x-hearth-signature'] || '';
    const rawBody = req.body.toString('utf8');
    const result = await handleWebhook('hearth', rawBody, signature);
    res.json(result);
  } catch (err) {
    console.error('Hearth webhook error:', err.message);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

export default router;
