import pool from '../db/pool.js';

// ============================================================
// CREATE NOTIFICATION
// ============================================================

export async function createNotification(tenantId, userId, data) {
  const { type, title, body, reference_type, reference_id } = data;

  // Check user preference before creating
  const { rows: prefs } = await pool.query(
    `SELECT in_app FROM notification_preferences WHERE user_id = $1 AND notification_type = $2`,
    [userId, type]
  );
  // If preference exists and in_app is false, skip
  if (prefs.length > 0 && !prefs[0].in_app) return null;

  const { rows } = await pool.query(
    `INSERT INTO notifications (tenant_id, user_id, type, title, body, reference_type, reference_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [tenantId, userId, type, title, body || null, reference_type || null, reference_id || null]
  );

  return rows[0];
}

// Broadcast to all users in a tenant (bulk insert, respects preferences)
export async function broadcastNotification(tenantId, data) {
  const { type, title, body, reference_type, reference_id } = data;

  const { rows } = await pool.query(
    `INSERT INTO notifications (tenant_id, user_id, type, title, body, reference_type, reference_id)
     SELECT $1, u.id, $2, $3, $4, $5, $6
     FROM users u
     WHERE u.tenant_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM notification_preferences np
         WHERE np.user_id = u.id AND np.notification_type = $2 AND np.in_app = false
       )
     RETURNING *`,
    [tenantId, type, title, body || null, reference_type || null, reference_id || null]
  );

  return rows;
}

// ============================================================
// READ / LIST
// ============================================================

export async function getNotifications(userId, { limit = 30, offset = 0, is_read } = {}) {
  const params = [userId];
  const conditions = ['user_id = $1'];

  if (is_read === 'true') {
    conditions.push('is_read = true');
  } else if (is_read === 'false') {
    conditions.push('is_read = false');
  }

  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT * FROM notifications
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return rows;
}

export async function getUnreadCount(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return parseInt(rows[0].count, 10);
}

// ============================================================
// MARK READ
// ============================================================

export async function markRead(userId, notificationId) {
  const { rows } = await pool.query(
    `UPDATE notifications SET is_read = true, read_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId]
  );
  return rows[0] || null;
}

export async function markAllRead(userId) {
  const { rowCount } = await pool.query(
    `UPDATE notifications SET is_read = true, read_at = now()
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return { updated: rowCount };
}

// ============================================================
// PREFERENCES
// ============================================================

export async function getPreferences(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM notification_preferences WHERE user_id = $1 ORDER BY notification_type`,
    [userId]
  );

  if (rows.length > 0) return rows;

  // Auto-seed all notification types for new users
  const types = [
    'lead_assigned', 'lead_status_changed', 'task_due_soon',
    'task_overdue', 'estimate_viewed', 'estimate_accepted',
    'estimate_declined', 'storm_alert', 'new_storm_leads', 'mention'
  ];

  const values = types.map((_, i) => `($1, $${i + 2}, true, true)`).join(', ');
  const params = [userId, ...types];

  const { rows: seeded } = await pool.query(
    `INSERT INTO notification_preferences (user_id, notification_type, in_app, email)
     VALUES ${values}
     ON CONFLICT (user_id, notification_type) DO NOTHING
     RETURNING *`,
    params
  );

  return seeded.length > 0 ? seeded : await pool.query(
    `SELECT * FROM notification_preferences WHERE user_id = $1 ORDER BY notification_type`,
    [userId]
  ).then(r => r.rows);
}

export async function updatePreference(userId, notificationType, updates) {
  const allowedFields = ['in_app', 'email', 'push', 'email_digest'];
  const setClauses = [];
  const params = [userId, notificationType];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      params.push(updates[field]);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) return null;

  const { rows } = await pool.query(
    `INSERT INTO notification_preferences (user_id, notification_type, ${allowedFields.filter(f => updates[f] !== undefined).join(', ')})
     VALUES ($1, $2, ${params.slice(2).map((_, i) => `$${i + 3}`).join(', ')})
     ON CONFLICT (user_id, notification_type)
     DO UPDATE SET ${setClauses.join(', ')}
     RETURNING *`,
    params
  );

  return rows[0];
}

// ============================================================
// STALE LEAD ALERTS (RoofLink pattern — 3/7 day untouched)
// ============================================================

export async function checkStaleLeads() {
  // Find leads not updated in 3+ days that are in active sales stages
  // Only alert once per threshold by checking for existing recent notifications
  const activeStages = ['new', 'contacted', 'appt_set', 'inspected', 'estimate_sent', 'negotiating'];

  const { rows: staleLeads } = await pool.query(
    `SELECT l.id, l.tenant_id, l.assigned_rep_id, l.contact_name, l.address,
            l.stage, l.updated_at,
            EXTRACT(DAY FROM NOW() - l.updated_at)::int AS days_stale
     FROM leads l
     WHERE l.deleted_at IS NULL
       AND l.stage = ANY($1)
       AND l.updated_at < NOW() - INTERVAL '3 days'
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.reference_type = 'lead'
           AND n.reference_id = l.id::text
           AND n.type = 'stale_lead'
           AND n.created_at > NOW() - INTERVAL '4 days'
       )
     ORDER BY l.updated_at ASC
     LIMIT 50`,
    [activeStages]
  );

  let created = 0;
  for (const lead of staleLeads) {
    const days = lead.days_stale;
    const name = lead.contact_name || lead.address || 'Lead';
    const title = days >= 7
      ? `Lead untouched for ${days} days`
      : `Lead inactive for ${days} days`;
    const body = `"${name}" in ${lead.stage.replace(/_/g, ' ')} hasn't been updated in ${days} days.`;

    if (lead.assigned_rep_id) {
      await createNotification(lead.tenant_id, lead.assigned_rep_id, {
        type: 'stale_lead',
        title,
        body,
        reference_type: 'lead',
        reference_id: String(lead.id),
      });
      created++;
    } else {
      // No assigned rep — broadcast to all tenant users
      const result = await broadcastNotification(lead.tenant_id, {
        type: 'stale_lead',
        title,
        body,
        reference_type: 'lead',
        reference_id: String(lead.id),
      });
      created += result.length;
    }
  }

  return { checked: staleLeads.length, notificationsCreated: created };
}
