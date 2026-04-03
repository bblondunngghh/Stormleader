import client from './client';

export const getStats = (filters) => client.get('/crm/dashboard/stats', { params: filters });
export const getFunnel = (filters) => client.get('/crm/pipeline/metrics', { params: filters });
export const getActivity = (filters) => client.get('/crm/dashboard/activity', { params: filters });
export const getLeaderboard = () => client.get('/crm/dashboard/leaderboard');
export const getTasksToday = () => client.get('/crm/dashboard/tasks-today');
export const getPropertiesAffected = () => client.get('/crm/dashboard/properties-affected');
export const listPropertiesAffected = (params) => client.get('/crm/dashboard/properties-affected/list', { params });
export const getFollowups = () => client.get('/crm/dashboard/followups');
export const getConversionByStorm = () => client.get('/crm/dashboard/conversion-by-storm');
export const getEstimateSummary = () => client.get('/crm/dashboard/estimate-summary');
export const getArSummary = () => client.get('/crm/dashboard/ar-summary');
export const getEstimatingConversion = () => client.get('/crm/dashboard/estimating-conversion');
