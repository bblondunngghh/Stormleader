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
// DRIP SEQUENCES
// ============================================================

export const getDripSequences = () => client.get('/crm/drip-sequences');

export const getDripSequence = (id) => client.get(`/crm/drip-sequences/${id}`);

export const createDripSequence = (data) => client.post('/crm/drip-sequences', data);

export const updateDripSequence = (id, data) => client.patch(`/crm/drip-sequences/${id}`, data);

export const deleteDripSequence = (id) => client.delete(`/crm/drip-sequences/${id}`);

export const enrollLeadInSequence = (sequenceId, leadId) =>
  client.post(`/crm/drip-sequences/${sequenceId}/enroll`, { leadId });

export const cancelSequenceEnrollment = (sequenceId, leadId) =>
  client.post(`/crm/drip-sequences/${sequenceId}/cancel`, { leadId });

export const getSequenceEnrollments = (sequenceId) =>
  client.get(`/crm/drip-sequences/${sequenceId}/enrollments`);

// ============================================================
// CANVASSING
// ============================================================

export const getCanvassPins = (params) => client.get('/crm/canvass-pins', { params });

export const createCanvassPin = (data) => client.post('/crm/canvass-pins', data);

export const updateCanvassPin = (id, data) => client.patch(`/crm/canvass-pins/${id}`, data);

export const convertCanvassPin = (id) => client.post(`/crm/canvass-pins/${id}/convert`);

export const getCanvassStats = (date) => client.get('/crm/canvass-pins/stats', { params: { date } });

// ============================================================
// CANVASSING TERRITORIES
// ============================================================

export const getTerritories = () => client.get('/crm/territories');

export const getTerritory = (id) => client.get(`/crm/territories/${id}`);

export const createTerritory = (data) => client.post('/crm/territories', data);

export const updateTerritory = (id, data) => client.patch(`/crm/territories/${id}`, data);

export const deleteTerritory = (id) => client.delete(`/crm/territories/${id}`);

export const getTerritoryPins = (id) => client.get(`/crm/territories/${id}/pins`);

// ============================================================
// CUSTOM FIELDS
// ============================================================

export const getCustomFieldDefinitions = (entityType = 'lead') =>
  client.get('/crm/custom-fields', { params: { entity_type: entityType } });

export const createCustomField = (data) => client.post('/crm/custom-fields', data);

export const updateCustomField = (id, data) => client.patch(`/crm/custom-fields/${id}`, data);

export const deleteCustomField = (id) => client.delete(`/crm/custom-fields/${id}`);

// ============================================================
// REPORTS
// ============================================================

export const getRevenueReport = (start, end) =>
  client.get('/crm/reports/revenue', { params: { start, end } });

export const getPipelineReport = (start, end) =>
  client.get('/crm/reports/pipeline', { params: { start, end } });

export const getConversionReport = (start, end) =>
  client.get('/crm/reports/conversion', { params: { start, end } });

export const getRepPerformanceReport = (start, end) =>
  client.get('/crm/reports/rep-performance', { params: { start, end } });

export const getStageDurationReport = (start, end) =>
  client.get('/crm/reports/stage-duration', { params: { start, end } });

export const getLeadSourcesReport = (start, end) =>
  client.get('/crm/reports/lead-sources', { params: { start, end } });

// ============================================================
// WORK ORDERS
// ============================================================

export const getWorkOrderMilestoneTemplates = () => client.get('/crm/work-orders/milestone-templates');

export const getWorkOrders = (params) => client.get('/crm/work-orders', { params });

export const getWorkOrder = (id) => client.get(`/crm/work-orders/${id}`);

export const createWorkOrder = (data) => client.post('/crm/work-orders', data);

export const createWorkOrderFromEstimate = (estimateId) =>
  client.post(`/crm/work-orders/from-estimate/${estimateId}`);

export const updateWorkOrder = (id, data) => client.patch(`/crm/work-orders/${id}`, data);

export const completeWorkOrder = (id) => client.patch(`/crm/work-orders/${id}/complete`);

export const getWorkOrderMilestones = (woId) => client.get(`/crm/work-orders/${woId}/milestones`);

export const updateWorkOrderMilestone = (woId, mId, data) =>
  client.patch(`/crm/work-orders/${woId}/milestones/${mId}`, data);

export const addWorkOrderMilestone = (woId, name) =>
  client.post(`/crm/work-orders/${woId}/milestones`, { name });

export const deleteWorkOrderMilestone = (woId, milestoneId) =>
  client.delete(`/crm/work-orders/${woId}/milestones/${milestoneId}`);

export const downloadWorkOrderPdf = (woId) =>
  client.get(`/crm/work-orders/${woId}/pdf`, { responseType: 'blob' });

