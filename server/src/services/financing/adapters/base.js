// Base adapter interface — each lender adapter must implement these methods.
// This file serves as documentation; JavaScript doesn't enforce interfaces.

export const ADAPTER_METHODS = [
  'validateCredentials',  // (apiKey, merchantId) → boolean
  'fetchPlans',           // (apiKey, merchantId) → plan[]
  'createApplicationLink', // (apiKey, merchantId, opts) → { externalId, redirectUrl }
  'parseWebhook',         // (payload, signature, secret) → { externalApplicationId, status, approvedAmount, monthlyPayment }
];
