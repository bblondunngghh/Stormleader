import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as crmService from '../services/crmService.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// ============================================================
// LEADS
// ============================================================

// GET /api/crm/leads — Enhanced lead list with filters, search, pagination
router.get('/leads', async (req, res, next) => {
  try {
    const { stage, priority, source, assigned_rep_id, search, sort_by, sort_dir, limit = '50', offset = '0' } = req.query;
    const result = await crmService.getLeads(req.tenantId, {
      stage: stage || undefined,
      priority: priority || undefined,
      source: source || undefined,
      assignedRepId: assigned_rep_id || undefined,
      search: search || undefined,
      sortBy: sort_by || undefined,
      sortDir: sort_dir || undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/leads/:id — Full detail with contacts, activities, tasks
router.get('/leads/:id', async (req, res, next) => {
  try {
    const lead = await crmService.getLeadDetail(req.tenantId, req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/crm/leads/:id — Update lead
router.patch('/leads/:id', async (req, res, next) => {
  try {
    const lead = await crmService.updateLead(req.tenantId, req.params.id, req.body);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/leads/bulk-assign
router.post('/leads/bulk-assign', async (req, res, next) => {
  try {
    const { leadIds, assignedRepId } = req.body;
    if (!Array.isArray(leadIds) || !assignedRepId) {
      return res.status(400).json({ error: 'leadIds array and assignedRepId required' });
    }
    const result = await crmService.bulkAssign(req.tenantId, leadIds, assignedRepId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/leads/bulk-status
router.post('/leads/bulk-status', async (req, res, next) => {
  try {
    const { leadIds, stage } = req.body;
    if (!Array.isArray(leadIds) || !stage) {
      return res.status(400).json({ error: 'leadIds array and stage required' });
    }
    const result = await crmService.bulkStatus(req.tenantId, leadIds, stage);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// CONTACTS
// ============================================================

// POST /api/crm/leads/:id/contacts
router.post('/leads/:id/contacts', async (req, res, next) => {
  try {
    const contact = await crmService.addContact(req.tenantId, req.params.id, req.body);
    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/crm/leads/:leadId/contacts/:contactId
router.delete('/leads/:leadId/contacts/:contactId', async (req, res, next) => {
  try {
    const deleted = await crmService.deleteContact(req.tenantId, req.params.contactId);
    if (!deleted) return res.status(404).json({ error: 'Contact not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// ACTIVITIES
// ============================================================

// POST /api/crm/activities
router.post('/activities', async (req, res, next) => {
  try {
    const { lead_id } = req.body;
    if (!lead_id) return res.status(400).json({ error: 'lead_id required' });
    const activity = await crmService.logActivity(req.tenantId, req.user.id, req.body);
    res.status(201).json(activity);
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/leads/:id/activities
router.get('/leads/:id/activities', async (req, res, next) => {
  try {
    const { limit = '30', offset = '0' } = req.query;
    const result = await crmService.getActivities(req.tenantId, req.params.id, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// TASKS
// ============================================================

// GET /api/crm/tasks
router.get('/tasks', async (req, res, next) => {
  try {
    const { lead_id, assigned_to, completed, limit = '50', offset = '0' } = req.query;
    const result = await crmService.getTasks(req.tenantId, {
      lead_id: lead_id || undefined,
      assigned_to: assigned_to || undefined,
      completed: completed || undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/tasks
router.post('/tasks', async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const task = await crmService.createTask(req.tenantId, req.body);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/crm/tasks/:id
router.patch('/tasks/:id', async (req, res, next) => {
  try {
    const task = await crmService.updateTask(req.tenantId, req.params.id, req.body);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// PIPELINE
// ============================================================

// GET /api/crm/pipeline/stages
router.get('/pipeline/stages', async (req, res, next) => {
  try {
    const stages = await crmService.getPipelineStages(req.tenantId);
    res.json({ stages });
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/pipeline/metrics
router.get('/pipeline/metrics', async (req, res, next) => {
  try {
    const funnel = await crmService.getPipelineMetrics(req.tenantId);
    res.json({ funnel });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// DASHBOARD
// ============================================================

// GET /api/crm/dashboard/stats
router.get('/dashboard/stats', async (req, res, next) => {
  try {
    const result = await crmService.getDashboardStats(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/dashboard/activity
router.get('/dashboard/activity', async (req, res, next) => {
  try {
    const activity = await crmService.getRecentActivity(req.tenantId);
    res.json({ activity });
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/team
router.get('/team', async (req, res, next) => {
  try {
    const members = await crmService.getTeamMembers(req.tenantId);
    res.json({ members });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/crm/team/:userId/role
router.patch('/team/:userId/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'manager', 'sales_rep'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const result = await crmService.updateUserRole(req.tenantId, req.params.userId, role);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/dashboard/leaderboard
router.get('/dashboard/leaderboard', async (req, res, next) => {
  try {
    const leaderboard = await crmService.getLeaderboard(req.tenantId);
    res.json({ leaderboard });
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/dashboard/tasks-today
router.get('/dashboard/tasks-today', async (req, res, next) => {
  try {
    const tasks = await crmService.getTasksDueToday(req.tenantId);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

export default router;
