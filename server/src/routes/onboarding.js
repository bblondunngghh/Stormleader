import { Router } from 'express';
import { z } from 'zod';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import pool from '../db/pool.js';
import * as authService from '../services/authService.js';
import * as stripeService from '../services/stripeService.js';

const router = Router();

// ============================================================
// Validation schemas
// ============================================================

const createTenantSchema = z.object({
  companyName: z.string().min(1).max(255),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().max(30).optional(),
});

const orgSchema = z.object({
  companyPhone: z.string().max(30).optional(),
  companyWebsite: z.string().max(255).optional(),
  companyAddress: z.string().max(500).optional(),
});

const selectPlanSchema = z.object({
  planKey: z.enum(['starter', 'pro', 'enterprise']),
});

const setupPaymentSchema = z.object({
  paymentMethodId: z.string().min(1),
});

const enableAddonsSchema = z.object({
  skipTrace: z.boolean(),
  roofMeasurement: z.boolean(),
});

// ============================================================
// POST /api/onboarding/create-tenant  (no auth)
// Creates a new tenant + admin user in a single transaction.
// ============================================================
router.post('/create-tenant', validate(createTenantSchema), async (req, res, next) => {
  try {
    const { companyName, firstName, lastName, email, password, phone } = req.body;

    const result = await authService.createTenantWithAdmin(
      companyName,
      firstName,
      lastName,
      email,
      password,
      phone || null,
    );

    res.status(201).json({
      ...result,
      onboardingStep: 'org',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// All routes below require auth + tenant context
// ============================================================
router.use(authenticate, tenantScope);

// ============================================================
// PUT /api/onboarding/org
// Save company profile details.
// ============================================================
router.put('/org', validate(orgSchema), async (req, res, next) => {
  try {
    const { companyPhone, companyWebsite, companyAddress } = req.body;

    const { rows } = await pool.query(
      `UPDATE tenants
       SET
         company_phone   = COALESCE($1, company_phone),
         company_website = COALESCE($2, company_website),
         company_address = COALESCE($3, company_address),
         updated_at      = NOW()
       WHERE id = $4
       RETURNING
         id, name, slug, subscription_tier, subscription_status,
         onboarding_completed, trial_ends_at,
         company_phone, company_website, company_address`,
      [companyPhone ?? null, companyWebsite ?? null, companyAddress ?? null, req.tenantId],
    );

    if (rows.length === 0) {
      const err = new Error('Tenant not found');
      err.status = 404;
      throw err;
    }

    res.json({ tenant: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/onboarding/plans
// Returns all available subscription plans.
// ============================================================
router.get('/plans', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, key, name, price_cents, features, max_users, max_leads
       FROM subscription_plans
       ORDER BY price_cents ASC`,
    );
    res.json({ plans: rows });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/onboarding/select-plan
// Stores the chosen plan on the tenant record.
// ============================================================
router.post('/select-plan', validate(selectPlanSchema), async (req, res, next) => {
  try {
    const { planKey } = req.body;

    // Verify the plan actually exists
    const { rows: planRows } = await pool.query(
      'SELECT id, key, name, price_cents FROM subscription_plans WHERE key = $1',
      [planKey],
    );
    if (planRows.length === 0) {
      const err = new Error('Invalid plan key');
      err.status = 400;
      throw err;
    }

    await pool.query(
      `UPDATE tenants SET subscription_tier = $1, plan_changed_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [planKey, req.tenantId],
    );

    res.json({ success: true, plan: planRows[0] });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/onboarding/setup-payment
// Attaches a Stripe payment method to the tenant and creates
// the subscription if a plan has already been selected.
// Also primes tenant_skip_trace_config so add-ons can bill.
// ============================================================
router.post('/setup-payment', validate(setupPaymentSchema), async (req, res, next) => {
  try {
    const { paymentMethodId } = req.body;

    // Fetch current tenant state
    const { rows: tenantRows } = await pool.query(
      `SELECT t.id, u.email, t.subscription_tier, t.stripe_subscription_id
       FROM tenants t
       JOIN users u ON u.tenant_id = t.id
       WHERE t.id = $1 AND u.role = 'admin'
       LIMIT 1`,
      [req.tenantId],
    );

    if (tenantRows.length === 0) {
      const err = new Error('Tenant not found');
      err.status = 404;
      throw err;
    }

    const tenantEmail = tenantRows[0].email;
    const subscriptionTier = tenantRows[0].subscription_tier;

    // Ensure a Stripe customer exists, then attach the payment method
    await stripeService.getOrCreateCustomer(req.tenantId, tenantEmail);
    const pm = await stripeService.attachPaymentMethod(req.tenantId, paymentMethodId);

    // If a plan is selected and no subscription exists yet, create one
    let subscriptionId = tenantRows[0].stripe_subscription_id;
    if (subscriptionTier && subscriptionTier !== 'free' && !subscriptionId) {
      const { rows: planRows } = await pool.query(
        'SELECT stripe_price_id FROM subscription_plans WHERE key = $1',
        [subscriptionTier],
      );

      if (planRows.length > 0 && planRows[0].stripe_price_id) {
        const { rows: custRows } = await pool.query(
          'SELECT stripe_customer_id FROM tenants WHERE id = $1',
          [req.tenantId],
        );

        const Stripe = (await import('stripe')).default;
        const config = (await import('../config/env.js')).default;
        const stripe = new Stripe(config.STRIPE_SECRET_KEY);

        const subscription = await stripe.subscriptions.create({
          customer: custRows[0].stripe_customer_id,
          items: [{ price: planRows[0].stripe_price_id }],
          default_payment_method: paymentMethodId,
          metadata: { tenantId: req.tenantId },
        });

        subscriptionId = subscription.id;

        await pool.query(
          `UPDATE tenants
           SET stripe_subscription_id = $1, subscription_status = $2, updated_at = NOW()
           WHERE id = $3`,
          [subscription.id, subscription.status, req.tenantId],
        );
      }
    }

    res.json({
      success: true,
      paymentMethod: pm,
      subscriptionId,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/onboarding/enable-addons
// Toggles skip trace and/or roof measurement add-ons.
// ============================================================
router.post('/enable-addons', validate(enableAddonsSchema), async (req, res, next) => {
  try {
    const { skipTrace, roofMeasurement } = req.body;

    // Upsert the skip trace config row (it stores both add-on flags)
    const { rows } = await pool.query(
      `INSERT INTO tenant_skip_trace_config (tenant_id, enabled, roof_measurement_enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id) DO UPDATE
         SET enabled                  = $2,
             roof_measurement_enabled = $3,
             updated_at               = NOW()
       RETURNING tenant_id, enabled, roof_measurement_enabled,
                 card_last_four, card_brand, stripe_payment_method_id`,
      [req.tenantId, skipTrace, roofMeasurement],
    );

    res.json({ success: true, config: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/onboarding/complete
// Marks onboarding as finished.
// ============================================================
router.post('/complete', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE tenants
       SET onboarding_completed = true, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, slug, onboarding_completed, subscription_tier, subscription_status`,
      [req.tenantId],
    );

    if (rows.length === 0) {
      const err = new Error('Tenant not found');
      err.status = 404;
      throw err;
    }

    res.json({ success: true, tenant: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
