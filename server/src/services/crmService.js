import pool from '../db/pool.js';
import logger from '../utils/logger.js';

// ============================================================
// LEADS — Enhanced CRUD via lead_summary_view
// ============================================================

export async function getLeads(tenantId, filters = {}) {
  const {
    stage, priority, source, assignedRepId, search,
    sortBy = 'created_at', sortDir = 'DESC',
    limit = 50, offset = 0,
  } = filters;

  const params = [tenantId];
  const conditions = ['tenant_id = $1', 'deleted_at IS NULL'];

  if (stage) {
    params.push(stage);
    conditions.push(`stage = $${params.length}`);
  }
  if (priority) {
    params.push(priority);
    conditions.push(`priority = $${params.length}`);
  }
  if (source) {
    params.push(source);
    conditions.push(`source = $${params.length}`);
  }
  if (assignedRepId) {
    params.push(assignedRepId);
    conditions.push(`assigned_rep_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(
      contact_name ILIKE $${params.length}
      OR address ILIKE $${params.length}
      OR city ILIKE $${params.length}
      OR contact_email ILIKE $${params.length}
    )`);
  }

  const where = conditions.join(' AND ');
  const allowedSort = ['created_at', 'updated_at', 'estimated_value', 'contact_name', 'stage', 'priority', 'last_contact_at', 'next_follow_up'];
  const orderCol = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const orderDir = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT * FROM lead_summary_view
     WHERE ${where}
     ORDER BY ${orderCol} ${orderDir}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM lead_summary_view WHERE ${where}`,
    params.slice(0, params.length - 2)
  );

  return {
    leads: rows,
    total: parseInt(countRows[0].total, 10),
    limit,
    offset,
  };
}

export async function getLeadDetail(tenantId, leadId) {
  const { rows } = await pool.query(
    `SELECT
        l.*,
        p.address_line1, p.address_line2, p.state, p.zip,
        p.owner_first_name, p.owner_last_name, p.owner_phone, p.owner_email,
        p.roof_type, p.roof_sqft, p.year_built, p.assessed_value,
        p.homestead_exempt, p.county_parcel_id, p.property_sqft,
        ST_AsGeoJSON(p.location)::json AS property_geometry,
        se.source AS storm_source, se.hail_size_max_in AS storm_hail_max,
        se.wind_speed_max_mph AS storm_wind_max, se.event_start AS storm_start,
        u.first_name AS rep_first_name, u.last_name AS rep_last_name, u.email AS rep_email
     FROM leads l
     LEFT JOIN properties p ON p.id = l.property_id
     LEFT JOIN storm_events se ON se.id = l.storm_event_id
     LEFT JOIN users u ON u.id = l.assigned_rep_id
     WHERE l.id = $1 AND l.tenant_id = $2 AND l.deleted_at IS NULL`,
    [leadId, tenantId]
  );

  if (rows.length === 0) return null;

  const lead = rows[0];

  // Fetch contacts, activities, tasks in parallel
  const [contacts, activities, tasks] = await Promise.all([
    pool.query(
      `SELECT * FROM contacts WHERE lead_id = $1 AND tenant_id = $2 ORDER BY is_primary DESC, created_at`,
      [leadId, tenantId]
    ),
    pool.query(
      `SELECT a.*, u.first_name AS user_first_name, u.last_name AS user_last_name
       FROM activities a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.lead_id = $1 AND a.tenant_id = $2
       ORDER BY a.created_at DESC LIMIT 50`,
      [leadId, tenantId]
    ),
    pool.query(
      `SELECT t.*, u.first_name AS assignee_first_name, u.last_name AS assignee_last_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.lead_id = $1 AND t.tenant_id = $2
       ORDER BY t.completed_at NULLS FIRST, t.due_date ASC NULLS LAST`,
      [leadId, tenantId]
    ),
  ]);

  return {
    ...lead,
    contacts: contacts.rows,
    activities: activities.rows,
    tasks: tasks.rows,
  };
}

export async function updateLead(tenantId, leadId, updates) {
  const allowedFields = [
    'stage', 'priority', 'estimated_value', 'actual_value',
    'insurance_company', 'insurance_claim_number',
    'contact_name', 'contact_phone', 'contact_email',
    'damage_notes', 'assigned_rep_id', 'source', 'tags',
    'notes', 'next_follow_up', 'lost_reason',
  ];

  const setClauses = [];
  const params = [tenantId, leadId];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      params.push(updates[field]);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) {
    return getLeadDetail(tenantId, leadId);
  }

  const { rows } = await pool.query(
    `UPDATE leads
     SET ${setClauses.join(', ')}
     WHERE id = $2 AND tenant_id = $1 AND deleted_at IS NULL
     RETURNING *`,
    params
  );

  if (rows.length === 0) return null;
  return rows[0];
}

// ============================================================
// CONTACTS
// ============================================================

export async function addContact(tenantId, leadId, data) {
  const { first_name, last_name, phone, email, role = 'homeowner', is_primary = false, notes } = data;

  // If setting as primary, unset other primaries first
  if (is_primary) {
    await pool.query(
      `UPDATE contacts SET is_primary = false WHERE lead_id = $1 AND tenant_id = $2`,
      [leadId, tenantId]
    );
  }

  const { rows } = await pool.query(
    `INSERT INTO contacts (tenant_id, lead_id, first_name, last_name, phone, email, role, is_primary, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [tenantId, leadId, first_name, last_name, phone, email, role, is_primary, notes || null]
  );

  return rows[0];
}

export async function deleteContact(tenantId, contactId) {
  const { rowCount } = await pool.query(
    `DELETE FROM contacts WHERE id = $1 AND tenant_id = $2`,
    [contactId, tenantId]
  );
  return rowCount > 0;
}

// ============================================================
// ACTIVITIES
// ============================================================

export async function logActivity(tenantId, userId, data) {
  const { lead_id, type = 'note', subject, notes, outcome, duration_seconds, metadata } = data;

  const { rows } = await pool.query(
    `INSERT INTO activities (tenant_id, lead_id, user_id, type, subject, notes, outcome, duration_seconds, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [tenantId, lead_id, userId, type, subject || null, notes || null, outcome || null, duration_seconds || null, metadata ? JSON.stringify(metadata) : '{}']
  );

  // Update lead's last_contact_at for interaction types
  const contactTypes = ['call', 'email', 'text', 'door_knock'];
  if (contactTypes.includes(type)) {
    await pool.query(
      `UPDATE leads SET last_contact_at = now() WHERE id = $1 AND tenant_id = $2`,
      [lead_id, tenantId]
    );
  }

  // Update next_follow_up if provided in metadata
  if (data.next_follow_up) {
    await pool.query(
      `UPDATE leads SET next_follow_up = $3 WHERE id = $1 AND tenant_id = $2`,
      [lead_id, tenantId, data.next_follow_up]
    );
  }

  return rows[0];
}

export async function getActivities(tenantId, leadId, { limit = 30, offset = 0 } = {}) {
  const { rows } = await pool.query(
    `SELECT a.*, u.first_name AS user_first_name, u.last_name AS user_last_name
     FROM activities a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.lead_id = $1 AND a.tenant_id = $2
     ORDER BY a.created_at DESC
     LIMIT $3 OFFSET $4`,
    [leadId, tenantId, limit, offset]
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM activities WHERE lead_id = $1 AND tenant_id = $2`,
    [leadId, tenantId]
  );

  return { activities: rows, total: parseInt(countRows[0].total, 10) };
}

// ============================================================
// TASKS
// ============================================================

export async function getTasks(tenantId, filters = {}) {
  const { lead_id, assigned_to, completed, limit = 50, offset = 0 } = filters;
  const params = [tenantId];
  const conditions = ['t.tenant_id = $1'];

  if (lead_id) {
    params.push(lead_id);
    conditions.push(`t.lead_id = $${params.length}`);
  }
  if (assigned_to) {
    params.push(assigned_to);
    conditions.push(`t.assigned_to = $${params.length}`);
  }
  if (completed === 'true') {
    conditions.push('t.completed_at IS NOT NULL');
  } else if (completed === 'false') {
    conditions.push('t.completed_at IS NULL');
  }

  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT t.*, u.first_name AS assignee_first_name, u.last_name AS assignee_last_name
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.completed_at NULLS FIRST, t.due_date ASC NULLS LAST
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { tasks: rows };
}

export async function createTask(tenantId, data) {
  const { lead_id, assigned_to, title, description, due_date, priority = 'warm' } = data;

  const { rows } = await pool.query(
    `INSERT INTO tasks (tenant_id, lead_id, assigned_to, title, description, due_date, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [tenantId, lead_id || null, assigned_to || null, title, description || null, due_date || null, priority]
  );

  return rows[0];
}

export async function updateTask(tenantId, taskId, updates) {
  const allowedFields = ['title', 'description', 'due_date', 'assigned_to', 'priority', 'completed_at'];
  const setClauses = [];
  const params = [tenantId, taskId];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      params.push(updates[field]);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) return null;

  const { rows } = await pool.query(
    `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $2 AND tenant_id = $1 RETURNING *`,
    params
  );

  return rows.length > 0 ? rows[0] : null;
}

// ============================================================
// PIPELINE STAGES
// ============================================================

export async function getPipelineStages(tenantId) {
  const { rows } = await pool.query(
    `SELECT * FROM pipeline_stages
     WHERE tenant_id = $1 AND is_active = true
     ORDER BY position`,
    [tenantId]
  );
  return rows;
}

// ============================================================
// PIPELINE METRICS
// ============================================================

export async function getPipelineMetrics(tenantId) {
  const { rows } = await pool.query(
    `SELECT
       l.stage,
       COUNT(*) AS count,
       COALESCE(SUM(l.estimated_value), 0) AS value
     FROM leads l
     WHERE l.tenant_id = $1 AND l.deleted_at IS NULL AND l.stage != 'lost'
     GROUP BY l.stage
     ORDER BY
       CASE l.stage
         WHEN 'new' THEN 0
         WHEN 'contacted' THEN 1
         WHEN 'appt_set' THEN 2
         WHEN 'inspected' THEN 3
         WHEN 'estimate_sent' THEN 4
         WHEN 'negotiating' THEN 5
         WHEN 'sold' THEN 6
         WHEN 'in_production' THEN 7
       END`,
    [tenantId]
  );

  // Merge with pipeline stages for color/label
  const stages = await getPipelineStages(tenantId);
  const stageMap = Object.fromEntries(stages.map(s => [s.key, s]));

  return rows.map(r => ({
    stage: stageMap[r.stage]?.label || r.stage,
    key: r.stage,
    count: parseInt(r.count, 10),
    value: parseFloat(r.value),
    color: stageMap[r.stage]?.color || 'oklch(0.55 0.05 260)',
  }));
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export async function getDashboardStats(tenantId) {
  // Current period stats
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN stage NOT IN ('sold', 'lost', 'on_hold') THEN estimated_value ELSE 0 END), 0) AS pipeline_value,
       COUNT(CASE WHEN created_at >= now() - interval '7 days' THEN 1 END) AS new_leads_week,
       COUNT(CASE WHEN stage NOT IN ('sold', 'lost') THEN 1 END) AS active_leads,
       COUNT(CASE WHEN stage = 'sold' THEN 1 END) AS sold_count,
       COUNT(CASE WHEN stage IN ('sold', 'lost') THEN 1 END) AS closed_count,
       COALESCE(SUM(CASE WHEN stage = 'sold' THEN COALESCE(actual_value, estimated_value) ELSE 0 END), 0) AS sold_value,
       COALESCE(AVG(CASE WHEN stage = 'sold' THEN EXTRACT(DAY FROM updated_at - created_at) END), 0) AS avg_days_to_close
     FROM leads
     WHERE tenant_id = $1 AND deleted_at IS NULL`,
    [tenantId]
  );

  // Previous week stats for comparison
  const { rows: prevRows } = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN stage NOT IN ('sold', 'lost', 'on_hold')
         AND created_at < now() - interval '7 days' THEN estimated_value ELSE 0 END), 0) AS prev_pipeline,
       COUNT(CASE WHEN created_at >= now() - interval '14 days'
         AND created_at < now() - interval '7 days' THEN 1 END) AS prev_new_leads
     FROM leads
     WHERE tenant_id = $1 AND deleted_at IS NULL`,
    [tenantId]
  );

  const r = rows[0];
  const p = prevRows[0];
  const pipelineValue = parseFloat(r.pipeline_value);
  const prevPipeline = parseFloat(p.prev_pipeline);
  const newLeads = parseInt(r.new_leads_week);
  const prevNewLeads = parseInt(p.prev_new_leads);
  const closeRate = parseInt(r.closed_count) > 0
    ? Math.round((parseInt(r.sold_count) / parseInt(r.closed_count)) * 100)
    : 0;
  const avgDays = Math.round(parseFloat(r.avg_days_to_close));

  // Compute change strings
  const pipelineChange = prevPipeline > 0
    ? `${pipelineValue >= prevPipeline ? '+' : ''}${Math.round(((pipelineValue - prevPipeline) / prevPipeline) * 100)}%`
    : (pipelineValue > 0 ? '+100%' : '—');
  const leadsChange = prevNewLeads > 0
    ? `${newLeads >= prevNewLeads ? '+' : ''}${newLeads - prevNewLeads}`
    : (newLeads > 0 ? `+${newLeads}` : '—');

  // Format pipeline value
  let pipelineDisplay;
  if (pipelineValue >= 1000000) {
    pipelineDisplay = `$${(pipelineValue / 1000000).toFixed(1)}M`;
  } else if (pipelineValue >= 1000) {
    pipelineDisplay = `$${Math.round(pipelineValue / 1000)}K`;
  } else {
    pipelineDisplay = `$${Math.round(pipelineValue)}`;
  }

  return {
    stats: [
      {
        label: 'Pipeline Value',
        value: pipelineDisplay,
        change: pipelineChange,
        icon: 'dollar',
        color: 'oklch(0.75 0.18 155)',
      },
      {
        label: 'New Leads (7d)',
        value: String(newLeads),
        change: leadsChange,
        icon: 'leads',
        color: 'oklch(0.72 0.19 250)',
      },
      {
        label: 'Close Rate',
        value: `${closeRate}%`,
        change: closeRate > 0 ? `${closeRate}%` : '—',
        icon: 'target',
        color: 'oklch(0.78 0.17 85)',
      },
      {
        label: 'Avg Days to Close',
        value: avgDays > 0 ? String(avgDays) : '—',
        change: avgDays > 0 ? `${avgDays}d` : '—',
        icon: 'clock',
        color: 'oklch(0.70 0.18 330)',
      },
    ],
  };
}

export async function getRecentActivity(tenantId, limit = 15) {
  const { rows } = await pool.query(
    `SELECT a.*, l.address, l.contact_name, l.stage,
            u.first_name AS user_first_name, u.last_name AS user_last_name
     FROM activities a
     JOIN leads l ON l.id = a.lead_id
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.tenant_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [tenantId, limit]
  );

  return rows.map(r => {
    const typeMap = {
      call: 'call',
      email: 'lead',
      text: 'lead',
      door_knock: 'inspection',
      note: 'call',
      status_change: 'estimate',
      task_completed: 'appointment',
      system: 'lead',
    };

    const name = r.contact_name || r.address || 'Unknown';
    const action = r.subject || `${r.type} logged`;

    return {
      id: r.id,
      type: typeMap[r.type] || 'lead',
      text: `${name} — ${action}`,
      time: formatRelativeTime(r.created_at),
    };
  });
}

function formatRelativeTime(date) {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

// ============================================================
// BULK OPERATIONS
// ============================================================

export async function bulkAssign(tenantId, leadIds, assignedRepId) {
  const { rowCount } = await pool.query(
    `UPDATE leads SET assigned_rep_id = $3
     WHERE id = ANY($2::uuid[]) AND tenant_id = $1 AND deleted_at IS NULL`,
    [tenantId, leadIds, assignedRepId]
  );
  return { updated: rowCount };
}

export async function bulkStatus(tenantId, leadIds, stage) {
  const { rowCount } = await pool.query(
    `UPDATE leads SET stage = $3
     WHERE id = ANY($2::uuid[]) AND tenant_id = $1 AND deleted_at IS NULL`,
    [tenantId, leadIds, stage]
  );
  return { updated: rowCount };
}

// ============================================================
// TEAM MEMBERS
// ============================================================

export async function getTeamMembers(tenantId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.created_at,
            COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.stage NOT IN ('sold','lost')) AS active_leads,
            COUNT(l.id) FILTER (WHERE l.stage = 'sold' AND l.deleted_at IS NULL) AS sold_count
     FROM users u
     LEFT JOIN leads l ON l.assigned_rep_id = u.id AND l.tenant_id = u.tenant_id
     WHERE u.tenant_id = $1
     GROUP BY u.id, u.first_name, u.last_name, u.email, u.role, u.created_at
     ORDER BY u.first_name`,
    [tenantId]
  );
  return rows;
}

export async function updateUserRole(tenantId, userId, role) {
  const { rowCount } = await pool.query(
    `UPDATE users SET role = $3 WHERE id = $2 AND tenant_id = $1`,
    [tenantId, userId, role]
  );
  return { updated: rowCount > 0 };
}

// ============================================================
// LEADERBOARD
// ============================================================

export async function getLeaderboard(tenantId) {
  const { rows } = await pool.query(
    `SELECT
       u.id,
       u.first_name,
       u.last_name,
       COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL) AS leads_assigned,
       COUNT(l.id) FILTER (WHERE l.stage = 'contacted' AND l.deleted_at IS NULL) AS contacted,
       COUNT(l.id) FILTER (WHERE l.stage = 'appt_set' AND l.deleted_at IS NULL) AS appointments,
       COUNT(l.id) FILTER (WHERE l.stage = 'inspected' AND l.deleted_at IS NULL) AS inspections,
       COUNT(l.id) FILTER (WHERE l.stage = 'estimate_sent' AND l.deleted_at IS NULL) AS estimates_sent,
       COUNT(l.id) FILTER (WHERE l.stage = 'sold' AND l.deleted_at IS NULL) AS sold,
       COALESCE(SUM(CASE WHEN l.stage = 'sold' AND l.deleted_at IS NULL THEN COALESCE(l.actual_value, l.estimated_value) ELSE 0 END), 0) AS revenue,
       CASE
         WHEN COUNT(l.id) FILTER (WHERE l.stage IN ('sold','lost') AND l.deleted_at IS NULL) > 0
         THEN ROUND(100.0 * COUNT(l.id) FILTER (WHERE l.stage = 'sold' AND l.deleted_at IS NULL) / COUNT(l.id) FILTER (WHERE l.stage IN ('sold','lost') AND l.deleted_at IS NULL))
         ELSE 0
       END AS close_rate
     FROM users u
     LEFT JOIN leads l ON l.assigned_rep_id = u.id AND l.tenant_id = u.tenant_id
     WHERE u.tenant_id = $1
     GROUP BY u.id, u.first_name, u.last_name
     ORDER BY revenue DESC`,
    [tenantId]
  );
  return rows;
}

// ============================================================
// TASKS DUE TODAY
// ============================================================

export async function getTasksDueToday(tenantId) {
  const { rows } = await pool.query(
    `SELECT t.*, l.address AS lead_address, l.contact_name AS lead_name
     FROM tasks t
     LEFT JOIN leads l ON l.id = t.lead_id
     WHERE t.tenant_id = $1
       AND t.status NOT IN ('completed', 'cancelled')
       AND (t.due_date IS NULL OR t.due_date <= (CURRENT_DATE + interval '1 day'))
     ORDER BY
       CASE WHEN t.due_date < CURRENT_DATE THEN 0 ELSE 1 END,
       t.priority = 'urgent' DESC,
       t.priority = 'high' DESC,
       t.due_date ASC NULLS LAST
     LIMIT 20`,
    [tenantId]
  );
  return rows;
}
