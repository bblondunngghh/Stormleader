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
    `SELECT lsv.*,
       fa.status AS financing_status
     FROM lead_summary_view lsv
     LEFT JOIN LATERAL (
       SELECT status FROM financing_applications WHERE lead_id = lsv.id ORDER BY created_at DESC LIMIT 1
     ) fa ON true
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
        p.address_line1, p.address_line2, p.city AS property_city, p.state, p.zip,
        p.owner_first_name, p.owner_last_name, p.owner_phone, p.owner_email,
        p.roof_type, p.roof_sqft, p.roof_pitch_degrees, p.roof_segments,
        p.roof_ridge_ft, p.roof_valley_ft, p.roof_eave_ft, p.roof_rake_ft,
        p.roof_hip_ft, p.roof_drip_edge_ft, p.roof_flashing_ft,
        COALESCE(p.year_built, p.fema_year_built) AS year_built,
        COALESCE(p.assessed_value, p.fema_replacement_value) AS assessed_value,
        p.homestead_exempt, p.county_parcel_id,
        COALESCE(p.property_sqft, p.fema_sqft) AS property_sqft,
        p.fema_bldg_type, p.fema_num_stories, p.fema_foundation_type,
        p.fema_occupancy_type, p.fema_ground_elevation,
        ST_AsGeoJSON(p.location)::json AS property_geometry,
        se.source AS storm_source, se.hail_size_max_in AS storm_hail_max,
        se.wind_speed_max_mph AS storm_wind_max, se.event_start AS storm_start,
        se.raw_data->>'type' AS storm_type, se.raw_data AS storm_raw_data,
        ST_AsGeoJSON(COALESCE(se.drift_corrected_geom, se.geom))::json AS storm_geometry,
        p.roof_measurement_source,
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

export async function deleteLead(tenantId, leadId) {
  const { rowCount } = await pool.query(
    `UPDATE leads SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [leadId, tenantId]
  );
  return rowCount > 0;
}

export async function updateLead(tenantId, leadId, updates) {
  const allowedFields = [
    'stage', 'priority', 'estimated_value', 'actual_value',
    'insurance_company', 'insurance_claim_number',
    'contact_name', 'contact_phone', 'contact_email',
    'damage_notes', 'assigned_rep_id', 'source', 'tags',
    'notes', 'next_follow_up', 'lost_reason', 'custom_fields',
  ];

  const setClauses = [];
  const params = [tenantId, leadId];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      if (field === 'custom_fields') {
        // Merge with existing custom_fields instead of replacing
        params.push(JSON.stringify(updates[field]));
        setClauses.push(`custom_fields = COALESCE(custom_fields, '{}') || $${params.length}::jsonb`);
      } else {
        params.push(updates[field]);
        setClauses.push(`${field} = $${params.length}`);
      }
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

/**
 * Update the roof_type on the property linked to a lead, then recalculate estimated_value.
 */
export async function updateLeadRoofType(tenantId, leadId, roofType) {
  // Fetch lead + property + storm info
  const { rows } = await pool.query(
    `SELECT l.property_id, l.hail_size_in, p.roof_sqft, p.assessed_value,
            se.wind_speed_max_mph
     FROM leads l
     LEFT JOIN properties p ON p.id = l.property_id
     LEFT JOIN storm_events se ON se.id = l.storm_event_id
     WHERE l.id = $1 AND l.tenant_id = $2 AND l.deleted_at IS NULL`,
    [leadId, tenantId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];

  // Update property roof_type
  if (r.property_id) {
    await pool.query(
      `UPDATE properties SET roof_type = $1 WHERE id = $2`,
      [roofType, r.property_id]
    );
  }

  // Recalculate estimate
  const ratePerSqft = { composition: 5.5, asphalt: 5.5, metal: 8, slate: 12, tile: 9.5, wood: 7, 'built-up': 6 };
  const hail = r.hail_size_in ? parseFloat(r.hail_size_in) : 0;
  const wind = r.wind_speed_max_mph ? parseFloat(r.wind_speed_max_mph) : 0;
  let df = 0.3;
  if (hail >= 2.5) df = 1.0;
  else if (hail >= 1.75) df = 0.8;
  else if (hail >= 1.25) df = 0.6;
  else if (hail >= 1.0) df = 0.45;
  else if (hail >= 0.75) df = 0.35;
  if (wind >= 80) df = Math.min(df + 0.2, 1.0);
  else if (wind >= 60) df = Math.min(df + 0.1, 1.0);

  const sqft = r.roof_sqft ? parseInt(r.roof_sqft) : 0;
  const rate = ratePerSqft[roofType.toLowerCase()] || 6;
  let est;
  if (sqft > 0) est = sqft * rate * df;
  else if (r.assessed_value) est = parseFloat(r.assessed_value) * 0.02 * df / 0.6;
  else est = 8500 * df;
  est = Math.round(est / 100) * 100;

  // Save new estimate to lead
  await pool.query(
    `UPDATE leads SET estimated_value = $1 WHERE id = $2 AND tenant_id = $3`,
    [est, leadId, tenantId]
  );

  return getLeadDetail(tenantId, leadId);
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
       COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.stage IN ('contacted','appt_set','inspected','estimate_sent','negotiating','sold','in_production')) AS contacted,
       COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.stage IN ('appt_set','inspected','estimate_sent','negotiating','sold','in_production')) AS appointments,
       COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.stage IN ('inspected','estimate_sent','negotiating','sold','in_production')) AS inspections,
       COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.stage IN ('estimate_sent','negotiating','sold','in_production')) AS estimates_sent,
       COUNT(l.id) FILTER (WHERE l.deleted_at IS NULL AND l.stage IN ('sold','in_production')) AS sold,
       COALESCE(SUM(CASE WHEN l.stage IN ('sold','in_production') AND l.deleted_at IS NULL THEN COALESCE(l.actual_value, l.estimated_value) ELSE 0 END), 0) AS revenue,
       CASE
         WHEN COUNT(l.id) FILTER (WHERE l.stage IN ('sold','in_production','lost') AND l.deleted_at IS NULL) > 0
         THEN ROUND(100.0 * COUNT(l.id) FILTER (WHERE l.stage IN ('sold','in_production') AND l.deleted_at IS NULL) / COUNT(l.id) FILTER (WHERE l.stage IN ('sold','in_production','lost') AND l.deleted_at IS NULL))
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

// ============================================================
// DASHBOARD — PROPERTIES AFFECTED
// ============================================================

export async function getPropertiesAffected(tenantId) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT p.id) as uncontacted,
            COUNT(DISTINCT CASE WHEN l.id IS NOT NULL THEN p.id END) as contacted
     FROM storm_events se
     JOIN properties p ON ST_Intersects(p.location, se.geom)
     LEFT JOIN leads l ON l.property_id = p.id AND l.tenant_id = $1
     WHERE se.event_start >= now() - interval '7 days'
       AND ST_GeometryType(se.geom) != 'ST_Point'
       AND (p.year_built IS NOT NULL OR p.roof_sqft > 0 OR p.assessed_value > 15000 OR p.homestead_exempt = true)`,
    [tenantId]
  );

  const r = rows[0];
  const contacted = parseInt(r.contacted, 10);
  const uncontacted = parseInt(r.uncontacted, 10) - contacted;
  const total = contacted + uncontacted;

  return { uncontacted, contacted, total };
}

export async function listPropertiesInStormZones(tenantId, { limit = 50, offset = 0, contacted = 'all', housesOnly = true } = {}) {
  let contactedFilter = '';
  if (contacted === 'uncontacted') contactedFilter = 'AND l.id IS NULL';
  else if (contacted === 'contacted') contactedFilter = 'AND l.id IS NOT NULL';

  // Filter to improved properties (actual houses/buildings, not vacant lots)
  const improvedFilter = housesOnly
    ? `AND (p.year_built IS NOT NULL OR p.roof_sqft > 0 OR p.assessed_value > 15000 OR p.homestead_exempt = true)`
    : '';

  // Step 1: Get paginated affected property IDs via the spatial join (fast with index)
  // Step 2: Enrich with county avg $/sqft for estimated values
  const [listResult, countResult] = await Promise.all([
    pool.query(
      `WITH affected AS (
         SELECT DISTINCT ON (p.id)
             p.id AS pid, se.id AS seid, se.event_start,
             se.hail_size_max_in, se.wind_speed_max_mph,
             se.source, (se.raw_data->>'type') AS storm_type
         FROM storm_events se
         JOIN properties p ON p.location && se.geom AND ST_Intersects(p.location, se.geom)
         LEFT JOIN leads l ON l.property_id = p.id AND l.tenant_id = $1
         WHERE se.event_start >= now() - interval '7 days'
           AND ST_GeometryType(se.geom) != 'ST_Point'
           ${contactedFilter}
           ${improvedFilter}
         ORDER BY p.id, se.event_start DESC
       ),
       page AS (
         SELECT * FROM affected
         ORDER BY event_start DESC, pid
         LIMIT $2 OFFSET $3
       ),
       county_avg AS (
         SELECT county,
                AVG(assessed_value / NULLIF(roof_sqft, 0)) AS avg_price_per_sqft
         FROM properties
         WHERE assessed_value > 10000
           AND roof_sqft > 200
           AND county IS NOT NULL
           AND county IN (SELECT DISTINCT p2.county FROM page pg JOIN properties p2 ON p2.id = pg.pid WHERE p2.county IS NOT NULL)
         GROUP BY county
         HAVING COUNT(*) >= 10
       )
       SELECT
         p.id, p.address_line1, p.city, p.state, p.zip,
         p.owner_first_name, p.owner_last_name, p.owner_phone, p.owner_email,
         p.assessed_value, p.year_built, p.roof_sqft, p.roof_type,
         p.homestead_exempt, p.county,
         ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
         pg.seid AS storm_event_id, pg.event_start AS storm_date,
         pg.hail_size_max_in, pg.wind_speed_max_mph, pg.source AS storm_source,
         pg.storm_type,
         l.id AS lead_id, l.stage AS lead_stage,
         ca.avg_price_per_sqft,
         CASE
           WHEN p.assessed_value > 10000 THEN p.assessed_value
           WHEN p.roof_sqft > 0 AND ca.avg_price_per_sqft IS NOT NULL
             THEN ROUND(p.roof_sqft * ca.avg_price_per_sqft)
           ELSE p.assessed_value
         END AS estimated_value
       FROM page pg
       JOIN properties p ON p.id = pg.pid
       LEFT JOIN leads l ON l.property_id = p.id AND l.tenant_id = $1
       LEFT JOIN county_avg ca ON ca.county = p.county
       ORDER BY pg.event_start DESC, pg.pid`,
      [tenantId, limit, offset]
    ),
    getPropertiesAffected(tenantId),
  ]);

  let total;
  if (contacted === 'uncontacted') total = countResult.uncontacted;
  else if (contacted === 'contacted') total = countResult.contacted;
  else total = countResult.total;

  return { properties: listResult.rows, total };
}

// ============================================================
// DASHBOARD — UPCOMING FOLLOW-UPS
// ============================================================

export async function getUpcomingFollowups(tenantId) {
  const { rows } = await pool.query(
    `SELECT l.id, l.contact_name, l.address, l.city, l.next_follow_up, l.stage, l.priority,
            u.first_name || ' ' || u.last_name as assigned_to
     FROM leads l
     LEFT JOIN users u ON u.id = l.assigned_rep_id
     WHERE l.tenant_id = $1
       AND l.next_follow_up BETWEEN now() AND now() + interval '48 hours'
       AND l.deleted_at IS NULL
     ORDER BY l.next_follow_up ASC
     LIMIT 10`,
    [tenantId]
  );

  return rows;
}

// ============================================================
// DASHBOARD — CONVERSION BY STORM
// ============================================================

export async function getConversionByStorm(tenantId) {
  const { rows } = await pool.query(
    `SELECT se.id, se.event_start, se.hail_size_max_in, se.wind_speed_max_mph,
            se.raw_data->>'type' as storm_type,
            se.raw_data->>'location' as location,
            se.raw_data->>'areaDesc' as area_desc,
            COUNT(DISTINCT l.id) as total_leads,
            COUNT(CASE WHEN l.stage = 'sold' THEN 1 END) as sold_count,
            COALESCE(SUM(CASE WHEN l.stage = 'sold' THEN COALESCE(l.actual_value, l.estimated_value) ELSE 0 END), 0) as revenue
     FROM storm_events se
     JOIN leads l ON l.storm_event_id = se.id AND l.tenant_id = $1 AND l.deleted_at IS NULL
     WHERE se.event_start >= now() - interval '90 days'
     GROUP BY se.id
     HAVING COUNT(DISTINCT l.id) > 0
     ORDER BY revenue DESC, total_leads DESC
     LIMIT 5`,
    [tenantId]
  );

  return rows.map(r => ({
    ...r,
    total_leads: parseInt(r.total_leads, 10),
    sold_count: parseInt(r.sold_count, 10),
    revenue: parseFloat(r.revenue),
  }));
}

// ============================================================
// DASHBOARD — ESTIMATE SUMMARY
// ============================================================

export async function getEstimateSummary(tenantId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
       COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
       COUNT(CASE WHEN status = 'viewed' THEN 1 END) as viewed,
       COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
       COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined,
       COUNT(CASE WHEN status = 'expired' OR (valid_until < CURRENT_DATE AND status IN ('sent','viewed')) THEN 1 END) as expired,
       COALESCE(SUM(CASE WHEN status = 'accepted' THEN total ELSE 0 END), 0) as accepted_value,
       COALESCE(SUM(CASE WHEN status IN ('sent','viewed') THEN total ELSE 0 END), 0) as pending_value
     FROM estimates
     WHERE tenant_id = $1
       AND created_at >= now() - interval '30 days'`,
    [tenantId]
  );

  const r = rows[0];
  return {
    draft: parseInt(r.draft, 10),
    sent: parseInt(r.sent, 10),
    viewed: parseInt(r.viewed, 10),
    accepted: parseInt(r.accepted, 10),
    declined: parseInt(r.declined, 10),
    expired: parseInt(r.expired, 10),
    accepted_value: parseFloat(r.accepted_value),
    pending_value: parseFloat(r.pending_value),
  };
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

// ============================================================
// PROSPECT LISTS — Curated property collections from storm swaths
// ============================================================

export async function createProspectListFromSwath(tenantId, userId, stormEventId, name) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [list] } = await client.query(
      `INSERT INTO prospect_lists (tenant_id, storm_event_id, name, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenantId, stormEventId, name, userId]
    );

    const { rowCount } = await client.query(
      `INSERT INTO prospect_list_items (list_id, property_id)
       SELECT $1, p.id
       FROM storm_events se
       JOIN properties p ON p.location && se.geom AND ST_Intersects(p.location, se.geom)
       WHERE se.id = $2
         AND (p.year_built IS NOT NULL OR p.roof_sqft > 0 OR p.assessed_value > 15000 OR p.homestead_exempt = true)
         AND p.address_line1 IS NOT NULL AND TRIM(p.address_line1) != '' AND p.address_line1 != '0'
       ON CONFLICT (list_id, property_id) DO NOTHING`,
      [list.id, stormEventId]
    );

    await client.query(
      `UPDATE prospect_lists SET property_count = $2 WHERE id = $1`,
      [list.id, rowCount]
    );

    await client.query('COMMIT');
    return { ...list, property_count: rowCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getProspectLists(tenantId) {
  const { rows } = await pool.query(
    `SELECT pl.*,
            u.first_name || ' ' || u.last_name as created_by_name,
            se.source as storm_source,
            (se.raw_data->>'type') as storm_type,
            se.hail_size_max_in, se.wind_speed_max_mph,
            se.event_start as storm_date
     FROM prospect_lists pl
     LEFT JOIN users u ON u.id = pl.created_by
     LEFT JOIN storm_events se ON se.id = pl.storm_event_id
     WHERE pl.tenant_id = $1
     ORDER BY pl.created_at DESC`,
    [tenantId]
  );
  return rows;
}

export async function getProspectListItems(tenantId, listId, { limit = 50, offset = 0, filters = {} } = {}) {
  const { rows: [list] } = await pool.query(
    `SELECT id, name, storm_event_id, property_count FROM prospect_lists WHERE id = $1 AND tenant_id = $2`,
    [listId, tenantId]
  );
  if (!list) return null;

  // Build dynamic WHERE clauses from filters
  const conditions = ['pli.list_id = $1'];
  const params = [listId, tenantId];
  let paramIdx = 3;

  if (filters.value_min) {
    conditions.push(`p.assessed_value >= $${paramIdx++}`);
    params.push(Number(filters.value_min));
  }
  if (filters.value_max) {
    conditions.push(`p.assessed_value <= $${paramIdx++}`);
    params.push(Number(filters.value_max));
  }
  if (filters.year_min) {
    conditions.push(`p.year_built >= $${paramIdx++}`);
    params.push(Number(filters.year_min));
  }
  if (filters.year_max) {
    conditions.push(`p.year_built <= $${paramIdx++}`);
    params.push(Number(filters.year_max));
  }
  if (filters.roof_min) {
    conditions.push(`p.roof_sqft >= $${paramIdx++}`);
    params.push(Number(filters.roof_min));
  }
  if (filters.roof_max) {
    conditions.push(`p.roof_sqft <= $${paramIdx++}`);
    params.push(Number(filters.roof_max));
  }
  if (filters.has_owner === 'true') {
    conditions.push(`(p.owner_first_name IS NOT NULL OR p.owner_last_name IS NOT NULL)`);
  }
  if (filters.has_owner === 'false') {
    conditions.push(`p.owner_first_name IS NULL AND p.owner_last_name IS NULL`);
  }
  if (filters.has_phone === 'true') {
    conditions.push(`p.owner_phone IS NOT NULL AND p.owner_phone != ''`);
  }
  if (filters.has_phone === 'false') {
    conditions.push(`(p.owner_phone IS NULL OR p.owner_phone = '')`);
  }
  if (filters.homestead === 'true') {
    conditions.push(`p.homestead_exempt = true`);
  }
  if (filters.homestead === 'false') {
    conditions.push(`(p.homestead_exempt IS NULL OR p.homestead_exempt = false)`);
  }
  if (filters.status === 'new') {
    conditions.push(`l.id IS NULL`);
  }
  if (filters.status === 'lead') {
    conditions.push(`l.id IS NOT NULL`);
  }
  if (filters.city) {
    conditions.push(`LOWER(TRIM(p.city)) = LOWER(TRIM($${paramIdx++}))`);
    params.push(filters.city);
  }
  if (filters.roof_type) {
    conditions.push(`LOWER(TRIM(p.roof_type)) = LOWER(TRIM($${paramIdx++}))`);
    params.push(filters.roof_type);
  }

  const whereClause = conditions.join(' AND ');

  const baseQuery = `
    FROM prospect_list_items pli
    JOIN properties p ON p.id = pli.property_id
    LEFT JOIN leads l ON l.property_id = p.id AND l.tenant_id = $2
    WHERE ${whereClause}`;

  const [itemsResult, countResult] = await Promise.all([
    pool.query(
      `SELECT
         p.id, p.address_line1, p.city, p.state, p.zip,
         p.owner_first_name, p.owner_last_name, p.owner_phone, p.owner_email,
         p.assessed_value, p.year_built, p.roof_sqft, p.roof_type,
         p.homestead_exempt, p.county,
         ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
         pli.skip_traced, pli.skip_trace_data, pli.added_at,
         l.id AS lead_id, l.stage AS lead_stage
       ${baseQuery}
       ORDER BY p.assessed_value DESC NULLS LAST
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) ${baseQuery}`,
      params
    ),
  ]);

  return {
    list,
    properties: itemsResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
}

export async function deleteProspectList(tenantId, listId) {
  const { rowCount } = await pool.query(
    `DELETE FROM prospect_lists WHERE id = $1 AND tenant_id = $2`,
    [listId, tenantId]
  );
  return rowCount > 0;
}

export async function removeProspectListItem(tenantId, listId, propertyId) {
  // Verify tenant owns the list
  const { rows: [list] } = await pool.query(
    `SELECT id FROM prospect_lists WHERE id = $1 AND tenant_id = $2`,
    [listId, tenantId]
  );
  if (!list) return null;

  const { rowCount } = await pool.query(
    `DELETE FROM prospect_list_items WHERE list_id = $1 AND property_id = $2`,
    [listId, propertyId]
  );

  if (rowCount > 0) {
    await pool.query(
      `UPDATE prospect_lists SET property_count = property_count - 1 WHERE id = $1`,
      [listId]
    );
  }

  return rowCount > 0;
}
