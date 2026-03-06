import client from './client';

export const getConfig = () => client.get('/skip-trace/config').then(r => r.data);
export const updateConfig = (data) => client.put('/skip-trace/config', data).then(r => r.data);
export const setupPayment = (paymentMethodId, email) => client.post('/skip-trace/setup-payment', { paymentMethodId, email }).then(r => r.data);
export const removePaymentMethod = () => client.delete('/skip-trace/payment-method').then(r => r.data);
export const submitTrace = (propertyIds) => client.post('/skip-trace/submit', { propertyIds }).then(r => r.data);
export const getUsage = () => client.get('/skip-trace/usage').then(r => r.data);
export const getRecentJobs = () => client.get('/skip-trace/jobs').then(r => r.data);
export const getBalance = () => client.get('/skip-trace/balance').then(r => r.data);
export const getInvoices = () => client.get('/skip-trace/invoices').then(r => r.data);
