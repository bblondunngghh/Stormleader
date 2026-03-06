import client from './client';

export const getConfig = () => client.get('/roof-measurement/config').then(r => r.data);
export const updateConfig = (data) => client.put('/roof-measurement/config', data).then(r => r.data);
export const measureRoof = (propertyId) => client.post('/roof-measurement/measure', { propertyId }).then(r => r.data);
export const getUsage = () => client.get('/roof-measurement/usage').then(r => r.data);
export const getBalance = () => client.get('/roof-measurement/balance').then(r => r.data);
