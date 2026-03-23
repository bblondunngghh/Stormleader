import client from './client';

export const getExpenses = (params) => client.get('/crm/expenses', { params });
export const getJobCostSummary = (leadId) => client.get(`/crm/expenses/summary/${leadId}`);
export const createExpense = (data) => client.post('/crm/expenses', data);
export const updateExpense = (id, data) => client.patch(`/crm/expenses/${id}`, data);
export const deleteExpense = (id) => client.delete(`/crm/expenses/${id}`);
