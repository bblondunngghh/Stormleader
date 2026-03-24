import client from './client';

export const listSubcontractors = (params) => client.get('/crm/subcontractors', { params });
export const getSubcontractor = (id) => client.get(`/crm/subcontractors/${id}`);
export const createSubcontractor = (data) => client.post('/crm/subcontractors', data);
export const updateSubcontractor = (id, data) => client.patch(`/crm/subcontractors/${id}`, data);
export const deleteSubcontractor = (id) => client.delete(`/crm/subcontractors/${id}`);
export const assignToWorkOrder = (data) => client.post('/crm/subcontractors/assign', data);
export const getWorkOrderSubcontractors = (workOrderId) => client.get(`/crm/subcontractors/work-order/${workOrderId}`);
export const removeFromWorkOrder = (workOrderId, subId) => client.delete(`/crm/subcontractors/work-order/${workOrderId}/${subId}`);
