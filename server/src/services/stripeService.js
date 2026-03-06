import Stripe from 'stripe';
import pool from '../db/pool.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function createCustomer(tenantId, email) {
  const customer = await stripe.customers.create({ email, metadata: { tenantId } });
  await pool.query('UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2', [customer.id, tenantId]);
  return customer;
}

export async function getOrCreateCustomer(tenantId, email) {
  const { rows } = await pool.query('SELECT stripe_customer_id FROM tenants WHERE id = $1', [tenantId]);
  if (rows[0]?.stripe_customer_id) {
    return await stripe.customers.retrieve(rows[0].stripe_customer_id);
  }
  return createCustomer(tenantId, email);
}

export async function attachPaymentMethod(tenantId, paymentMethodId) {
  const { rows } = await pool.query('SELECT stripe_customer_id FROM tenants WHERE id = $1', [tenantId]);
  if (!rows[0]?.stripe_customer_id) throw new Error('No Stripe customer for tenant');

  const customerId = rows[0].stripe_customer_id;
  const pm = await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } });

  await pool.query(
    `INSERT INTO tenant_skip_trace_config (tenant_id, stripe_payment_method_id, card_last_four, card_brand)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id) DO UPDATE SET
       stripe_payment_method_id = $2, card_last_four = $3, card_brand = $4, updated_at = NOW()`,
    [tenantId, pm.id, pm.card?.last4 || '', pm.card?.brand || '']
  );

  return { id: pm.id, last4: pm.card?.last4, brand: pm.card?.brand };
}

export async function chargeForSkipTrace(tenantId, recordCount, costCentsPerRecord = 2, markupCents = 13) {
  const { rows } = await pool.query('SELECT stripe_customer_id FROM tenants WHERE id = $1', [tenantId]);
  if (!rows[0]?.stripe_customer_id) throw new Error('No Stripe customer for tenant');

  const { rows: config } = await pool.query(
    'SELECT stripe_payment_method_id FROM tenant_skip_trace_config WHERE tenant_id = $1',
    [tenantId]
  );
  if (!config[0]?.stripe_payment_method_id) throw new Error('No payment method configured');

  const totalCents = recordCount * (costCentsPerRecord + markupCents);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: 'usd',
    customer: rows[0].stripe_customer_id,
    payment_method: config[0].stripe_payment_method_id,
    off_session: true,
    confirm: true,
    description: `Skip trace: ${recordCount} records @ $${((costCentsPerRecord + markupCents) / 100).toFixed(2)}/record`,
    metadata: { tenantId, recordCount: String(recordCount) },
  });

  logger.info({ tenantId, amount: totalCents, recordCount }, 'Skip trace charge created');
  return paymentIntent;
}

/**
 * Process monthly batch billing for all tenants with unbilled skip trace usage.
 * Called by scheduler on the 1st of each month.
 */
export async function processBatchBilling() {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd);
  periodStart.setMonth(periodStart.getMonth() - 1);

  // Find tenants with unbilled skip trace usage
  const { rows: skipTraceByTenant } = await pool.query(
    `SELECT tenant_id, SUM(records_requested) as total_records
     FROM skip_trace_usage
     WHERE billed = false
     GROUP BY tenant_id
     HAVING SUM(records_requested) > 0`
  );

  // Find tenants with unbilled roof measurement usage
  const { rows: roofByTenant } = await pool.query(
    `SELECT tenant_id, COUNT(*) as total_measurements, SUM(cost_cents) as total_cents
     FROM roof_measurement_usage
     WHERE billed = false
     GROUP BY tenant_id
     HAVING COUNT(*) > 0`
  );

  // Merge into a single map of tenant_id -> { skipTraceCents, roofCents, skipTraceRecords, roofMeasurements }
  const tenantMap = new Map();
  for (const st of skipTraceByTenant) {
    tenantMap.set(st.tenant_id, {
      skipTraceRecords: Number(st.total_records),
      skipTraceCents: Number(st.total_records) * 15,
      roofMeasurements: 0,
      roofCents: 0,
    });
  }
  for (const rm of roofByTenant) {
    const existing = tenantMap.get(rm.tenant_id) || { skipTraceRecords: 0, skipTraceCents: 0, roofMeasurements: 0, roofCents: 0 };
    existing.roofMeasurements = Number(rm.total_measurements);
    existing.roofCents = Number(rm.total_cents);
    tenantMap.set(rm.tenant_id, existing);
  }

  const results = [];

  for (const [tenantId, usage] of tenantMap) {
    const totalCents = usage.skipTraceCents + usage.roofCents;

    // Skip if under Stripe minimum ($0.50)
    if (totalCents < 50) {
      logger.info({ tenantId, totalCents }, 'Batch billing: under Stripe minimum $0.50, rolling to next month');
      results.push({ tenantId, status: 'skipped', reason: 'under_minimum' });
      continue;
    }

    try {
      // Check tenant has a valid payment method
      const { rows: config } = await pool.query(
        'SELECT stripe_payment_method_id FROM tenant_skip_trace_config WHERE tenant_id = $1 AND enabled = true',
        [tenantId]
      );
      if (!config[0]?.stripe_payment_method_id) {
        logger.warn({ tenantId }, 'Batch billing: no payment method, skipping');
        results.push({ tenantId, status: 'skipped', reason: 'no_payment_method' });
        continue;
      }

      // Build description
      const descParts = [];
      if (usage.skipTraceRecords > 0) {
        descParts.push(`Skip trace: ${usage.skipTraceRecords} records @ $0.15/record`);
      }
      if (usage.roofMeasurements > 0) {
        descParts.push(`Roof measurement: ${usage.roofMeasurements} lookups @ $0.10/lookup`);
      }
      const description = descParts.join(' | ');

      const { rows: custRows } = await pool.query('SELECT stripe_customer_id FROM tenants WHERE id = $1', [tenantId]);
      if (!custRows[0]?.stripe_customer_id) {
        logger.warn({ tenantId }, 'Batch billing: no Stripe customer, skipping');
        results.push({ tenantId, status: 'skipped', reason: 'no_stripe_customer' });
        continue;
      }

      const payment = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: 'usd',
        customer: custRows[0].stripe_customer_id,
        payment_method: config[0].stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description,
        metadata: { tenantId, skipTraceRecords: String(usage.skipTraceRecords), roofMeasurements: String(usage.roofMeasurements) },
      });

      // Create invoice record
      const totalRecords = usage.skipTraceRecords + usage.roofMeasurements;
      const { rows: invoice } = await pool.query(
        `INSERT INTO skip_trace_invoices (tenant_id, stripe_payment_intent_id, total_records, total_cents, status, period_start, period_end)
         VALUES ($1, $2, $3, $4, 'paid', $5, $6)
         RETURNING id`,
        [tenantId, payment.id, totalRecords, totalCents, periodStart, periodEnd]
      );

      const invoiceId = invoice[0].id;

      // Mark skip trace usage as billed
      if (usage.skipTraceRecords > 0) {
        await pool.query(
          `UPDATE skip_trace_usage SET billed = true, invoice_id = $1 WHERE tenant_id = $2 AND billed = false`,
          [invoiceId, tenantId]
        );
      }

      // Mark roof measurement usage as billed
      if (usage.roofMeasurements > 0) {
        await pool.query(
          `UPDATE roof_measurement_usage SET billed = true, invoice_id = $1 WHERE tenant_id = $2 AND billed = false`,
          [invoiceId, tenantId]
        );
      }

      logger.info({ tenantId, totalCents, skipTraceRecords: usage.skipTraceRecords, roofMeasurements: usage.roofMeasurements }, 'Batch billing: charge successful');
      results.push({ tenantId, status: 'paid', totalCents });
    } catch (err) {
      // Create failed invoice for tracking
      await pool.query(
        `INSERT INTO skip_trace_invoices (tenant_id, total_records, total_cents, status, period_start, period_end)
         VALUES ($1, $2, $3, 'failed', $4, $5)`,
        [tenantId, usage.skipTraceRecords + usage.roofMeasurements, totalCents, periodStart, periodEnd]
      ).catch(() => {});

      logger.error({ err, tenantId }, 'Batch billing: charge failed');
      results.push({ tenantId, status: 'failed', error: err.message });
    }
  }

  logger.info({ tenantsProcessed: tenantMap.size }, 'Batch billing complete');
  return results;
}

export async function removePaymentMethod(tenantId, paymentMethodId) {
  await stripe.paymentMethods.detach(paymentMethodId);
  await pool.query(
    `UPDATE tenant_skip_trace_config
     SET stripe_payment_method_id = NULL, card_last_four = NULL, card_brand = NULL, updated_at = NOW()
     WHERE tenant_id = $1`,
    [tenantId]
  );
}
