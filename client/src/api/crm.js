import client from './client';

// ============================================================
// LEADS
// ============================================================

export const getLeads = (params) => client.get('/crm/leads', { params });

export const getLeadDetail = (id) => client.get(`/crm/leads/${id}`);

export const updateLead = (id, data) => client.patch(`/crm/leads/${id}`, data);

export const bulkAssign = (leadIds, assignedRepId) =>
  client.post('/crm/leads/bulk-assign', { leadIds, assignedRepId });

export const bulkStatus = (leadIds, stage) =>
  client.post('/crm/leads/bulk-status', { leadIds, stage });

// ============================================================
// CONTACTS
// ============================================================

export const addContact = (leadId, data) =>
  client.post(`/crm/leads/${leadId}/contacts`, data);

export const deleteContact = (leadId, contactId) =>
  client.delete(`/crm/leads/${leadId}/contacts/${contactId}`);

// ============================================================
// ACTIVITIES
// ============================================================

export const logActivity = (data) => client.post('/crm/activities', data);

export const getActivities = (leadId, params) =>
  client.get(`/crm/leads/${leadId}/activities`, { params });

// ============================================================
// TASKS
// ============================================================

export const getTasks = (params) => client.get('/crm/tasks', { params });

export const createTask = (data) => client.post('/crm/tasks', data);

export const updateTask = (id, data) => client.patch(`/crm/tasks/${id}`, data);

// ============================================================
// PIPELINE
// ============================================================

export const getPipelineStages = () => client.get('/crm/pipeline/stages');

export const getPipelineMetrics = () => client.get('/crm/pipeline/metrics');

// ============================================================
// DASHBOARD
// ============================================================

export const getDashboardStats = () => client.get('/crm/dashboard/stats');

export const getDashboardActivity = () => client.get('/crm/dashboard/activity');

// ============================================================
// TEAM
// ============================================================

export const getTeamMembers = () => client.get('/crm/team');

export const updateUserRole = (userId, role) =>
  client.patch(`/crm/team/${userId}/role`, { role });
