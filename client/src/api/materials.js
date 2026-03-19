import client from './client';

// Products
export const searchProducts = (params) => client.get('/materials/products', { params });
export const getProduct = (id) => client.get(`/materials/products/${id}`);

// Branches
export const getBranches = () => client.get('/materials/branches');

// Orders
export const createOrder = (data) => client.post('/materials/orders', data);
export const getOrders = (params) => client.get('/materials/orders', { params });
export const getOrder = (id) => client.get(`/materials/orders/${id}`);

// Auto-order from estimate
export const autoOrderFromEstimate = (estimateId) =>
  client.post(`/materials/estimate/${estimateId}/auto-order`);

// Credentials
export const saveCredentials = (data) => client.put('/materials/credentials', data);
export const getCredentials = () => client.get('/materials/credentials');
