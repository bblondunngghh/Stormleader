import client from './client';

export const getEstimates = (params) => client.get('/estimates', { params });
export const getEstimateDetail = (id) => client.get(`/estimates/${id}`);
export const createEstimate = (data) => client.post('/estimates', data);
export const updateEstimate = (id, data) => client.patch(`/estimates/${id}`, data);
export const sendEstimate = (id) => client.post(`/estimates/${id}/send`);
export const duplicateEstimate = (id) => client.post(`/estimates/${id}/duplicate`);
export const getTemplates = () => client.get('/estimates/templates');
