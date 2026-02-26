import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import { getAlertConfig, updateAlertConfig, getAlertHistory } from '../services/alertService.js';

const router = Router();

router.use(authenticate);

// GET /api/alerts/config
router.get('/config', async (req, res, next) => {
  try {
    const config = await getAlertConfig(req.user.tenantId);
    res.json(config);
  } catch (err) { next(err); }
});

// PUT /api/alerts/config
router.put('/config', async (req, res, next) => {
  try {
    const config = await updateAlertConfig(req.user.tenantId, req.body);
    res.json(config);
  } catch (err) { next(err); }
});

// GET /api/alerts/history
router.get('/history', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const alerts = await getAlertHistory(req.user.tenantId, { limit, offset });
    res.json(alerts);
  } catch (err) { next(err); }
});

// POST /api/alerts/test — send a test email to verify configuration
router.post('/test', async (req, res, next) => {
  try {
    const { sendStormEmail } = await import('../services/emailService.js');
    const config = await getAlertConfig(req.user.tenantId);

    const testAlert = {
      subject: 'StormLeads Test Alert',
      emailHtml: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2>Test Alert</h2>
          <p>Your StormLeads email alert configuration is working correctly. You'll receive alerts when storms are detected in your service area.</p>
          <p style="color: #666; font-size: 12px;">This is a test notification.</p>
        </div>
      `,
    };

    const results = [];

    if (config.email_enabled && config.email_recipients?.length > 0) {
      for (const email of config.email_recipients) {
        const r = await sendStormEmail(email, testAlert);
        results.push({ email, status: r.logged ? 'logged' : 'sent' });
      }
    }

    res.json({ message: 'Test alerts sent', results });
  } catch (err) { next(err); }
});

export default router;
