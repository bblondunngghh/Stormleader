import client from './client';

export const login = (email, password, tenantSlug) =>
  client.post('/auth/login', { email, password, tenantSlug });

export const register = (data) =>
  client.post('/auth/register', data);

export const refresh = (refreshToken) =>
  client.post('/auth/refresh', { refreshToken });
