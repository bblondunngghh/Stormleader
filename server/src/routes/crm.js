import { Router } from 'express';
import bcrypt from 'bcryptjs';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as crmService from '../services/crmService.js';
import pool from '../db/pool.js';
import { fireTrigger } from '../services/automationEngine.js';
import logger from '../utils/logger.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// ============================================================
// LEADS
// ============================================================

// GET /api/crm/leads — Enhanced lead list with filters, search, pagination
router.get('/leads', async (req, res, next) => {
  try {
    const { stage, priority, source, assigned_rep_id, search, sort_by, sort_dir, min_score, limit = '50', offset = '0' } = req.query;
    const result = await crmService.getLeads(req.tenantId, {
      stage: stage || undefined,
      priority: priority || undefined,
      source: source || undefined,
      assignedRepId: assigned_rep_id || undefined,
      search: search || undefined,
      min_score: min_score || undefined,
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

// POST /api/crm/leads — Create a lead manually (without a storm event)
router.post('/leads', async (req, res, next) => {
  try {
    const { propertyId, source = 'manual' } = req.body;
    if (!propertyId) return res.status(400).json({ error: 'propertyId is required' });

    // Check if lead already exists for this tenant + property
    const { rows: existing } = await pool.query(
      `SELECT id FROM leads WHERE tenant_id = $1 AND property_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [req.tenantId, propertyId]
    );
    if (existing.length > 0) {
      return res.json({ id: existing[0].id, alreadyExists: true });
    }

    // Fetch property details
    const { rows: propRows } = await pool.query(
      `SELECT address_line1, city, owner_first_name, owner_last_name,
              owner_phone, owner_email, roof_type, roof_sqft, assessed_value
       FROM properties WHERE id = $1`,
      [propertyId]
    );
    if (propRows.length === 0) return res.status(404).json({ error: 'Property not found' });
    const prop = propRows[0];

    const contactName = [prop.owner_first_name, prop.owner_last_name].filter(Boolean).join(' ') || null;

    // Estimate value from property data (no storm damage factor — use 30% baseline)
    let estimatedValue = null;
    const roofSqft = prop.roof_sqft ? parseInt(prop.roof_sqft) : 0;
    if (roofSqft > 0) {
      estimatedValue = Math.round(roofSqft * 6.0 * 0.3 / 100) * 100;
    } else if (prop.assessed_value) {
      estimatedValue = Math.round(parseFloat(prop.assessed_value) * 0.01 / 100) * 100;
    }

    const { rows } = await pool.query(
      `INSERT INTO leads (
        tenant_id, property_id, assigned_rep_id,
        stage, priority, estimated_value, source,
        contact_name, contact_phone, contact_email,
        address, city
      ) VALUES ($1, $2, $3, 'new', 'warm', $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, stage, priority, estimated_value, created_at`,
      [
        req.tenantId, propertyId, req.body.assignedRepId || null,
        estimatedValue, source,
        contactName, prop.owner_phone || null, prop.owner_email || null,
        prop.address_line1 || null, prop.city || null,
      ]
    );

    // Fire lead_created automation trigger (fire-and-forget)
    fireTrigger(req.tenantId, 'lead_created', {
      leadId: rows[0].id,
      source,
    }).catch(err => logger.error({ err }, 'Automation trigger failed'));

    // Auto-score the new lead (fire-and-forget)
    import('../services/leadScoringService.js').then(({ scoreLead }) => {
      scoreLead(req.tenantId, rows[0].id).catch(err => logger.warn({ err }, 'Auto-score failed'));
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/leads/quick — Create a lead directly from contact info (no property required)
router.post('/leads/quick', async (req, res, next) => {
  try {
    const { contact_name, contact_phone, contact_email, address, city, state, zip, stage, priority, source, estimated_value } = req.body;
    if (!contact_name && !address) return res.status(400).json({ error: 'contact_name or address is required' });

    const ev = estimated_value != null ? parseFloat(estimated_value) : null;
    if (estimated_value != null && isNaN(ev)) return res.status(400).json({ error: 'estimated_value must be a number' });

    const { rows } = await pool.query(
      `INSERT INTO leads (
        tenant_id, assigned_rep_id,
        stage, priority, estimated_value, source,
        contact_name, contact_phone, contact_email,
        address, city, property_state, property_zip
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        req.tenantId, req.body.assigned_rep_id || null,
        stage || 'new', priority || 'warm', ev, source || 'manual',
        contact_name || null, contact_phone || null, contact_email || null,
        address || null, city || null, state || null, zip || null,
      ]
    );

    // Fire lead_created automation trigger (fire-and-forget)
    fireTrigger(req.tenantId, 'lead_created', {
      leadId: rows[0].id,
      source: source || 'manual',
    }).catch(err => logger.error({ err }, 'Automation trigger failed'));

    // Auto-score the new lead (fire-and-forget)
    import('../services/leadScoringService.js').then(({ scoreLead }) => {
      scoreLead(req.tenantId, rows[0].id).catch(err => logger.warn({ err }, 'Auto-score failed'));
    });

    res.status(201).json(rows[0]);
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
    // Fetch old stage before update for automation triggers
    let oldStage = null;
    if (req.body.stage) {
      const { rows: old } = await pool.query(
        `SELECT stage FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [req.params.id, req.tenantId]
      );
      if (old.length) oldStage = old[0].stage;
    }

    const lead = await crmService.updateLead(req.tenantId, req.params.id, req.body);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Fire stage_changed automation trigger (fire-and-forget)
    if (req.body.stage && req.body.stage !== oldStage) {
      fireTrigger(req.tenantId, 'stage_changed', {
        leadId: req.params.id,
        fromStage: oldStage,
        toStage: req.body.stage,
      }).catch(err => logger.error({ err }, 'Automation trigger failed'));
    }

    // Re-score on meaningful updates (fire-and-forget)
    const scoreRelevant = ['stage', 'storm_event_id', 'property_id', 'insurance_company', 'contact_phone', 'contact_email', 'hail_size_in'];
    if (scoreRelevant.some(k => req.body[k] !== undefined)) {
      import('../services/leadScoringService.js').then(({ scoreLead }) => {
        scoreLead(req.tenantId, req.params.id).catch(err => logger.warn({ err }, 'Auto re-score failed'));
      });
    }

    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/crm/leads/:id — Soft-delete a lead
router.delete('/leads/:id', async (req, res, next) => {
  try {
    const result = await crmService.deleteLead(req.tenantId, req.params.id);
    if (!result) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/crm/leads/:id/roof-type — Update property roof type & recalculate estimate
router.patch('/leads/:id/roof-type', async (req, res, next) => {
  try {
    const { roof_type } = req.body;
    if (!roof_type) return res.status(400).json({ error: 'roof_type required' });
    const lead = await crmService.updateLeadRoofType(req.tenantId, req.params.id, roof_type);
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
// LEAD SCORING
// ============================================================

// POST /api/crm/leads/:id/score — Compute/refresh score for a single lead
router.post('/leads/:id/score', async (req, res, next) => {
  try {
    const { scoreLead } = await import('../services/leadScoringService.js');
    const result = await scoreLead(req.tenantId, req.params.id);
    if (!result) return res.status(404).json({ error: 'Lead not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/leads/score-all — Batch score stale leads (max 100 per call)
router.post('/leads/score-all', async (req, res, next) => {
  try {
    const { scoreAllLeads } = await import('../services/leadScoringService.js');
    const result = await scoreAllLeads(req.tenantId);
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
    // Only admins can change roles
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can change team roles' });
    }
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

// POST /api/crm/team/invite — Admin adds a new team member
router.post('/team/invite', async (req, res, next) => {
  try {
    const { email, firstName, lastName, role, password } = req.body;

    // Only admins can invite
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can add team members' });
    }
    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({ error: 'Email, first name, last name, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const userRole = ['admin', 'manager', 'sales_rep'].includes(role) ? role : 'sales_rep';

    // Check user limit
    const { rows: limitRows } = await pool.query(
      `SELECT sp.max_users, COUNT(u.id)::int AS current_users
       FROM tenants t
       LEFT JOIN subscription_plans sp ON sp.key = t.subscription_tier
       LEFT JOIN users u ON u.tenant_id = t.id
       WHERE t.id = $1
       GROUP BY sp.max_users`,
      [req.tenantId]
    );
    if (limitRows.length > 0 && limitRows[0].max_users != null && limitRows[0].current_users >= limitRows[0].max_users) {
      return res.status(403).json({ error: `User limit reached (${limitRows[0].max_users}). Upgrade your plan to add more users.` });
    }

    // Check duplicate email within tenant
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
      [req.tenantId, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A user with this email already exists on your team' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [req.tenantId, email, passwordHash, firstName, lastName, userRole]
    );

    res.status(201).json({ member: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/tenant-settings
router.get('/tenant-settings', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT name, slug, company_phone, company_website, company_address, sender_email,
              subscription_tier, subscription_status, onboarding_completed, plan_changed_at, branding
       FROM tenants WHERE id = $1`,
      [req.tenantId],
    );
    if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
    const t = rows[0];
    const branding = t.branding || {};
    res.json({
      name: t.name, slug: t.slug, companyPhone: t.company_phone,
      companyWebsite: t.company_website, companyAddress: t.company_address,
      senderEmail: t.sender_email, subscriptionTier: t.subscription_tier,
      subscriptionStatus: t.subscription_status, onboardingCompleted: t.onboarding_completed,
      planChangedAt: t.plan_changed_at,
      googlePlaceId: branding.google_place_id || '',
      reviewMessageTemplate: branding.review_message_template || '',
      smtpHost: branding.smtp_host || '',
      smtpPort: branding.smtp_port || 587,
      smtpUser: branding.smtp_user || '',
      smtpFrom: branding.smtp_from || '',
      smtpConfigured: !!(branding.smtp_host && branding.smtp_pass),
    });
  } catch (err) { next(err); }
});

// PUT /api/crm/tenant-settings (admin only)
router.put('/tenant-settings', async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can modify company settings' });
    }
    const { senderEmail, companyPhone, companyWebsite, companyAddress, googlePlaceId, reviewMessageTemplate,
            smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = req.body;

    // Update branding JSONB for settings stored as JSON
    let brandingUpdate = '';
    const params = [senderEmail ?? null, companyPhone ?? null, companyWebsite ?? null, companyAddress ?? null, req.tenantId];
    const brandingPatch = {};
    if (googlePlaceId !== undefined) brandingPatch.google_place_id = googlePlaceId;
    if (reviewMessageTemplate !== undefined) brandingPatch.review_message_template = reviewMessageTemplate;
    if (smtpHost !== undefined) brandingPatch.smtp_host = smtpHost;
    if (smtpPort !== undefined) brandingPatch.smtp_port = Number(smtpPort) || 587;
    if (smtpUser !== undefined) brandingPatch.smtp_user = smtpUser;
    if (smtpPass !== undefined) brandingPatch.smtp_pass = smtpPass;
    if (smtpFrom !== undefined) brandingPatch.smtp_from = smtpFrom;
    if (Object.keys(brandingPatch).length > 0) {
      brandingUpdate = `,
         branding = branding || $6::jsonb`;
      params.push(JSON.stringify(brandingPatch));
    }

    const { rows } = await pool.query(
      `UPDATE tenants SET
         sender_email    = COALESCE($1, sender_email),
         company_phone   = COALESCE($2, company_phone),
         company_website = COALESCE($3, company_website),
         company_address = COALESCE($4, company_address)${brandingUpdate},
         updated_at = NOW()
       WHERE id = $5
       RETURNING name, slug, sender_email, company_phone, company_website, company_address, branding`,
      params,
    );
    if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
    const t = rows[0];
    const branding = t.branding || {};
    res.json({
      name: t.name, slug: t.slug, senderEmail: t.sender_email,
      companyPhone: t.company_phone, companyWebsite: t.company_website, companyAddress: t.company_address,
      googlePlaceId: branding.google_place_id || '',
      reviewMessageTemplate: branding.review_message_template || '',
      smtpHost: branding.smtp_host || '',
      smtpPort: branding.smtp_port || 587,
      smtpUser: branding.smtp_user || '',
      smtpFrom: branding.smtp_from || '',
      smtpConfigured: !!(branding.smtp_host && branding.smtp_pass),
    });
  } catch (err) { next(err); }
});

// POST /api/crm/test-email — Send a test email to verify SMTP configuration
router.post('/test-email', async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only admins can test email settings' });
    }
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'Recipient email required' });

    // Load tenant SMTP config
    const { rows } = await pool.query(
      'SELECT branding, sender_email FROM tenants WHERE id = $1', [req.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
    const branding = rows[0].branding || {};

    if (!branding.smtp_host || !branding.smtp_pass) {
      return res.status(400).json({ error: 'SMTP not configured. Save your SMTP settings first.' });
    }

    const nodemailer = await import('nodemailer');
    const transport = nodemailer.default.createTransport({
      host: branding.smtp_host,
      port: branding.smtp_port || 587,
      secure: (branding.smtp_port || 587) === 465,
      auth: branding.smtp_user ? { user: branding.smtp_user, pass: branding.smtp_pass } : undefined,
    });

    const from = branding.smtp_from || rows[0].sender_email || '"StormLeads" <noreply@stormleads.io>';
    await transport.sendMail({
      from,
      to,
      subject: 'StormLeads — Test Email',
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1a1a2e; margin: 0 0 16px;">Email Configuration Working!</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6;">
          This test email confirms your SMTP settings are correctly configured in StormLeads.
          Estimates, automations, and drip sequences will now send emails to your customers.
        </p>
        <div style="margin-top: 24px; padding: 16px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; color: #1e40af; font-size: 13px;"><strong>SMTP Host:</strong> ${branding.smtp_host}</p>
          <p style="margin: 4px 0 0; color: #1e40af; font-size: 13px;"><strong>From:</strong> ${from}</p>
        </div>
      </div>`,
      text: 'StormLeads — Your email configuration is working!',
    });

    res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ESOCKET' || err.responseCode) {
      return res.status(400).json({ error: `SMTP connection failed: ${err.message}` });
    }
    next(err);
  }
});

// GET /api/crm/dashboard/properties-affected
router.get('/dashboard/properties-affected', async (req, res, next) => {
  try {
    const result = await crmService.getPropertiesAffected(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/dashboard/properties-affected/list
router.get('/dashboard/properties-affected/list', async (req, res, next) => {
  try {
    const { limit = '50', offset = '0', contacted = 'all', housesOnly = 'true' } = req.query;
    const result = await crmService.listPropertiesInStormZones(req.tenantId, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      contacted,
      housesOnly: housesOnly !== 'false',
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/dashboard/followups
router.get('/dashboard/followups', async (req, res, next) => {
  try {
    const followups = await crmService.getUpcomingFollowups(req.tenantId);
    res.json({ followups });
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/dashboard/conversion-by-storm
router.get('/dashboard/conversion-by-storm', async (req, res, next) => {
  try {
    const storms = await crmService.getConversionByStorm(req.tenantId);
    res.json({ storms });
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/dashboard/estimate-summary
router.get('/dashboard/estimate-summary', async (req, res, next) => {
  try {
    const summary = await crmService.getEstimateSummary(req.tenantId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/dashboard/ar-summary — Accounts Receivable aging
router.get('/dashboard/ar-summary', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('sent','viewed'))::int AS outstanding_count,
        COALESCE(SUM(total - amount_paid) FILTER (WHERE status IN ('sent','viewed')), 0)::numeric AS outstanding_total,
        COUNT(*) FILTER (WHERE status = 'overdue' OR (due_date < CURRENT_DATE AND status IN ('sent','viewed')))::int AS overdue_count,
        COALESCE(SUM(total - amount_paid) FILTER (WHERE status = 'overdue' OR (due_date < CURRENT_DATE AND status IN ('sent','viewed'))), 0)::numeric AS overdue_total,
        COALESCE(SUM(total - amount_paid) FILTER (WHERE due_date >= CURRENT_DATE AND due_date < CURRENT_DATE + 30 AND status IN ('sent','viewed')), 0)::numeric AS due_30,
        COALESCE(SUM(total - amount_paid) FILTER (WHERE due_date >= CURRENT_DATE + 30 AND due_date < CURRENT_DATE + 60 AND status IN ('sent','viewed')), 0)::numeric AS due_60,
        COALESCE(SUM(total - amount_paid) FILTER (WHERE due_date >= CURRENT_DATE + 60 AND status IN ('sent','viewed')), 0)::numeric AS due_90_plus
      FROM invoices WHERE tenant_id = $1
    `, [req.tenantId]);
    res.json(rows[0] || {});
  } catch (err) { next(err); }
});

// GET /api/crm/dashboard/estimating-conversion — Estimate acceptance rate
router.get('/dashboard/estimating-conversion', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('sent','viewed','accepted','declined','expired'))::int AS total_sent,
        COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
        COUNT(*) FILTER (WHERE status = 'declined')::int AS declined,
        CASE WHEN COUNT(*) FILTER (WHERE status IN ('sent','viewed','accepted','declined','expired')) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE status = 'accepted')::numeric / COUNT(*) FILTER (WHERE status IN ('sent','viewed','accepted','declined','expired')) * 100, 1)
          ELSE 0
        END AS conversion_rate
      FROM estimates WHERE tenant_id = $1
    `, [req.tenantId]);
    res.json(rows[0] || {});
  } catch (err) { next(err); }
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

// GET /api/crm/dashboard/days-in-stage
router.get('/dashboard/days-in-stage', async (req, res, next) => {
  try {
    const stageLabels = {
      new: 'New', new_lead: 'New', contacted: 'Contacted', appt_set: 'Appt Set',
      inspection: 'Inspection', inspected: 'Inspection', estimate_sent: 'Estimate Sent',
      negotiation: 'Negotiation', negotiating: 'Negotiation', sold: 'Sold',
      in_production: 'Production', material_ordered: 'Material Ordered',
      work_scheduled: 'Scheduled', work_in_progress: 'In Progress',
      work_complete: 'Complete', invoiced: 'Invoiced', paid: 'Paid',
    };

    const { rows } = await pool.query(
      `SELECT
         stage,
         ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400), 1) as avg_days,
         COUNT(*) as lead_count,
         COUNT(*) FILTER (WHERE updated_at < NOW() - INTERVAL '7 days') as stuck_leads
       FROM leads
       WHERE tenant_id = $1
         AND stage NOT IN ('closed_won', 'closed_lost')
         AND updated_at IS NOT NULL
         AND deleted_at IS NULL
       GROUP BY stage
       ORDER BY avg_days DESC`,
      [req.tenantId]
    );

    const stages = rows.map(r => ({
      stage: r.stage,
      label: stageLabels[r.stage] || r.stage,
      avg_days: parseFloat(r.avg_days),
      lead_count: parseInt(r.lead_count, 10),
      stuck_leads: parseInt(r.stuck_leads, 10),
    }));

    res.json({ stages });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// PROSPECT LISTS
// ============================================================

// POST /api/crm/prospect-lists — Create list from storm swath
router.post('/prospect-lists', async (req, res, next) => {
  try {
    const { stormEventId, name } = req.body;
    if (!stormEventId) return res.status(400).json({ error: 'stormEventId is required' });
    const list = await crmService.createProspectListFromSwath(
      req.tenantId, req.user.id, stormEventId, name || 'Storm List'
    );
    res.status(201).json(list);
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/prospect-lists — All lists for tenant
router.get('/prospect-lists', async (req, res, next) => {
  try {
    const lists = await crmService.getProspectLists(req.tenantId);
    res.json({ lists });
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/prospect-lists/:id/items — Properties in a list
router.get('/prospect-lists/:id/items', async (req, res, next) => {
  try {
    const { limit = '50', offset = '0', ...filterParams } = req.query;
    const filters = {};
    for (const key of ['value_min', 'value_max', 'year_min', 'year_max', 'roof_min', 'roof_max',
                        'has_owner', 'has_phone', 'homestead', 'status', 'city', 'roof_type']) {
      if (filterParams[key]) filters[key] = filterParams[key];
    }
    const result = await crmService.getProspectListItems(
      req.tenantId, req.params.id,
      { limit: parseInt(limit, 10), offset: parseInt(offset, 10), filters }
    );
    if (!result) return res.status(404).json({ error: 'List not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/crm/prospect-lists/:id/items/:propertyId — Remove property from list
router.delete('/prospect-lists/:id/items/:propertyId', async (req, res, next) => {
  try {
    const result = await crmService.removeProspectListItem(
      req.tenantId, req.params.id, req.params.propertyId
    );
    if (result === null) return res.status(404).json({ error: 'List not found' });
    if (!result) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/crm/prospect-lists/:id
router.delete('/prospect-lists/:id', async (req, res, next) => {
  try {
    const deleted = await crmService.deleteProspectList(req.tenantId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'List not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// CALENDAR
// ============================================================

// GET /api/crm/calendar?start=ISO&end=ISO
router.get('/calendar', async (req, res, next) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end query params required' });

    const colorMap = {
      task: 'oklch(0.7 0.15 220)',
      call: 'oklch(0.75 0.18 145)',
      email: 'oklch(0.7 0.15 280)',
      door_knock: 'oklch(0.75 0.15 55)',
    };

    // Query tasks in range
    const { rows: tasks } = await pool.query(
      `SELECT t.id, t.title, t.due_date, t.priority, t.status, t.lead_id,
              l.contact_name, l.address
       FROM tasks t
       LEFT JOIN leads l ON t.lead_id = l.id
       WHERE t.tenant_id = $1
         AND t.due_date BETWEEN $2 AND $3
       ORDER BY t.due_date`,
      [req.tenantId, start, end]
    );

    // Query activities in range
    const { rows: activities } = await pool.query(
      `SELECT a.id, a.type, a.subject, a.created_at, a.lead_id,
              l.contact_name, l.address
       FROM activities a
       LEFT JOIN leads l ON a.lead_id = l.id
       WHERE a.tenant_id = $1
         AND a.created_at BETWEEN $2 AND $3
         AND a.type IN ('call', 'door_knock', 'email')
       ORDER BY a.created_at`,
      [req.tenantId, start, end]
    );

    const events = [
      ...tasks.map(t => ({
        id: `task-${t.id}`,
        title: t.title || 'Untitled Task',
        start: t.due_date,
        type: 'task',
        color: colorMap.task,
        leadId: t.lead_id,
        contactName: t.contact_name,
        address: t.address,
        priority: t.priority,
        status: t.status,
      })),
      ...activities.map(a => ({
        id: `activity-${a.id}`,
        title: a.subject || `${a.type} activity`,
        start: a.created_at,
        type: a.type,
        color: colorMap[a.type] || colorMap.task,
        leadId: a.lead_id,
        contactName: a.contact_name,
        address: a.address,
        priority: null,
        status: null,
      })),
    ];

    res.json(events);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// CUSTOM FIELD DEFINITIONS
// ============================================================

// GET /api/crm/custom-fields — list tenant's field definitions
router.get('/custom-fields', async (req, res, next) => {
  try {
    const entityType = req.query.entity_type || 'lead';
    const { rows } = await pool.query(
      `SELECT * FROM custom_field_definitions
       WHERE tenant_id = $1 AND entity_type = $2
       ORDER BY sort_order ASC, created_at ASC`,
      [req.tenantId, entityType]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/custom-fields — create field definition
router.post('/custom-fields', async (req, res, next) => {
  try {
    let { field_key, field_label, field_type, options, is_required, sort_order } = req.body;
    if (!field_label) return res.status(400).json({ error: 'field_label is required' });

    // Auto-generate field_key from field_label if not provided
    if (!field_key) {
      field_key = field_label.toLowerCase().replace(/[^a-z0-9\s_]/g, '').replace(/\s+/g, '_').substring(0, 50);
    }

    const validTypes = ['text', 'number', 'date', 'select', 'boolean'];
    if (field_type && !validTypes.includes(field_type)) {
      return res.status(400).json({ error: `field_type must be one of: ${validTypes.join(', ')}` });
    }

    const { rows } = await pool.query(
      `INSERT INTO custom_field_definitions (tenant_id, entity_type, field_key, field_label, field_type, options, is_required, sort_order)
       VALUES ($1, 'lead', $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.tenantId, field_key, field_label, field_type || 'text', options ? JSON.stringify(options) : null, is_required || false, sort_order || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A field with this key already exists' });
    }
    next(err);
  }
});

// PATCH /api/crm/custom-fields/:id — update field definition
router.patch('/custom-fields/:id', async (req, res, next) => {
  try {
    const { field_label, field_type, options, is_required, sort_order } = req.body;
    const setClauses = [];
    const params = [req.tenantId, req.params.id];

    if (field_label !== undefined) { params.push(field_label); setClauses.push(`field_label = $${params.length}`); }
    if (field_type !== undefined) { params.push(field_type); setClauses.push(`field_type = $${params.length}`); }
    if (options !== undefined) { params.push(JSON.stringify(options)); setClauses.push(`options = $${params.length}`); }
    if (is_required !== undefined) { params.push(is_required); setClauses.push(`is_required = $${params.length}`); }
    if (sort_order !== undefined) { params.push(sort_order); setClauses.push(`sort_order = $${params.length}`); }

    if (setClauses.length === 0) return res.status(400).json({ error: 'No fields to update' });

    const { rows } = await pool.query(
      `UPDATE custom_field_definitions SET ${setClauses.join(', ')}
       WHERE id = $2 AND tenant_id = $1
       RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Field definition not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/crm/custom-fields/:id — delete field definition
router.delete('/custom-fields/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM custom_field_definitions WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Field definition not found' });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
