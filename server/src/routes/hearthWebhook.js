import { Router } from 'express';
import { handleWebhook } from '../services/financing/index.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const signature = req.headers['x-hearth-signature'] || '';
    const rawBody = req.body.toString('utf8');
    const result = await handleWebhook('hearth', rawBody, signature);
    res.json(result);
  } catch (err) {
    console.error('Hearth webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

export default router;
