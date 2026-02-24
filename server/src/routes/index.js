import { Router } from 'express';
import authRouter from './auth.js';
import stormsRouter from './storms.js';
import mapRouter from './map.js';
import dashboardRouter from './dashboard.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/storms', stormsRouter);
router.use('/map', mapRouter);
router.use('/dashboard', dashboardRouter);

export default router;
