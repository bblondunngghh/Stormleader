import { Router } from 'express';
import { z } from 'zod';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import * as authService from '../services/authService.js';
import pool from '../db/pool.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  tenantSlug: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, tenantSlug } = req.body;
    const result = await authService.register(email, password, firstName, lastName, tenantSlug);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password, tenantSlug } = req.body;
    const result = await authService.login(email, password, tenantSlug);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, tenant_id, email, role, first_name, last_name FROM users WHERE id = $1',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    res.json({ user: { id: u.id, email: u.email, firstName: u.first_name, lastName: u.last_name, role: u.role, tenantId: u.tenant_id } });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
