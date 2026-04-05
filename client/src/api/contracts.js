import client from './client';

export const getContracts = (params) => client.get('/crm/contracts', { params });
export const getContract = (id) => client.get(`/crm/contracts/${id}`);
export const createContract = (data) => client.post('/crm/contracts', data);
export const updateContract = (id, data) => client.patch(`/crm/contracts/${id}`, data);
export const sendContract = (id) => client.post(`/crm/contracts/${id}/send`);
export const voidContract = (id) => client.post(`/crm/contracts/${id}/void`);
export const downloadContractPdf = (id) => client.get(`/crm/contracts/${id}/pdf`, { responseType: 'blob' });
export const getContractTemplates = () => client.get('/crm/contracts/templates');
export const createContractTemplate = (data) => client.post('/crm/contracts/templates', data);
export const updateContractTemplate = (id, data) => client.patch(`/crm/contracts/templates/${id}`, data);
export const deleteContractTemplate = (id) => client.delete(`/crm/contracts/templates/${id}`);
