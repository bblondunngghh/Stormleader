import { Router } from 'express';
import authRouter from './auth.js';
import stormsRouter from './storms.js';
import mapRouter from './map.js';
import dashboardRouter from './dashboard.js';
import propertiesRouter from './properties.js';
import leadsRouter from './leads.js';
import skipTraceRouter from './skipTrace.js';
import webhookRouter from './webhook.js';
import alertsRouter from './alerts.js';
import driftRouter from './drift.js';
import countiesRouter from './counties.js';
import crmRouter from './crm.js';
import estimatesRouter from './estimates.js';
import notificationsRouter from './notifications.js';
import searchRouter from './search.js';
import documentsRouter from './documents.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/storms', stormsRouter);
router.use('/map', mapRouter);
router.use('/dashboard', dashboardRouter);
router.use('/properties', propertiesRouter);
router.use('/leads', leadsRouter);
router.use('/skip-trace', skipTraceRouter);
router.use('/webhooks', webhookRouter);
router.use('/alerts', alertsRouter);
router.use('/drift', driftRouter);
router.use('/counties', countiesRouter);
router.use('/crm', crmRouter);
router.use('/estimates', estimatesRouter);
router.use('/notifications', notificationsRouter);
router.use('/search', searchRouter);
router.use('/documents', documentsRouter);

export default router;
