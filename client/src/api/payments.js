import client from './client';

// Stripe Connect onboarding
export const startOnboarding = () => client.post('/payments/connect/onboard');
export const getConnectStatus = () => client.get('/payments/connect/status');
export const refreshOnboarding = () => client.post('/payments/connect/refresh');

// Payment intents (authenticated — for internal use)
export const createPaymentIntent = (data) => client.post('/payments/create-intent', data);

// Payment history
export const getPaymentHistory = (params) => client.get('/payments/history', { params });

// Public payment intent (no auth — used on public estimate page)
export const createPublicPaymentIntent = (data) => client.post('/payments/public/create-intent', data);
