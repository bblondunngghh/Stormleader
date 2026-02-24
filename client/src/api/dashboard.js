import client from './client';

export const getStats = () => client.get('/dashboard/stats');
export const getFunnel = () => client.get('/dashboard/funnel');
export const getActivity = () => client.get('/dashboard/activity');
