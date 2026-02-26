import client from './client';

export const getSwaths = ({ west, south, east, north, ...rest }) =>
  client.get('/map/swaths', {
    params: { bbox: `${west},${south},${east},${north}`, ...rest },
  });

export const getStorms = (params) =>
  client.get('/storms', { params });

export const getStorm = (id) =>
  client.get(`/storms/${id}`);

export const getMapProperties = ({ west, south, east, north }) =>
  client.get('/map/properties', {
    params: { bbox: `${west},${south},${east},${north}` },
  });

export const getAffectedProperties = ({ west, south, east, north, timeRange }) =>
  client.get('/map/affected-properties', {
    params: { bbox: `${west},${south},${east},${north}`, timeRange },
  });

export const getPropertiesInSwath = (stormEventId) =>
  client.get(`/properties/in-swath/${stormEventId}`);

export const generateLeadsFromStorm = (data) =>
  client.post('/properties/generate-leads', data);

export const getDriftInfo = (stormEventId) =>
  client.get(`/drift/${stormEventId}`);

export const applyDriftCorrection = (stormEventId, detectionAltM) =>
  client.post(`/drift/${stormEventId}/correct`, { detection_alt_m: detectionAltM });

export const correctAllDrift = () =>
  client.post('/drift/correct-all');
