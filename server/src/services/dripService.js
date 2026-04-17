import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { sendAutomationEmail } from './emailService.js';

/**
 * List all drip sequences for a tenant, with step counts.
 */
export async function getSequences(tenantId) {
  const { rows } = await pool.query(
    `SELECT ds.*,
            (SELECT COUNT(*) FROM drip_sequence_steps WHERE sequence_id = ds.id) AS step_count,
            (SELECT COUNT(*) FROM drip_enrollments WHERE sequence_id = ds.id AND status = 'active') AS active_enrollments
     FROM drip_sequences ds
     WHERE ds.tenant_id = $1
     ORDER BY ds.created_at DESC`,
    [tenantId]
  );
  return rows;
}

/**
 * Get a single sequence with all its steps.
 */
export async function getSequence(tenantId, id) {
  const { rows: [sequence] } = await pool.query(
    `SELECT * FROM drip_sequences WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  if (!sequence) return null;

  const { rows: steps } = await pool.query(
    `SELECT * FROM drip_sequence_steps WHERE sequence_id = $1 ORDER BY step_order ASC`,
    [id]
  );
  sequence.steps = steps;
  return sequence;
}

/**
 * Create a drip sequence with steps.
 * @param {string} tenantId
 * @param {{ name, trigger_type, trigger_config, is_active, steps: Array<{ delay_days, action_type, action_config }> }} data
 */
export async function createSequence(tenantId, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [sequence] } = await client.query(
      `INSERT INTO drip_sequences (tenant_id, name, trigger_type, trigger_config, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, data.name, data.trigger_type, data.trigger_config || {}, data.is_active !== false]
    );

    const steps = [];
    if (data.steps?.length) {
      for (let i = 0; i < data.steps.length; i++) {
        const s = data.steps[i];
        const { rows: [step] } = await client.query(
          `INSERT INTO drip_sequence_steps (sequence_id, step_order, delay_days, action_type, action_config)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [sequence.id, i + 1, s.delay_days || 1, s.action_type || 'send_email', s.action_config || {}]
        );
        steps.push(step);
      }
    }

    await client.query('COMMIT');
    sequence.steps = steps;
    return sequence;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update a drip sequence and its steps (replace all steps).
 */
export async function updateSequence(tenantId, id, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const setClauses = ['updated_at = NOW()'];
    const params = [tenantId, id];

    if (data.name !== undefined) { params.push(data.name); setClauses.push(`name = $${params.length}`); }
    if (data.trigger_type !== undefined) { params.push(data.trigger_type); setClauses.push(`trigger_type = $${params.length}`); }
    if (data.trigger_config !== undefined) { params.push(JSON.stringify(data.trigger_config)); setClauses.push(`trigger_config = $${params.length}`); }
    if (data.is_active !== undefined) { params.push(data.is_active); setClauses.push(`is_active = $${params.length}`); }

    const { rows: [sequence] } = await client.query(
      `UPDATE drip_sequences SET ${setClauses.join(', ')} WHERE id = $2 AND tenant_id = $1 RETURNING *`,
      params
    );
    if (!sequence) {
      await client.query('ROLLBACK');
      return null;
    }

    // Replace steps if provided
    if (data.steps !== undefined) {
      await client.query(`DELETE FROM drip_sequence_steps WHERE sequence_id = $1`, [id]);
      const steps = [];
      for (let i = 0; i < data.steps.length; i++) {
        const s = data.steps[i];
        const { rows: [step] } = await client.query(
          `INSERT INTO drip_sequence_steps (sequence_id, step_order, delay_days, action_type, action_config)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [id, i + 1, s.delay_days || 1, s.action_type || 'send_email', s.action_config || {}]
        );
        steps.push(step);
      }
      sequence.steps = steps;
    }

    await client.query('COMMIT');
    return sequence;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Delete a drip sequence (cascades to steps and enrollments).
 */
export async function deleteSequence(tenantId, id) {
  const { rowCount } = await pool.query(
    `DELETE FROM drip_sequences WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  return rowCount > 0;
}

/**
 * Enroll a lead in a drip sequence. Sets next_run_at to now + first step delay.
 */
export async function enrollLead(tenantId, sequenceId, leadId) {
  // Get first step delay
  const { rows: steps } = await pool.query(
    `SELECT delay_days FROM drip_sequence_steps WHERE sequence_id = $1 ORDER BY step_order ASC LIMIT 1`,
    [sequenceId]
  );
  if (steps.length === 0) {
    throw new Error('Sequence has no steps');
  }

  const delayDays = steps[0].delay_days;
  const nextRunAt = new Date(Date.now() + delayDays * 86400000);

  const { rows: [enrollment] } = await pool.query(
    `INSERT INTO drip_enrollments (tenant_id, sequence_id, lead_id, current_step, next_run_at, status)
     VALUES ($1, $2, $3, 1, $4, 'active')
     ON CONFLICT (sequence_id, lead_id)
     DO UPDATE SET status = 'active', current_step = 1, next_run_at = $4, completed_at = NULL, enrolled_at = NOW()
     RETURNING *`,
    [tenantId, sequenceId, leadId, nextRunAt]
  );

  logger.info({ tenantId, sequenceId, leadId, nextRunAt }, 'Lead enrolled in drip sequence');
  return enrollment;
}

/**
 * Cancel a lead's enrollment in a drip sequence.
 */
export async function cancelEnrollment(tenantId, sequenceId, leadId) {
  const { rows: [enrollment] } = await pool.query(
    `UPDATE drip_enrollments
     SET status = 'cancelled', completed_at = NOW()
     WHERE sequence_id = $1 AND lead_id = $2 AND tenant_id = $3 AND status = 'active'
     RETURNING *`,
    [sequenceId, leadId, tenantId]
  );
  return enrollment;
}

/**
 * Get enrollments for a sequence.
 */
export async function getEnrollments(tenantId, sequenceId) {
  const { rows } = await pool.query(
    `SELECT de.*,
            l.contact_name, l.contact_email, l.address
     FROM drip_enrollments de
     JOIN leads l ON l.id = de.lead_id
     WHERE de.sequence_id = $1 AND de.tenant_id = $2
     ORDER BY de.enrolled_at DESC`,
    [sequenceId, tenantId]
  );
  return rows;
}

/**
 * Process all scheduled drip steps. Called by cron every 15 minutes.
 * Finds enrollments where next_run_at <= now and status = 'active',
 * executes the step action, then advances or completes.
 */
export async function processScheduledSteps() {
  const { rows: dueEnrollments } = await pool.query(
    `SELECT de.*, ds.tenant_id AS seq_tenant_id
     FROM drip_enrollments de
     JOIN drip_sequences ds ON ds.id = de.sequence_id AND ds.is_active = true
     WHERE de.status = 'active' AND de.next_run_at <= NOW()`
  );

  if (dueEnrollments.length === 0) return;

  logger.info({ count: dueEnrollments.length }, 'Processing scheduled drip steps');

  for (const enrollment of dueEnrollments) {
    try {
      // Get the current step
      const { rows: [step] } = await pool.query(
        `SELECT * FROM drip_sequence_steps
         WHERE sequence_id = $1 AND step_order = $2`,
        [enrollment.sequence_id, enrollment.current_step]
      );

      if (!step) {
        // No step found — mark as completed
        await pool.query(
          `UPDATE drip_enrollments SET status = 'completed', completed_at = NOW() WHERE id = $1`,
          [enrollment.id]
        );
        continue;
      }

      // Execute the step action
      await executeStepAction(enrollment.tenant_id, enrollment.lead_id, step);

      // Check if there's a next step
      const { rows: [nextStep] } = await pool.query(
        `SELECT * FROM drip_sequence_steps
         WHERE sequence_id = $1 AND step_order = $2`,
        [enrollment.sequence_id, enrollment.current_step + 1]
      );

      if (nextStep) {
        // Advance to next step
        const nextRunAt = new Date(Date.now() + nextStep.delay_days * 86400000);
        await pool.query(
          `UPDATE drip_enrollments SET current_step = $1, next_run_at = $2 WHERE id = $3`,
          [enrollment.current_step + 1, nextRunAt, enrollment.id]
        );
      } else {
        // Sequence complete
        await pool.query(
          `UPDATE drip_enrollments SET status = 'completed', completed_at = NOW(), next_run_at = NULL WHERE id = $1`,
          [enrollment.id]
        );
      }

      logger.info(
        { enrollmentId: enrollment.id, step: enrollment.current_step, leadId: enrollment.lead_id },
        'Drip step executed'
      );
    } catch (err) {
      logger.error(
        { err, enrollmentId: enrollment.id, step: enrollment.current_step },
        'Failed to process drip step'
      );
    }
  }
}

/**
 * Execute the action for a single drip step.
 */
async function executeStepAction(tenantId, leadId, step) {
  const cfg = step.action_config || {};

  switch (step.action_type) {
    case 'send_email': {
      const { rows } = await pool.query(
        `SELECT contact_email, contact_name, contact_phone, address, city,
                property_state, property_zip, stage, estimated_value
         FROM leads WHERE id = $1 AND tenant_id = $2`,
        [leadId, tenantId]
      );
      const lead = rows[0];
      if (!lead?.contact_email) {
        logger.warn({ leadId, tenantId }, 'Drip email skipped — no contact email');
        break;
      }
      // Fetch company name for merge fields
      const { rows: tenantRows } = await pool.query(
        `SELECT name FROM tenants WHERE id = $1`, [tenantId]
      );
      const companyName = tenantRows[0]?.name || '';
      // Replace merge fields in subject and body
      const nameParts = (lead.contact_name || '').split(/\s+/);
      const mergeMap = {
        '{{first_name}}': nameParts[0] || '',
        '{{last_name}}': nameParts.slice(1).join(' ') || '',
        '{{full_name}}': lead.contact_name || '',
        '{{email}}': lead.contact_email || '',
        '{{phone}}': lead.contact_phone || '',
        '{{address}}': lead.address || '',
        '{{city}}': lead.city || '',
        '{{company_name}}': companyName,
        '{{estimated_value}}': lead.estimated_value ? `$${Number(lead.estimated_value).toLocaleString()}` : '',
        '{{stage}}': (lead.stage || '').replace(/_/g, ' '),
      };
      const replaceMergeFields = (text) => {
        if (!text) return text;
        return Object.entries(mergeMap).reduce((t, [key, val]) => t.replaceAll(key, val), text);
      };
      await sendAutomationEmail(lead.contact_email, {
        subject: replaceMergeFields(cfg.subject) || 'Follow-up from StormLeads',
        body: replaceMergeFields(cfg.body) || '',
        contactName: lead.contact_name,
      });
      break;
    }

    case 'create_task': {
      const dueDate = cfg.dueDaysFromNow
        ? new Date(Date.now() + cfg.dueDaysFromNow * 86400000).toISOString()
        : null;
      await pool.query(
        `INSERT INTO tasks (tenant_id, lead_id, title, priority, due_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, leadId, cfg.title || 'Drip follow-up task', cfg.priority || 'medium', dueDate]
      );
      break;
    }

    case 'notify': {
      const { rows: users } = await pool.query(
        `SELECT id FROM users WHERE tenant_id = $1`, [tenantId]
      );
      for (const u of users) {
        await pool.query(
          `INSERT INTO notifications (tenant_id, user_id, type, title, body, reference_type, reference_id)
           VALUES ($1, $2, 'drip_sequence', $3, $4, 'lead', $5)`,
          [tenantId, u.id, cfg.title || 'Drip Sequence', cfg.body || null, leadId]
        );
      }
      break;
    }

    default:
      logger.warn({ actionType: step.action_type }, 'Unknown drip step action type');
  }
}

/**
 * Check if any active drip sequences match a trigger and auto-enroll the lead.
 * Called from the automation engine.
 */
export async function checkDripEnrollments(tenantId, triggerType, context = {}) {
  const { rows: sequences } = await pool.query(
    `SELECT * FROM drip_sequences WHERE tenant_id = $1 AND trigger_type = $2 AND is_active = true`,
    [tenantId, triggerType]
  );

  for (const seq of sequences) {
    try {
      if (!matchesDripConditions(seq.trigger_config, context, triggerType)) continue;
      if (!context.leadId) continue;

      // Check if already enrolled
      const { rows: existing } = await pool.query(
        `SELECT id FROM drip_enrollments WHERE sequence_id = $1 AND lead_id = $2 AND status = 'active'`,
        [seq.id, context.leadId]
      );
      if (existing.length > 0) continue;

      await enrollLead(tenantId, seq.id, context.leadId);
      logger.info(
        { sequenceId: seq.id, leadId: context.leadId, triggerType },
        'Lead auto-enrolled in drip sequence'
      );
    } catch (err) {
      logger.error(
        { err, sequenceId: seq.id, triggerType },
        'Failed to auto-enroll lead in drip sequence'
      );
    }
  }
}

function matchesDripConditions(config, context, triggerType) {
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
