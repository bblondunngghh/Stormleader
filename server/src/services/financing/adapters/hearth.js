import crypto from 'crypto';

const HEARTH_BASE_URL = process.env.HEARTH_API_URL || 'https://api.gethearth.com/v1';

async function hearthFetch(path, apiKey, options = {}) {
  const res = await fetch(`${HEARTH_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Hearth API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function validateCredentials(apiKey, merchantId) {
  try {
    await hearthFetch(`/merchants/${merchantId}`, apiKey);
    return true;
  } catch {
    return false;
  }
}

export async function fetchPlans(apiKey, merchantId) {
  const data = await hearthFetch(`/merchants/${merchantId}/plans`, apiKey);
  return (data.plans || []).map(p => ({
    externalPlanId: p.id,
    name: p.name,
    termMonths: p.term_months,
    apr: p.apr,
    dealerFeePct: p.dealer_fee_percent || 0,
    minAmount: Math.round((p.min_amount || 0) * 100),
    maxAmount: Math.round((p.max_amount || 500000) * 100),
  }));
}

export async function createApplicationLink(apiKey, merchantId, { amount, customerName, customerEmail, planId, callbackUrl }) {
  const data = await hearthFetch(`/merchants/${merchantId}/applications`, apiKey, {
    method: 'POST',
    body: JSON.stringify({
      plan_id: planId,
      loan_amount: amount / 100,
      borrower: {
        name: customerName,
        email: customerEmail,
      },
      callback_url: callbackUrl,
    }),
  });
  return {
    externalId: data.id,
    redirectUrl: data.application_url,
  };
}

export function parseWebhook(payload, signature, secret) {
  // Verify HMAC signature (length check first — timingSafeEqual throws on mismatched lengths)
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid webhook signature');
  }
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
