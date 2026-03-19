import client from './client';

export const getStats = () => client.get('/crm/dashboard/stats');
export const getFunnel = () => client.get('/crm/pipeline/metrics');
export const getActivity = () => client.get('/crm/dashboard/activity');
export const getLeaderboard = () => client.get('/crm/dashboard/leaderboard');
export const getTasksToday = () => client.get('/crm/dashboard/tasks-today');
export const getPropertiesAffected = () => client.get('/crm/dashboard/properties-affected');
export const listPropertiesAffected = (params) => client.get('/crm/dashboard/properties-affected/list', { params });
export const getFollowups = () => client.get('/crm/dashboard/followups');
export const getConversionByStorm = () => client.get('/crm/dashboard/conversion-by-storm');
export const getEstimateSummary = () => client.get('/crm/dashboard/estimate-summary');
