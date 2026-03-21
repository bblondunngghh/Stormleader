import client from './client';

// ============================================================
// LEADS
// ============================================================

export const getLeads = (params) => client.get('/crm/leads', { params });

export const getLeadDetail = (id) => client.get(`/crm/leads/${id}`);

export const updateLead = (id, data) => client.patch(`/crm/leads/${id}`, data);

export const deleteLead = (id) => client.delete(`/crm/leads/${id}`);

export const updateLeadRoofType = (id, roofType) =>
  client.patch(`/crm/leads/${id}/roof-type`, { roof_type: roofType });

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

export const addPropertyToPipeline = (stormEventId, propertyId) =>
  client.post('/properties/generate-leads', { stormEventId, propertyIds: [propertyId] });

export const createManualLead = (propertyId, source = 'address_search') =>
  client.post('/crm/leads', { propertyId, source });

export const createQuickLead = (data) => client.post('/crm/leads/quick', data);

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

export const inviteTeamMember = (data) =>
  client.post('/crm/team/invite', data);

// ============================================================
// PROSPECT LISTS
// ============================================================

export const createProspectList = (data) =>
  client.post('/crm/prospect-lists', data);

export const getProspectLists = () =>
  client.get('/crm/prospect-lists');

export const getProspectListItems = (listId, params) =>
  client.get(`/crm/prospect-lists/${listId}/items`, { params });

export const deleteProspectList = (listId) =>
  client.delete(`/crm/prospect-lists/${listId}`);

export const removeProspectListItem = (listId, propertyId) =>
  client.delete(`/crm/prospect-lists/${listId}/items/${propertyId}`);

// ============================================================
// CALENDAR
// ============================================================

export const getCalendarEvents = (start, end) =>
  client.get('/crm/calendar', { params: { start, end } });

// ============================================================
// INVOICES
// ============================================================

export const getInvoices = (params) => client.get('/crm/invoices', { params });

export const getInvoice = (id) => client.get(`/crm/invoices/${id}`);

export const createInvoice = (data) => client.post('/crm/invoices', data);

export const createInvoiceFromEstimate = (estimateId) =>
  client.post(`/crm/invoices/from-estimate/${estimateId}`);

export const updateInvoice = (id, data) => client.patch(`/crm/invoices/${id}`, data);

export const recordPayment = (id, amount) =>
  client.post(`/crm/invoices/${id}/payment`, { amount });

export const sendInvoice = (id) => client.post(`/crm/invoices/${id}/send`);

// ============================================================
// AUTOMATIONS
// ============================================================

export const getAutomations = () => client.get('/crm/automations');

export const createAutomation = (data) => client.post('/crm/automations', data);

export const updateAutomation = (id, data) => client.patch(`/crm/automations/${id}`, data);

export const deleteAutomation = (id) => client.delete(`/crm/automations/${id}`);

export const toggleAutomation = (id) => client.patch(`/crm/automations/${id}/toggle`);

// ============================================================
// CANVASSING
// ============================================================

export const getCanvassPins = (params) => client.get('/crm/canvass-pins', { params });

export const createCanvassPin = (data) => client.post('/crm/canvass-pins', data);

export const updateCanvassPin = (id, data) => client.patch(`/crm/canvass-pins/${id}`, data);

export const convertCanvassPin = (id) => client.post(`/crm/canvass-pins/${id}/convert`);

export const getCanvassStats = (date) => client.get('/crm/canvass-pins/stats', { params: { date } });

// ============================================================
// CUSTOM FIELDS
// ============================================================

export const getCustomFieldDefinitions = (entityType = 'lead') =>
  client.get('/crm/custom-fields', { params: { entity_type: entityType } });

export const createCustomField = (data) => client.post('/crm/custom-fields', data);

export const updateCustomField = (id, data) => client.patch(`/crm/custom-fields/${id}`, data);

export const deleteCustomField = (id) => client.delete(`/crm/custom-fields/${id}`);
