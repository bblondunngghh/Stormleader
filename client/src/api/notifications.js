import client from './client';

export const getNotifications = (params) => client.get('/notifications', { params });
export const getUnreadCount = () => client.get('/notifications/unread-count');
export const markRead = (id) => client.patch(`/notifications/${id}/read`);
export const markAllRead = () => client.post('/notifications/mark-all-read');
export const getPreferences = () => client.get('/notifications/preferences');
export const updatePreference = (data) => client.patch('/notifications/preferences', data);
