import client from './client';

export const getSwaths = ({ west, south, east, north, ...rest }) =>
  client.get('/map/swaths', {
    params: { bbox: `${west},${south},${east},${north}`, ...rest },
  });

export const getStorms = (params) =>
  client.get('/storms', { params });

export const getStorm = (id) =>
  client.get(`/storms/${id}`);
