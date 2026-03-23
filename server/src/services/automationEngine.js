import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { sendAutomationEmail } from './emailService.js';
import { checkDripEnrollments } from './dripService.js';

/**
 * Fire all active automations matching a given trigger for a tenant.
 * Called fire-and-forget — never blocks the main request.
 */
export async function fireTrigger(tenantId, triggerType, context = {}) {
  const { rows: automations } = await pool.query(
    `SELECT * FROM automations WHERE tenant_id = $1 AND trigger_type = $2 AND is_active = true`,
    [tenantId, triggerType]
  );

  for (const auto of automations) {
    try {
      if (!matchesConditions(auto.trigger_config, context, triggerType)) continue;
      await executeAction(tenantId, auto, context);
      logger.info(
        { automationId: auto.id, triggerType, action: auto.action_type, leadId: context.leadId },
        'Automation executed'
      );
    } catch (err) {
      logger.error(
        { err, automationId: auto.id, triggerType, action: auto.action_type },
        'Automation execution failed'
      );
    }
  }

  // Also check for drip sequence auto-enrollment
  try {
    await checkDripEnrollments(tenantId, triggerType, context);
  } catch (err) {
    logger.error({ err, triggerType }, 'Drip sequence enrollment check failed');
  }
}

/**
 * Check if trigger_config conditions match the event context.
 * An empty config {} matches all events of that type.
 */
function matchesConditions(config, context, triggerType) {
  if (!config || Object.keys(config).length === 0) return true;

  if (triggerType === 'stage_changed') {
    if (config.toStage && config.toStage !== context.toStage) return false;
    if (config.fromStage && config.fromStage !== context.fromStage) return false;
    return true;
  }

  if (triggerType === 'lead_created') {
    if (config.source && config.source !== context.source) return false;
    return true;
  }

  return true;
}

/**
 * Execute the configured action for a matched automation.
 */
async function executeAction(tenantId, automation, context) {
  const { action_type, action_config } = automation;
  const cfg = action_config || {};
  const leadId = context.leadId;

  switch (action_type) {
    case 'create_task': {
      const dueDate = cfg.dueDaysFromNow
        ? new Date(Date.now() + cfg.dueDaysFromNow * 86400000).toISOString()
        : null;
      await pool.query(
        `INSERT INTO tasks (tenant_id, lead_id, title, priority, due_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, leadId || null, cfg.title || 'Automated task', cfg.priority || 'medium', dueDate]
      );
      break;
    }

    case 'change_stage': {
      if (!cfg.stage || !leadId) break;
      await pool.query(
        `UPDATE leads SET stage = $1 WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
        [cfg.stage, leadId, tenantId]
      );
      break;
    }

    case 'send_email': {
      if (!leadId) break;
      const { rows } = await pool.query(
        `SELECT contact_email, contact_name FROM leads WHERE id = $1 AND tenant_id = $2`,
        [leadId, tenantId]
      );
      const lead = rows[0];
      if (!lead?.contact_email) break;
      await sendAutomationEmail(lead.contact_email, {
        subject: cfg.subject || 'Update from StormLeads',
        body: cfg.body || '',
        contactName: lead.contact_name,
      });
      break;
    }

    case 'notify': {
      // Notify all users in the tenant
      const { rows: users } = await pool.query(
        `SELECT id FROM users WHERE tenant_id = $1`, [tenantId]
      );
      for (const u of users) {
        await pool.query(
          `INSERT INTO notifications (tenant_id, user_id, type, title, body, reference_type, reference_id)
           VALUES ($1, $2, 'automation', $3, $4, 'lead', $5)`,
          [tenantId, u.id, cfg.title || 'Automation', cfg.body || null, leadId || null]
        );
      }
      break;
    }

    case 'assign_rep': {
      if (!cfg.repId || !leadId) break;
      await pool.query(
        `UPDATE leads SET assigned_rep_id = $1 WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
        [cfg.repId, leadId, tenantId]
      );
      break;
    }

    default:
      logger.warn({ actionType: action_type, automationId: automation.id }, 'Unknown automation action type');
  }
}
