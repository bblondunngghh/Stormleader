import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import * as notificationService from '../services/notificationService.js';

const router = Router();
router.use(authenticate);

// GET /api/notifications — list for current user
router.get('/', async (req, res, next) => {
  try {
    const { limit = '30', offset = '0', is_read } = req.query;
    const notifications = await notificationService.getNotifications(req.user.id, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      is_read,
    });
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await notificationService.markRead(req.user.id, req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', async (req, res, next) => {
  try {
    const result = await notificationService.markAllRead(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications/preferences
router.get('/preferences', async (req, res, next) => {
  try {
    const preferences = await notificationService.getPreferences(req.user.id);
    res.json({ preferences });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/preferences
router.patch('/preferences', async (req, res, next) => {
  try {
    const { notification_type, ...updates } = req.body;
    if (!notification_type) return res.status(400).json({ error: 'notification_type required' });
    const pref = await notificationService.updatePreference(req.user.id, notification_type, updates);
    res.json(pref);
  } catch (err) {
    next(err);
  }
});

export default router;
