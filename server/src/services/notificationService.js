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

// Broadcast to all users in a tenant
export async function broadcastNotification(tenantId, data) {
  const { rows: users } = await pool.query(
    `SELECT id FROM users WHERE tenant_id = $1`,
    [tenantId]
  );

  const results = [];
  for (const user of users) {
    const n = await createNotification(tenantId, user.id, data);
    if (n) results.push(n);
  }
  return results;
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
  return rows;
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
