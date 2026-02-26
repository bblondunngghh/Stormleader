import client from './client';

export async function getAlertConfig() {
  const { data } = await client.get('/alerts/config');
  return data;
}

export async function updateAlertConfig(updates) {
  const { data } = await client.put('/alerts/config', updates);
  return data;
}

export async function getAlertHistory(params = {}) {
  const { data } = await client.get('/alerts/history', { params });
  return data;
}

export async function sendTestAlert() {
  const { data } = await client.post('/alerts/test');
  return data;
}
