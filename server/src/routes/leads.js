import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as leadService from '../services/leadService.js';
import pool from '../db/pool.js';

const router = Router();

// ============================================================
// PUBLIC routes (no auth — customer-facing)
// ============================================================

router.get('/status/public/:token', async (req, res, next) => {
  try {
    // 1. Look up token → get lead_id and tenant_id
    const tokenResult = await pool.query(
      'SELECT * FROM client_status_tokens WHERE token = $1',
      [req.params.token]
    );
    if (!tokenResult.rows[0]) return res.status(404).json({ error: 'Not found' });

    const { lead_id, tenant_id } = tokenResult.rows[0];

    // 2. Fetch lead info
    const leadResult = await pool.query(
      'SELECT id, contact_name, address, city, state, zip, stage, created_at, updated_at FROM leads WHERE id = $1',
      [lead_id]
    );
    const lead = leadResult.rows[0];
    if (!lead) return res.status(404).json({ error: 'Not found' });

    // 3. Fetch tenant company name
    const tenantResult = await pool.query(
      'SELECT company_name FROM tenants WHERE id = $1',
      [tenant_id]
    );

    // 4. Fetch work orders + milestones for this lead
    const woResult = await pool.query(
      'SELECT id, title, status, scheduled_date FROM work_orders WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 1',
      [lead_id]
    );

    let milestones = [];
    if (woResult.rows[0]) {
      const msResult = await pool.query(
        'SELECT * FROM work_order_milestones WHERE work_order_id = $1 ORDER BY sort_order',
        [woResult.rows[0].id]
      );
      milestones = msResult.rows;
    }

    // 5. Fetch stage history from activities (stage changes)
    const actResult = await pool.query(
      `SELECT description, created_at FROM activities
       WHERE lead_id = $1 AND type = 'stage_change'
       ORDER BY created_at ASC`,
      [lead_id]
    );

    res.json({
      companyName: tenantResult.rows[0]?.company_name || 'Company',
      customer: {
        name: lead.contact_name,
        address: [lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', '),
      },
      currentStage: lead.stage,
      stageHistory: actResult.rows,
      workOrder: woResult.rows[0] || null,
      milestones,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// AUTHENTICATED routes
// ============================================================

router.use(authenticate);
router.use(tenantScope);

// GET /api/leads — List leads for tenant with filters
router.get('/', async (req, res, next) => {
  try {
    const { stage, priority, storm_event_id, assigned_rep_id, needs_followup, unassigned, source, score_min, limit = '50', offset = '0' } = req.query;

    const result = await leadService.getLeads(req.tenantId, {
      stage: stage || undefined,
      priority: priority || undefined,
      stormEventId: storm_event_id || undefined,
      assignedRepId: assigned_rep_id || undefined,
      needsFollowup: needs_followup === 'true' || undefined,
      unassigned: unassigned === 'true' || undefined,
      source: source || undefined,
      scoreMin: score_min ? parseInt(score_min, 10) : undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/:id — Lead detail
router.get('/:id', async (req, res, next) => {
  try {
    const lead = await leadService.getLead(req.tenantId, req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/leads/:id — Update lead
router.patch('/:id', async (req, res, next) => {
  try {
    const lead = await leadService.updateLead(req.tenantId, req.params.id, req.body);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/:id/status-token — Generate a public status page token
router.post('/:id/status-token', async (req, res, next) => {
  try {
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    const { rows } = await pool.query(
      `INSERT INTO client_status_tokens (tenant_id, lead_id, token)
       VALUES ($1, $2, $3)
       ON CONFLICT (lead_id) DO UPDATE SET token = $3, updated_at = NOW()
       RETURNING *`,
      [req.tenantId, req.params.id, token]
    );

    res.json({ token: rows[0].token, url: `/status/${rows[0].token}` });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/from-storm — Generate leads from storm event
router.post('/from-storm', async (req, res, next) => {
  try {
    const { stormEventId, propertyIds, assignedRepId } = req.body;

    if (!stormEventId) {
      return res.status(400).json({ error: 'stormEventId is required' });
    }
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ error: 'propertyIds must be a non-empty array' });
    }

    const result = await leadService.generateLeadsFromStorm(
      req.tenantId, stormEventId, propertyIds, assignedRepId
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
