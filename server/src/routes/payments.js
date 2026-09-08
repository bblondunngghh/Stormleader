import express, { Router } from 'express';
import Stripe from 'stripe';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { parsePagination } from '../utils/pagination.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Fee structure constants
const CARD_FEE_PERCENT = 0.029;
const CARD_FEE_FLAT = 25; // cents
const ACH_FEE_PERCENT = 0.008;
const ACH_FEE_MAX = 2500; // cents ($25)

function calculateApplicationFee(amountCents, paymentMethod) {
  if (paymentMethod === 'ach') {
    const fee = Math.round(amountCents * ACH_FEE_PERCENT);
    return Math.min(fee, ACH_FEE_MAX);
  }
  // card
  return Math.round(amountCents * CARD_FEE_PERCENT) + CARD_FEE_FLAT;
}

const router = Router();

// ============================================================
// AUTHENTICATED ENDPOINTS (tenant-scoped)
// ============================================================

// POST /api/payments/connect/onboard — Create Stripe Connect account & return onboarding URL
router.post('/connect/onboard', authenticate, tenantScope, async (req, res, next) => {
  try {
    // Check if tenant already has a stripe account
    const { rows: [tenant] } = await pool.query(
      'SELECT stripe_account_id, stripe_onboarding_complete FROM tenants WHERE id = $1',
      [req.tenantId]
    );

    let accountId = tenant?.stripe_account_id;

    if (!accountId) {
      // Fetch tenant info for prefill
      const { rows: [tenantInfo] } = await pool.query(
        'SELECT name, company_phone, company_website, sender_email FROM tenants WHERE id = $1',
        [req.tenantId]
      );

      // Create a Standard Connect account
      const account = await stripe.accounts.create({
        type: 'standard',
        country: 'US',
        email: tenantInfo.sender_email || req.user.email,
        business_type: 'company',
        company: {
          name: tenantInfo.name || undefined,
          phone: tenantInfo.company_phone || undefined,
        },
        business_profile: {
          mcc: '1761', // Roofing/Siding/Sheet Metal
          url: tenantInfo.company_website || undefined,
        },
        metadata: {
          tenant_id: req.tenantId,
          platform: 'stormpipe',
        },
      });

      accountId = account.id;

      await pool.query(
        'UPDATE tenants SET stripe_account_id = $1, updated_at = NOW() WHERE id = $2',
        [accountId, req.tenantId]
      );

      logger.info({ tenantId: req.tenantId, stripeAccountId: accountId }, 'Stripe Connect account created');
    }

    // Create an account link for onboarding
    const origin = req.headers.origin || process.env.APP_URL || 'http://localhost:5173';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/settings?tab=payments&stripe=refresh`,
      return_url: `${origin}/settings?tab=payments&stripe=complete`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url, accountId });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/connect/status — Check Stripe onboarding status
router.get('/connect/status', authenticate, tenantScope, async (req, res, next) => {
  try {
    const { rows: [tenant] } = await pool.query(
      'SELECT stripe_account_id, stripe_onboarding_complete FROM tenants WHERE id = $1',
      [req.tenantId]
    );

    if (!tenant?.stripe_account_id) {
      return res.json({
        connected: false,
        onboardingComplete: false,
        accountId: null,
      });
    }

    // Fetch latest status from Stripe
    const account = await stripe.accounts.retrieve(tenant.stripe_account_id);
    const chargesEnabled = account.charges_enabled;
    const payoutsEnabled = account.payouts_enabled;
    const detailsSubmitted = account.details_submitted;
    const onboardingComplete = chargesEnabled && payoutsEnabled && detailsSubmitted;

    // Update our DB if status changed
    if (onboardingComplete !== tenant.stripe_onboarding_complete) {
      await pool.query(
        'UPDATE tenants SET stripe_onboarding_complete = $1, updated_at = NOW() WHERE id = $2',
        [onboardingComplete, req.tenantId]
      );
    }

    res.json({
      connected: true,
      onboardingComplete,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
      accountId: tenant.stripe_account_id,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/connect/refresh — Get a new onboarding link
router.post('/connect/refresh', authenticate, tenantScope, async (req, res, next) => {
  try {
    const { rows: [tenant] } = await pool.query(
      'SELECT stripe_account_id FROM tenants WHERE id = $1',
      [req.tenantId]
    );

    if (!tenant?.stripe_account_id) {
      return res.status(400).json({ error: 'No Stripe account found. Please start onboarding first.' });
    }

    const origin = req.headers.origin || process.env.APP_URL || 'http://localhost:5173';
    const accountLink = await stripe.accountLinks.create({
      account: tenant.stripe_account_id,
      refresh_url: `${origin}/settings?tab=payments&stripe=refresh`,
      return_url: `${origin}/settings?tab=payments&stripe=complete`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/create-intent — Create payment intent for an estimate (authenticated)
router.post('/create-intent', authenticate, tenantScope, async (req, res, next) => {
  try {
    const { estimateId, paymentMethod = 'card', customerEmail } = req.body;

    if (!estimateId) {
      return res.status(400).json({ error: 'estimateId is required' });
    }

    // Get estimate details
    const { rows: [estimate] } = await pool.query(
      `SELECT e.id, e.total, e.customer_email, e.customer_name, e.status AS estimate_status
       FROM estimates e
       WHERE e.id = $1 AND e.tenant_id = $2`,
      [estimateId, req.tenantId]
    );

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Get tenant's Stripe account
    const { rows: [tenant] } = await pool.query(
      'SELECT stripe_account_id, stripe_onboarding_complete FROM tenants WHERE id = $1',
      [req.tenantId]
    );

    if (!tenant?.stripe_account_id || !tenant.stripe_onboarding_complete) {
      return res.status(400).json({ error: 'Stripe Connect account not set up. Complete onboarding first.' });
    }

    const amountCents = Math.round(Number(estimate.total) * 100);
    if (amountCents < 50) {
      return res.status(400).json({ error: 'Amount must be at least $0.50' });
    }

    const applicationFee = calculateApplicationFee(amountCents, paymentMethod);
    const email = customerEmail || estimate.customer_email;

    const paymentIntentParams = {
      amount: amountCents,
      currency: 'usd',
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: tenant.stripe_account_id,
      },
      metadata: {
        tenant_id: req.tenantId,
        estimate_id: estimateId,
        platform: 'stormpipe',
      },
      description: `Estimate payment - ${estimate.customer_name || 'Customer'}`,
    };

    if (paymentMethod === 'ach') {
      paymentIntentParams.payment_method_types = ['us_bank_account'];
    } else {
      paymentIntentParams.payment_method_types = ['card'];
    }

    if (email) {
      paymentIntentParams.receipt_email = email;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Record the payment
    await pool.query(
      `INSERT INTO payments (tenant_id, estimate_id, stripe_payment_intent_id, amount, application_fee, status, payment_method, customer_email)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)`,
      [req.tenantId, estimateId, paymentIntent.id, amountCents, applicationFee, paymentMethod, email]
    );

    logger.info({ tenantId: req.tenantId, estimateId, paymentIntentId: paymentIntent.id, amount: amountCents }, 'Payment intent created');

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountCents,
      applicationFee,
      stripeAccountId: tenant.stripe_account_id,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/history — Payment history for tenant
router.get('/history', authenticate, tenantScope, async (req, res, next) => {
  try {
    const { status } = req.query;
    const { limit, offset } = parsePagination(req.query);

    let query = `
      SELECT p.id, p.estimate_id, p.stripe_payment_intent_id, p.amount, p.application_fee,
             p.status, p.payment_method, p.customer_email, p.created_at, p.updated_at,
             e.estimate_number, e.customer_name
      FROM payments p
      LEFT JOIN estimates e ON e.id = p.estimate_id AND e.tenant_id = p.tenant_id
      WHERE p.tenant_id = $1
    `;
    const params = [req.tenantId];
    let paramIdx = 2;

    if (status) {
      query += ` AND p.status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    const { rows } = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM payments WHERE tenant_id = $1';
    const countParams = [req.tenantId];
    if (status) {
      countQuery += ' AND status = $2';
      countParams.push(status);
    }
    const { rows: [{ count }] } = await pool.query(countQuery, countParams);

    res.json({
      payments: rows,
      total: parseInt(count, 10),
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// PUBLIC ENDPOINTS (no auth)
// ============================================================

// POST /api/payments/public/create-intent — Customer creates payment intent from estimate token
router.post('/public/create-intent', async (req, res, next) => {
  try {
    const { token, paymentMethod = 'card', customerEmail } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Estimate token is required' });
    }

    // Look up estimate by public token
    const { rows: [estimate] } = await pool.query(
      `SELECT e.id, e.tenant_id, e.total, e.customer_email, e.customer_name, e.status AS estimate_status,
              t.stripe_account_id, t.stripe_onboarding_complete, t.name AS company_name
       FROM estimates e
       JOIN tenants t ON t.id = e.tenant_id
       WHERE e.public_token = $1`,
      [token]
    );

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found or expired' });
    }

    if (!estimate.stripe_account_id || !estimate.stripe_onboarding_complete) {
      return res.status(400).json({ error: 'This company has not set up payments yet' });
    }

    // Check if estimate has already been paid
    const { rows: existingPayments } = await pool.query(
      `SELECT id FROM payments WHERE estimate_id = $1 AND status = 'succeeded' LIMIT 1`,
      [estimate.id]
    );
    if (existingPayments.length > 0) {
      return res.status(400).json({ error: 'This estimate has already been paid' });
    }

    const amountCents = Math.round(Number(estimate.total) * 100);
    if (amountCents < 50) {
      return res.status(400).json({ error: 'Amount must be at least $0.50' });
    }

    const applicationFee = calculateApplicationFee(amountCents, paymentMethod);
    const email = customerEmail || estimate.customer_email;

    const paymentIntentParams = {
      amount: amountCents,
      currency: 'usd',
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: estimate.stripe_account_id,
      },
      metadata: {
        tenant_id: estimate.tenant_id,
        estimate_id: estimate.id,
        platform: 'stormpipe',
        source: 'public_estimate',
      },
      description: `Estimate payment - ${estimate.customer_name || 'Customer'} via ${estimate.company_name}`,
    };

    if (paymentMethod === 'ach') {
      paymentIntentParams.payment_method_types = ['us_bank_account'];
    } else {
      paymentIntentParams.payment_method_types = ['card'];
    }

    if (email) {
      paymentIntentParams.receipt_email = email;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Record the payment
    await pool.query(
      `INSERT INTO payments (tenant_id, estimate_id, stripe_payment_intent_id, amount, application_fee, status, payment_method, customer_email)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)`,
      [estimate.tenant_id, estimate.id, paymentIntent.id, amountCents, applicationFee, paymentMethod, email]
    );

    logger.info({ estimateId: estimate.id, paymentIntentId: paymentIntent.id, amount: amountCents, source: 'public' }, 'Public payment intent created');

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountCents,
      applicationFee,
      stripeAccountId: estimate.stripe_account_id,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/webhook — Stripe webhook handler
// NOTE: This route needs raw body. It must be registered BEFORE express.json() in app.js,
// or use express.raw() middleware on this specific route.
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error({ err: err.message }, 'Stripe webhook signature verification failed');
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const { rows } = await pool.query(
          `UPDATE payments SET status = 'succeeded', updated_at = NOW()
           WHERE stripe_payment_intent_id = $1
           RETURNING id, tenant_id, estimate_id, amount`,
          [pi.id]
        );

        if (rows.length > 0) {
          const payment = rows[0];
          logger.info({ paymentId: payment.id, amount: payment.amount, stripePI: pi.id }, 'Payment succeeded');

          // Update estimate status to paid if linked
          if (payment.estimate_id) {
            await pool.query(
              `UPDATE estimates SET status = 'paid', updated_at = NOW() WHERE id = $1`,
              [payment.estimate_id]
            );
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const { rows } = await pool.query(
          `UPDATE payments SET status = 'failed', updated_at = NOW()
           WHERE stripe_payment_intent_id = $1
           RETURNING id, tenant_id, estimate_id`,
          [pi.id]
        );

        if (rows.length > 0) {
          logger.warn({ paymentId: rows[0].id, stripePI: pi.id, failureMessage: pi.last_payment_error?.message }, 'Payment failed');
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const piId = charge.payment_intent;
        if (piId) {
          await pool.query(
            `UPDATE payments SET status = 'refunded', updated_at = NOW()
             WHERE stripe_payment_intent_id = $1`,
            [piId]
          );
          logger.info({ stripePI: piId }, 'Payment refunded');
        }
        break;
      }

      default:
        logger.debug({ eventType: event.type }, 'Unhandled Stripe webhook event');
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err, eventType: event.type }, 'Error processing Stripe webhook');
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

export default router;
