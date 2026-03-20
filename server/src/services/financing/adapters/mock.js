import crypto from 'crypto';

// Mock plans that simulate what Hearth would return
const MOCK_PLANS = [
  { id: 'plan_12mo_0apr', name: '12 Months 0% APR', term_months: 12, apr: 0, dealer_fee_percent: 12.5, min_amount: 1000, max_amount: 100000 },
  { id: 'plan_24mo_4.99', name: '24 Months 4.99% APR', term_months: 24, apr: 4.99, dealer_fee_percent: 8.0, min_amount: 1000, max_amount: 100000 },
  { id: 'plan_36mo_6.99', name: '36 Months 6.99% APR', term_months: 36, apr: 6.99, dealer_fee_percent: 5.5, min_amount: 2000, max_amount: 150000 },
  { id: 'plan_60mo_9.99', name: '60 Months 9.99% APR', term_months: 60, apr: 9.99, dealer_fee_percent: 3.0, min_amount: 5000, max_amount: 200000 },
  { id: 'plan_120mo_11.99', name: '120 Months 11.99% APR', term_months: 120, apr: 11.99, dealer_fee_percent: 1.5, min_amount: 10000, max_amount: 500000 },
];

export async function validateCredentials(apiKey, merchantId) {
  // Accept any non-empty credentials in mock mode
  return apiKey.length > 0 && merchantId.length > 0;
}

export async function fetchPlans(apiKey, merchantId) {
  return MOCK_PLANS.map(p => ({
    externalPlanId: p.id,
    name: p.name,
    termMonths: p.term_months,
    apr: p.apr,
    dealerFeePct: p.dealer_fee_percent,
    minAmount: Math.round(p.min_amount * 100),
    maxAmount: Math.round(p.max_amount * 100),
  }));
}

export async function createApplicationLink(apiKey, merchantId, { amount, customerName, customerEmail, planId, callbackUrl }) {
  // Generate a fake application ID and return the callback URL directly
  // (since there's no real lender portal to redirect to)
  const externalId = `mock_app_${crypto.randomBytes(8).toString('hex')}`;

  // In mock mode, redirect straight back to the callback URL with a simulated approval
  // The webhook would normally fire asynchronously, but for testing we'll auto-approve
  return {
    externalId,
    redirectUrl: callbackUrl,  // Skip the lender portal, go right back
  };
}

export function parseWebhook(payload, signature, secret) {
  // In mock mode, skip signature verification
  const event = JSON.parse(payload);
  const statusMap = {
    submitted: 'applied',
    approved: 'approved',
    funded: 'funded',
    declined: 'declined',
    expired: 'expired',
  };
  return {
    externalApplicationId: event.application_id,
    status: statusMap[event.status] || event.status,
    approvedAmount: event.approved_amount ? Math.round(event.approved_amount * 100) : null,
    monthlyPayment: event.monthly_payment ? Math.round(event.monthly_payment * 100) : null,
  };
}
