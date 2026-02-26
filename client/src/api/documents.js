import client from './client';

export const getDocuments = (params) => client.get('/documents', { params });

export const uploadDocument = (formData) =>
  client.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const deleteDocument = (id) => client.delete(`/documents/${id}`);
