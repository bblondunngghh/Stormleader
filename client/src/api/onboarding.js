import client from './client';

export const createTenant = (data) =>
  client.post('/onboarding/create-tenant', data);

export const updateOrg = (data) =>
  client.put('/onboarding/org', data);

export const getPlans = () =>
  client.get('/onboarding/plans');

export const selectPlan = (planKey) =>
  client.post('/onboarding/select-plan', { planKey });

export const setupPayment = (paymentMethodId) =>
  client.post('/onboarding/setup-payment', { paymentMethodId });

export const enableAddons = (data) =>
  client.post('/onboarding/enable-addons', data);

export const completeOnboarding = () =>
  client.post('/onboarding/complete');
