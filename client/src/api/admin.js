import client from './client';

export const getOverview = () => client.get('/admin/overview');
export const getTenants = (params) => client.get('/admin/tenants', { params });
export const getTenantDetail = (id) => client.get(`/admin/tenants/${id}`);
export const updateTenant = (id, data) => client.put(`/admin/tenants/${id}`, data);
export const getRevenue = () => client.get('/admin/revenue');
export const getUsage = () => client.get('/admin/usage');
