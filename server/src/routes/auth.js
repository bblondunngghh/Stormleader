import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import * as authService from '../services/authService.js';
import pool from '../db/pool.js';

const router = Router();

// Rate limiters for auth endpoints to prevent brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 refreshes per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many refresh attempts. Please try again later.' },
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  tenantSlug: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post('/register', registerLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, tenantSlug } = req.body;
    const result = await authService.register(email, password, firstName, lastName, tenantSlug);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
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
      `SELECT
         u.id,
         u.tenant_id,
         u.email,
         u.role,
         u.first_name,
         u.last_name,
         t.name                  AS tenant_name,
         t.slug                  AS tenant_slug,
         t.subscription_tier,
         t.subscription_status,
         t.onboarding_completed,
         t.trial_ends_at
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [req.user.id],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    res.json({
      user: {
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        role: u.role,
        tenantId: u.tenant_id,
      },
      tenant: {
        tenantName: u.tenant_name,
        tenantSlug: u.tenant_slug,
        subscriptionTier: u.subscription_tier,
        subscriptionStatus: u.subscription_status,
        onboardingCompleted: u.onboarding_completed,
        trialEndsAt: u.trial_ends_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/me — update profile (name, email)
router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const { firstName, lastName, email } = req.body;
    for (const [k, v] of [['firstName', firstName], ['lastName', lastName], ['email', email]]) {
      if (v !== undefined && typeof v !== 'string') {
        return res.status(400).json({ error: `${k} must be a string` });
      }
    }
    if (email !== undefined && !email.trim()) {
      return res.status(400).json({ error: 'email must be a non-empty string' });
    }
    const sets = [];
    const params = [];
    if (firstName !== undefined) { params.push(firstName); sets.push(`first_name = $${params.length}`); }
    if (lastName !== undefined) { params.push(lastName); sets.push(`last_name = $${params.length}`); }
    if (email !== undefined) { params.push(email); sets.push(`email = $${params.length}`); }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.user.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING id, first_name, last_name, email, role`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    res.json({ user: { id: u.id, firstName: u.first_name, lastName: u.last_name, email: u.email, role: u.role } });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', refreshLimiter, validate(refreshSchema), async (req, res, next) => {
  try {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
