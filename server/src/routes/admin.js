/**
 * admin.js — Super-admin dashboard API routes
 *
 * All routes require authenticate + authorize('super_admin').
 * No tenantScope middleware: super admins operate across all tenants.
 *
 * Mounted at: /api/admin
 */

import { Router } from 'express';
import pool from '../db/pool.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';

const router = Router();

// All admin routes require super_admin role
router.use(authenticate, authorize('super_admin'));

// ---------------------------------------------------------------------------
// GET /api/admin/overview
// Aggregate business metrics across all tenants
// ---------------------------------------------------------------------------
router.get('/overview', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      WITH
        tenant_counts AS (
          SELECT
            COUNT(*)                                                    AS total_tenants,
            COUNT(*) FILTER (WHERE subscription_status = 'active')     AS active_tenants,
            COUNT(*) FILTER (WHERE subscription_status = 'trial')      AS trial_tenants,
            COUNT(*) FILTER (
              WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
            )                                                           AS new_tenants_this_month
          FROM tenants
        ),
        user_counts AS (
          SELECT
            COUNT(*)                                                    AS total_users,
            COUNT(*) FILTER (
              WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
            )                                                           AS new_users_this_month
          FROM users
        ),
        lead_counts AS (
          SELECT COUNT(*) AS total_leads
          FROM leads
          WHERE deleted_at IS NULL
        ),
        mrr_calc AS (
          SELECT COALESCE(SUM(sp.price_cents), 0) AS mrr
          FROM tenants t
          JOIN subscription_plans sp ON sp.key = t.subscription_tier
          WHERE t.subscription_status = 'active'
        ),
        skip_trace_rev AS (
          SELECT COALESCE(SUM(cost_cents), 0) AS skip_trace_revenue_30d
          FROM skip_trace_usage
          WHERE created_at >= NOW() - INTERVAL '30 days'
        ),
        roof_meas_rev AS (
          SELECT COALESCE(SUM(cost_cents), 0) AS roof_measurement_revenue_30d
          FROM roof_measurement_usage
          WHERE created_at >= NOW() - INTERVAL '30 days'
        )
      SELECT
        tc.total_tenants,
        tc.active_tenants,
        tc.trial_tenants,
        tc.new_tenants_this_month,
        uc.total_users,
        uc.new_users_this_month,
        lc.total_leads,
        m.mrr,
        st.skip_trace_revenue_30d,
        rm.roof_measurement_revenue_30d
      FROM tenant_counts tc
      CROSS JOIN user_counts uc
      CROSS JOIN lead_counts lc
      CROSS JOIN mrr_calc m
      CROSS JOIN skip_trace_rev st
      CROSS JOIN roof_meas_rev rm
    `);

    const row = rows[0];
    res.json({
      totalTenants:              Number(row.total_tenants),
      activeTenants:             Number(row.active_tenants),
      trialTenants:              Number(row.trial_tenants),
      newTenantsThisMonth:       Number(row.new_tenants_this_month),
      totalUsers:                Number(row.total_users),
      newUsersThisMonth:         Number(row.new_users_this_month),
      totalLeads:                Number(row.total_leads),
      mrr:                       Number(row.mrr),
      skipTraceRevenue30d:       Number(row.skip_trace_revenue_30d),
      roofMeasurementRevenue30d: Number(row.roof_measurement_revenue_30d),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/tenants
// List all tenants with summary stats.
// Query params: ?search=&sort=created_at&order=desc
// ---------------------------------------------------------------------------
router.get('/tenants', async (req, res, next) => {
  try {
    const {
      search = '',
      sort   = 'created_at',
      order  = 'desc',
    } = req.query;

    // Whitelist sortable columns to prevent SQL injection
    const SORTABLE = {
      created_at:    't.created_at',
      name:          't.name',
      user_count:    'user_count',
      lead_count:    'lead_count',
      last_activity: 'last_activity',
    };
    const sortCol  = SORTABLE[sort] ?? 't.created_at';
    const sortDir  = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const { rows } = await pool.query(`
      SELECT
        t.id,
        t.name,
        t.slug,
        t.subscription_tier,
        t.subscription_status,
        t.onboarding_completed,
        t.stripe_customer_id,
        t.trial_ends_at,
        t.created_at,
        -- User count
        COALESCE(u.user_count, 0)                      AS user_count,
        -- Lead count (non-deleted)
        COALESCE(l.lead_count, 0)                      AS lead_count,
        -- Skip trace usage last 30 days (record count, not cents)
        COALESCE(st.skip_trace_usage_30d, 0)           AS skip_trace_usage_30d,
        -- Roof measurement usage last 30 days
        COALESCE(rm.roof_measurement_usage_30d, 0)     AS roof_measurement_usage_30d,
        -- Most recent lead activity
        la.last_activity
      FROM tenants t

      -- User count per tenant
      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS user_count
        FROM users
        GROUP BY tenant_id
      ) u ON u.tenant_id = t.id

      -- Lead count per tenant
      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS lead_count
        FROM leads
        WHERE deleted_at IS NULL
        GROUP BY tenant_id
      ) l ON l.tenant_id = t.id

      -- Skip trace usage count in last 30 days
      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS skip_trace_usage_30d
        FROM skip_trace_usage
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY tenant_id
      ) st ON st.tenant_id = t.id

      -- Roof measurement usage count in last 30 days
      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS roof_measurement_usage_30d
        FROM roof_measurement_usage
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY tenant_id
      ) rm ON rm.tenant_id = t.id

      -- Most recent lead update per tenant (proxy for activity)
      LEFT JOIN (
        SELECT tenant_id, MAX(updated_at) AS last_activity
        FROM leads
        WHERE deleted_at IS NULL
        GROUP BY tenant_id
      ) la ON la.tenant_id = t.id

      WHERE ($1 = '' OR t.name ILIKE '%' || $1 || '%' OR t.slug ILIKE '%' || $1 || '%')

      ORDER BY ${sortCol} ${sortDir} NULLS LAST
    `, [search]);

    res.json(rows.map(r => ({
      id:                        r.id,
      name:                      r.name,
      slug:                      r.slug,
      subscriptionTier:          r.subscription_tier,
      subscriptionStatus:        r.subscription_status,
      onboardingCompleted:       r.onboarding_completed,
      stripeCustomerId:          r.stripe_customer_id,
      trialEndsAt:               r.trial_ends_at,
      createdAt:                 r.created_at,
      userCount:                 Number(r.user_count),
      leadCount:                 Number(r.lead_count),
      skipTraceUsage30d:         Number(r.skip_trace_usage_30d),
      roofMeasurementUsage30d:   Number(r.roof_measurement_usage_30d),
      lastActivity:              r.last_activity,
    })));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/tenants/:id
// Detailed tenant info: users, skip-trace config, billing summary
// ---------------------------------------------------------------------------
router.get('/tenants/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch core tenant row
    const { rows: tenantRows } = await pool.query(`
      SELECT
        t.*,
        COALESCE(sp.price_cents, 0) AS plan_price_cents,
        COALESCE(sp.name, t.subscription_tier) AS plan_label
      FROM tenants t
      LEFT JOIN subscription_plans sp ON sp.key = t.subscription_tier
      WHERE t.id = $1
    `, [id]);

    if (!tenantRows.length) {
      const err = new Error('Tenant not found');
      err.status = 404;
      throw err;
    }
    const tenant = tenantRows[0];

    // Fetch users for this tenant
    const { rows: users } = await pool.query(`
      SELECT id, first_name, last_name, email, role, created_at
      FROM users
      WHERE tenant_id = $1
      ORDER BY created_at ASC
    `, [id]);

    // Activity count in last 30 days (from activities table)
    const { rows: activityRows } = await pool.query(`
      SELECT COUNT(*) AS activity_count_30d
      FROM activities
      WHERE tenant_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
    `, [id]);

    // Skip trace config
    const { rows: stConfigRows } = await pool.query(`
      SELECT
        enabled,
        stripe_payment_method_id IS NOT NULL AS payment_method_set,
        card_last_four,
        card_brand,
        markup_cents,
        roof_measurement_enabled
      FROM tenant_skip_trace_config
      WHERE tenant_id = $1
    `, [id]);

    // Billing summary: total skip-trace spend (all time) + last 5 invoices
    const { rows: billingRows } = await pool.query(`
      SELECT
        COALESCE(SUM(cost_cents), 0) AS total_skip_trace_spent,
        COUNT(*)                     AS total_skip_trace_jobs
      FROM skip_trace_usage
      WHERE tenant_id = $1
    `, [id]);

    const { rows: roofBillingRows } = await pool.query(`
      SELECT
        COALESCE(SUM(cost_cents), 0) AS total_roof_measurement_spent,
        COUNT(*)                     AS total_roof_measurements
      FROM roof_measurement_usage
      WHERE tenant_id = $1
    `, [id]);

    const { rows: invoices } = await pool.query(`
      SELECT id, total_cents, status, period_start, period_end, created_at
      FROM skip_trace_invoices
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [id]);

    const { rows: leadStats } = await pool.query(`
      SELECT
        COUNT(*)                                               AS total_leads,
        COUNT(*) FILTER (WHERE stage = 'sold')                AS won_leads,
        COUNT(*) FILTER (WHERE stage = 'lost')                AS lost_leads,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '30 days'
        )                                                      AS leads_30d
      FROM leads
      WHERE tenant_id = $1
        AND deleted_at IS NULL
    `, [id]);

    const stConfig = stConfigRows[0] ?? null;
    const billing  = billingRows[0];
    const roofBill = roofBillingRows[0];
    const leads    = leadStats[0];

    res.json({
      id:                   tenant.id,
      name:                 tenant.name,
      slug:                 tenant.slug,
      subscriptionTier:     tenant.subscription_tier,
      subscriptionStatus:   tenant.subscription_status,
      onboardingCompleted:  tenant.onboarding_completed,
      trialEndsAt:          tenant.trial_ends_at,
      stripeCustomerId:     tenant.stripe_customer_id,
      planPriceCents:       Number(tenant.plan_price_cents),
      planLabel:            tenant.plan_label,
      createdAt:            tenant.created_at,
      updatedAt:            tenant.updated_at,
      users: users.map(u => ({
        id:        u.id,
        firstName: u.first_name,
        lastName:  u.last_name,
        email:     u.email,
        role:      u.role,
        createdAt: u.created_at,
      })),
      activityCount30d: Number(activityRows[0]?.activity_count_30d ?? 0),
      skipTraceConfig: stConfig ? {
        enabled:              stConfig.enabled,
        paymentMethodSet:     stConfig.payment_method_set,
        cardLastFour:         stConfig.card_last_four,
        cardBrand:            stConfig.card_brand,
        markupCents:          stConfig.markup_cents,
        roofMeasurementEnabled: stConfig.roof_measurement_enabled,
      } : null,
      billing: {
        totalSkipTraceSpent:      Number(billing.total_skip_trace_spent),
        totalSkipTraceJobs:       Number(billing.total_skip_trace_jobs),
        totalRoofMeasurementSpent: Number(roofBill.total_roof_measurement_spent),
        totalRoofMeasurements:    Number(roofBill.total_roof_measurements),
        invoices: invoices.map(inv => ({
          id:          inv.id,
          totalCents:  inv.total_cents,
          status:      inv.status,
          periodStart: inv.period_start,
          periodEnd:   inv.period_end,
          createdAt:   inv.created_at,
        })),
      },
      leads: {
        total:   Number(leads.total_leads),
        won:     Number(leads.won_leads),
        lost:    Number(leads.lost_leads),
        last30d: Number(leads.leads_30d),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/tenants/:id
// Update a tenant's subscription tier or status
// Body: { subscriptionTier?, subscriptionStatus? }
// ---------------------------------------------------------------------------
router.put('/tenants/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { subscriptionTier, subscriptionStatus } = req.body;

    const VALID_TIERS    = ['free', 'starter', 'pro', 'enterprise'];
    const VALID_STATUSES = ['trial', 'active', 'past_due', 'cancelled', 'suspended'];

    if (subscriptionTier && !VALID_TIERS.includes(subscriptionTier)) {
      const err = new Error(`Invalid subscription tier. Must be one of: ${VALID_TIERS.join(', ')}`);
      err.status = 400;
      throw err;
    }
    if (subscriptionStatus && !VALID_STATUSES.includes(subscriptionStatus)) {
      const err = new Error(`Invalid subscription status. Must be one of: ${VALID_STATUSES.join(', ')}`);
      err.status = 400;
      throw err;
    }
    if (!subscriptionTier && !subscriptionStatus) {
      const err = new Error('Provide at least one of: subscriptionTier, subscriptionStatus');
      err.status = 400;
      throw err;
    }

    // Build dynamic SET clause with only provided fields
    const setClauses = [];
    const values     = [];
    let   paramIdx   = 1;

    if (subscriptionTier) {
      setClauses.push(`subscription_tier = $${paramIdx++}`);
      values.push(subscriptionTier);
    }
    if (subscriptionStatus) {
      setClauses.push(`subscription_status = $${paramIdx++}`);
      values.push(subscriptionStatus);
    }
    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(`
      UPDATE tenants
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIdx}
      RETURNING id, name, slug, subscription_tier, subscription_status,
                onboarding_completed, trial_ends_at, updated_at
    `, values);

    if (!rows.length) {
      const err = new Error('Tenant not found');
      err.status = 404;
      throw err;
    }

    const t = rows[0];
    res.json({
      id:                  t.id,
      name:                t.name,
      slug:                t.slug,
      subscriptionTier:    t.subscription_tier,
      subscriptionStatus:  t.subscription_status,
      onboardingCompleted: t.onboarding_completed,
      trialEndsAt:         t.trial_ends_at,
      updatedAt:           t.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/revenue
// Revenue chart data for last 12 months (no gaps via generate_series)
// ---------------------------------------------------------------------------
router.get('/revenue', async (req, res, next) => {
  try {
    // Monthly subscription revenue: count active tenants * their plan price
    // for each month in the series (based on tenant created_at and status snapshot,
    // we use a simplified model: tenants active at query time contribute to all months
    // since creation up through the current month).
    const { rows: monthly } = await pool.query(`
      WITH months AS (
        SELECT
          TO_CHAR(generate_series, 'YYYY-MM') AS month,
          DATE_TRUNC('month', generate_series)  AS month_start
        FROM generate_series(
          DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
          DATE_TRUNC('month', NOW()),
          '1 month'::interval
        )
      ),
      skip_monthly AS (
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COALESCE(SUM(cost_cents), 0)                        AS revenue,
          COUNT(*)                                             AS job_count
        FROM skip_trace_usage
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY 1
      ),
      roof_monthly AS (
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COALESCE(SUM(cost_cents), 0)                        AS revenue,
          COUNT(*)                                             AS job_count
        FROM roof_measurement_usage
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY 1
      ),
      sub_monthly AS (
        -- For each month, sum plan prices for tenants whose subscription was active
        -- Simplified: include tenants created on or before month_start with active status
        SELECT
          m.month,
          COALESCE(SUM(sp.price_cents), 0) AS sub_revenue
        FROM months m
        LEFT JOIN tenants t
          ON t.created_at <= (m.month_start + INTERVAL '1 month')
          AND t.subscription_status = 'active'
        LEFT JOIN subscription_plans sp ON sp.key = t.subscription_tier
        GROUP BY m.month
      )
      SELECT
        m.month,
        COALESCE(sm.sub_revenue, 0)   AS subscriptions,
        COALESCE(st.revenue, 0)       AS skip_trace,
        COALESCE(rm.revenue, 0)       AS roof_measurement,
        COALESCE(sm.sub_revenue, 0)
          + COALESCE(st.revenue, 0)
          + COALESCE(rm.revenue, 0)   AS total
      FROM months m
      LEFT JOIN sub_monthly sm  ON sm.month = m.month
      LEFT JOIN skip_monthly st ON st.month = m.month
      LEFT JOIN roof_monthly rm ON rm.month = m.month
      ORDER BY m.month ASC
    `);

    // Skip trace volume by month (count + revenue)
    const { rows: skipVolume } = await pool.query(`
      WITH months AS (
        SELECT TO_CHAR(generate_series, 'YYYY-MM') AS month
        FROM generate_series(
          DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
          DATE_TRUNC('month', NOW()),
          '1 month'::interval
        )
      ),
      skip_monthly AS (
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)                                             AS count,
          COALESCE(SUM(cost_cents), 0)                        AS revenue
        FROM skip_trace_usage
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY 1
      )
      SELECT
        m.month,
        COALESCE(s.count, 0)   AS count,
        COALESCE(s.revenue, 0) AS revenue
      FROM months m
      LEFT JOIN skip_monthly s ON s.month = m.month
      ORDER BY m.month ASC
    `);

    // Roof measurement volume by month
    const { rows: roofVolume } = await pool.query(`
      WITH months AS (
        SELECT TO_CHAR(generate_series, 'YYYY-MM') AS month
        FROM generate_series(
          DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
          DATE_TRUNC('month', NOW()),
          '1 month'::interval
        )
      ),
      roof_monthly AS (
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)                                             AS count,
          COALESCE(SUM(cost_cents), 0)                        AS revenue
        FROM roof_measurement_usage
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY 1
      )
      SELECT
        m.month,
        COALESCE(r.count, 0)   AS count,
        COALESCE(r.revenue, 0) AS revenue
      FROM months m
      LEFT JOIN roof_monthly r ON r.month = m.month
      ORDER BY m.month ASC
    `);

    res.json({
      monthly: monthly.map(r => ({
        month:           r.month,
        subscriptions:   Number(r.subscriptions),
        skipTrace:       Number(r.skip_trace),
        roofMeasurement: Number(r.roof_measurement),
        total:           Number(r.total),
      })),
      skipTraceVolume: skipVolume.map(r => ({
        month:   r.month,
        count:   Number(r.count),
        revenue: Number(r.revenue),
      })),
      roofMeasurementVolume: roofVolume.map(r => ({
        month:   r.month,
        count:   Number(r.count),
        revenue: Number(r.revenue),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/usage
// Add-on usage stats across all tenants
// ---------------------------------------------------------------------------
router.get('/usage', async (req, res, next) => {
  try {
    // Skip trace totals
    const { rows: stTotals } = await pool.query(`
      SELECT
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30d
      FROM skip_trace_usage
    `);

    // Top 10 tenants by skip trace usage (all time)
    const { rows: stTopTenants } = await pool.query(`
      SELECT
        t.id        AS tenant_id,
        t.name      AS tenant_name,
        COUNT(stu.id) AS count
      FROM skip_trace_usage stu
      JOIN tenants t ON t.id = stu.tenant_id
      GROUP BY t.id, t.name
      ORDER BY count DESC
      LIMIT 10
    `);

    // Roof measurement totals
    const { rows: rmTotals } = await pool.query(`
      SELECT
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30d
      FROM roof_measurement_usage
    `);

    // Top 10 tenants by roof measurement usage (all time)
    const { rows: rmTopTenants } = await pool.query(`
      SELECT
        t.id          AS tenant_id,
        t.name        AS tenant_name,
        COUNT(rmu.id) AS count
      FROM roof_measurement_usage rmu
      JOIN tenants t ON t.id = rmu.tenant_id
      GROUP BY t.id, t.name
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      skipTrace: {
        total:      Number(stTotals[0].total),
        last30d:    Number(stTotals[0].last_30d),
        topTenants: stTopTenants.map(r => ({
          tenantId:   r.tenant_id,
          tenantName: r.tenant_name,
          count:      Number(r.count),
        })),
      },
      roofMeasurement: {
        total:      Number(rmTotals[0].total),
        last30d:    Number(rmTotals[0].last_30d),
        topTenants: rmTopTenants.map(r => ({
          tenantId:   r.tenant_id,
          tenantName: r.tenant_name,
          count:      Number(r.count),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
