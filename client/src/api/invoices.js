import client from './client';

export const getInvoices = (params) => client.get('/crm/invoices', { params });
export const getInvoice = (id) => client.get(`/crm/invoices/${id}`);
export const createInvoice = (data) => client.post('/crm/invoices', data);
export const createInvoiceFromEstimate = (estimateId) => client.post(`/crm/invoices/from-estimate/${estimateId}`);
export const updateInvoice = (id, data) => client.patch(`/crm/invoices/${id}`, data);
export const recordPayment = (id, amount) => client.post(`/crm/invoices/${id}/payment`, { amount });
export const sendInvoice = (id) => client.post(`/crm/invoices/${id}/send`);
