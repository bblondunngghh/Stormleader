import client from './client';

export const getStats = () => client.get('/crm/dashboard/stats');
export const getFunnel = () => client.get('/crm/pipeline/metrics');
export const getActivity = () => client.get('/crm/dashboard/activity');
export const getLeaderboard = () => client.get('/crm/dashboard/leaderboard');
export const getTasksToday = () => client.get('/crm/dashboard/tasks-today');
