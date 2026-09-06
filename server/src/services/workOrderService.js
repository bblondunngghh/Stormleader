import pool from '../db/pool.js';
import assertOwned from '../utils/assertOwned.js';

// ============================================================
// MILESTONES
// ============================================================

// Milestone definitions: { name, photo_required? }
// photo_required milestones cannot be marked complete without a photo upload (RoofLink-style quality control)
function m(name, photo_required = false) { return { name, photo_required }; }

const DEFAULT_MILESTONES = [
  m('Permit Pulled'),
  m('Materials Delivered', true),
  m('Tear-off', true),
  m('Install', true),
  m('Cleanup', true),
  m('Final Inspection', true),
  m('Complete'),
];

export const MILESTONE_TEMPLATES = {
  default: {
    label: 'General (Default)',
    milestones: DEFAULT_MILESTONES,
  },
  shingle_replacement: {
    label: 'Shingle Replacement',
    milestones: [
      m('Permit Pulled'),
      m('Materials Ordered'),
      m('Materials Delivered', true),
      m('Dumpster Placed'),
      m('Tear-off Complete', true),
      m('Inspect Decking', true),
      m('Install Underlayment'),
      m('Install Shingles', true),
      m('Install Flashing & Vents', true),
      m('Install Ridge Cap', true),
      m('Cleanup & Debris Removal', true),
      m('Final Inspection', true),
      m('Homeowner Walk-through'),
    ],
  },
  metal_roof: {
    label: 'Metal Roof Install',
    milestones: [
      m('Permit Pulled'),
      m('Materials Ordered'),
      m('Materials Delivered', true),
      m('Tear-off Existing Roof', true),
      m('Inspect & Repair Decking', true),
      m('Install Underlayment'),
      m('Install Metal Panels', true),
      m('Install Trim & Flashing', true),
      m('Seal All Penetrations', true),
      m('Cleanup & Debris Removal', true),
      m('Final Inspection', true),
      m('Homeowner Walk-through'),
    ],
  },
  gutter_install: {
    label: 'Gutter Installation',
    milestones: [
      m('Measure & Plan'),
      m('Materials Ordered'),
      m('Remove Old Gutters', true),
      m('Inspect Fascia Board', true),
      m('Repair Fascia (if needed)'),
      m('Install New Gutters', true),
      m('Install Downspouts', true),
      m('Install Gutter Guards'),
      m('Test Water Flow', true),
      m('Cleanup'),
      m('Homeowner Walk-through'),
    ],
  },
  siding_replacement: {
    label: 'Siding Replacement',
    milestones: [
      m('Permit Pulled'),
      m('Materials Ordered'),
      m('Materials Delivered', true),
      m('Remove Existing Siding', true),
      m('Inspect Sheathing', true),
      m('Install House Wrap'),
      m('Install Siding Panels', true),
      m('Install Trim & J-Channel', true),
      m('Caulk & Seal'),
      m('Cleanup & Debris Removal', true),
      m('Final Inspection', true),
      m('Homeowner Walk-through'),
    ],
  },
  storm_damage_repair: {
    label: 'Storm Damage Repair',
    milestones: [
      m('Initial Inspection Photos', true),
      m('Insurance Claim Filed'),
      m('Adjuster Meeting Scheduled'),
      m('Adjuster Meeting Complete'),
      m('Supplement Submitted (if needed)'),
      m('Claim Approved'),
      m('Materials Ordered'),
      m('Materials Delivered', true),
      m('Emergency Tarp / Board-up', true),
      m('Tear-off Damaged Areas', true),
      m('Install Repairs', true),
      m('Final Inspection Photos', true),
      m('Cleanup'),
      m('Homeowner Walk-through'),
      m('Final Payment Collected'),
    ],
  },
  roof_inspection: {
    label: 'Roof Inspection Only',
    milestones: [
      m('Schedule Inspection'),
      m('Exterior Photos (all sides)', true),
      m('Roof Access & Safety Setup'),
      m('Inspect Shingles / Covering', true),
      m('Inspect Flashing & Vents', true),
      m('Inspect Gutters & Downspouts', true),
      m('Check Attic (if accessible)'),
      m('Document Findings'),
      m('Generate Report'),
      m('Deliver Report to Homeowner'),
    ],
  },
  flat_roof: {
    label: 'Flat / Low-Slope Roof',
    milestones: [
      m('Permit Pulled'),
      m('Materials Ordered'),
      m('Materials Delivered', true),
      m('Remove Existing Membrane', true),
      m('Inspect & Repair Substrate', true),
      m('Install Insulation'),
      m('Install Membrane (TPO/EPDM/PVC)', true),
      m('Seal Seams & Penetrations', true),
      m('Install Edge Metal & Flashing', true),
      m('Flood Test', true),
      m('Cleanup'),
      m('Final Inspection', true),
      m('Homeowner Walk-through'),
    ],
  },
};

export async function createMilestones(workOrderId, templateKey = 'default') {
  // Own-property check, not a bare lookup: MILESTONE_TEMPLATES is a plain object literal,
  // so MILESTONE_TEMPLATES['constructor'] / ['__proto__'] / ['toString'] return an
  // INHERITED truthy value, `||` never fires, and `template.milestones` is undefined ->
  // defs.map() TypeError -> 500. Worse, createWorkOrder inserts the work_orders row BEFORE
  // calling this (:320), so the 500 left an orphan work order with zero milestones.
  // milestone_template is body-controlled. Ordinary unknown keys already fell back fine.
  const template = (Object.prototype.hasOwnProperty.call(MILESTONE_TEMPLATES, templateKey)
    && MILESTONE_TEMPLATES[templateKey]) || MILESTONE_TEMPLATES.default;
  const defs = template.milestones; // array of { name, photo_required }
  const placeholders = defs.map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`);
  const params = [workOrderId];
  defs.forEach((def, i) => { params.push(def.name, i + 1, def.photo_required || false); });
  await pool.query(
    `INSERT INTO work_order_milestones (work_order_id, name, sort_order, photo_required) VALUES ${placeholders.join(', ')}`,
    params
  );
}

export async function getMilestones(workOrderId) {
  const { rows } = await pool.query(
    'SELECT * FROM work_order_milestones WHERE work_order_id = $1 ORDER BY sort_order',
    [workOrderId]
  );
  return rows;
}

export async function updateMilestone(workOrderId, milestoneId, { completed, photoUrl }) {
  // Enforce photo-required: if marking complete, check if photo needed
  if (completed === true) {
    const { rows: existing } = await pool.query(
      'SELECT photo_required, photo_url FROM work_order_milestones WHERE id = $1 AND work_order_id = $2',
      [milestoneId, workOrderId]
    );
    const ms = existing[0];
    if (ms && ms.photo_required && !ms.photo_url && !photoUrl) {
      const err = new Error('Photo required before completing this milestone');
      err.status = 422;
      throw err;
    }
  }

  // `completed` is optional on a partial PATCH. Binding `undefined` sends NULL, which
  // used to overwrite the flag (and drop completed_at) on any photo-only update —
  // WorkOrdersView.jsx:97 sends { photo_url } alone, so uploading a photo marked a
  // finished milestone incomplete. Treat "absent" as "leave it alone".
  const completedArg = completed === undefined ? null : completed;
  const { rows } = await pool.query(
    `UPDATE work_order_milestones
     SET completed = COALESCE($3::boolean, completed),
         completed_at = CASE
           WHEN $3::boolean IS NULL THEN completed_at
           WHEN $3::boolean = true THEN NOW()
           ELSE NULL
         END,
         photo_url = COALESCE($4, photo_url)
     WHERE id = $2 AND work_order_id = $1
     RETURNING *`,
    [workOrderId, milestoneId, completedArg, photoUrl || null]
  );
  return rows[0] || null;
}

// Pipeline stage progression order for auto-advance
const STAGE_ORDER = ['new', 'contacted', 'appt_set', 'inspected', 'estimate_sent', 'negotiating', 'sold', 'in_production'];

export async function checkAndCompleteWorkOrder(workOrderId) {
  const milestones = await getMilestones(workOrderId);
  if (milestones.length > 0 && milestones.every(m => m.completed)) {
    const { rows } = await pool.query(
      "UPDATE work_orders SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND status != 'completed' RETURNING lead_id, tenant_id",
      [workOrderId]
    );

    // Auto-advance pipeline stage when all milestones complete
    const wo = rows[0];
    if (wo?.lead_id && wo?.tenant_id) {
      try {
        const { rows: settingRows } = await pool.query(
          "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND key = 'auto_advance_pipeline'",
          [wo.tenant_id]
        );
        const autoAdvance = settingRows[0]?.value === 'true';
        if (autoAdvance) {
          const { rows: leadRows } = await pool.query(
            'SELECT stage FROM leads WHERE id = $1 AND tenant_id = $2',
            [wo.lead_id, wo.tenant_id]
          );
          const currentStage = leadRows[0]?.stage;
          const currentIdx = STAGE_ORDER.indexOf(currentStage);
          if (currentIdx >= 0 && currentIdx < STAGE_ORDER.length - 1) {
            const nextStage = STAGE_ORDER[currentIdx + 1];
            await pool.query(
              'UPDATE leads SET stage = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
              [nextStage, wo.lead_id, wo.tenant_id]
            );
          }
        }
      } catch { /* non-critical — don't fail milestone completion */ }
    }
  }
}

// ============================================================
// WORK ORDERS CRUD
// ============================================================

export async function getWorkOrders(tenantId, { status, assignedTo, limit = 50, offset = 0 } = {}) {
  const params = [tenantId];
  const conditions = ['wo.tenant_id = $1'];

  if (status) {
    params.push(status);
    conditions.push(`wo.status = $${params.length}`);
  }

  if (assignedTo) {
    params.push(assignedTo);
    conditions.push(`wo.assigned_to = $${params.length}`);
  }

  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT wo.*, l.contact_name, l.address, CONCAT(u.first_name, ' ', u.last_name) AS assigned_name
     FROM work_orders wo
     LEFT JOIN leads l ON wo.lead_id = l.id AND l.tenant_id = wo.tenant_id
     LEFT JOIN users u ON wo.assigned_to = u.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY wo.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM work_orders wo WHERE ${conditions.join(' AND ')}`,
    params.slice(0, params.length - 2)
  );

  return { workOrders: rows, total: parseInt(countRows[0].total, 10) };
}

export async function getWorkOrder(tenantId, id) {
  const { rows } = await pool.query(
    `SELECT wo.*, l.contact_name, l.address, l.contact_phone, l.contact_email,
            CONCAT(u.first_name, ' ', u.last_name) AS assigned_name
     FROM work_orders wo
     LEFT JOIN leads l ON wo.lead_id = l.id AND l.tenant_id = wo.tenant_id
     LEFT JOIN users u ON wo.assigned_to = u.id
     WHERE wo.id = $1 AND wo.tenant_id = $2`,
    [id, tenantId]
  );
  return rows[0] || null;
}

export async function createWorkOrder(tenantId, data) {
  const {
    title, description, lead_id, estimate_id, assigned_to, crew_name,
    scheduled_date, scheduled_time_start, scheduled_time_end, line_items = [], notes,
    milestone_template,
  } = data;

  // Reject a client-supplied foreign key owned by another tenant. Same write-boundary
  // rule as createTask/logActivity: these ids come straight from the request body and the
  // read paths join on them, so an unchecked id stored another tenant's row as a dangling
  // reference and rendered its PII back to the caller.
  await assertOwned(tenantId, 'leads', lead_id, 'lead_id');
  await assertOwned(tenantId, 'estimates', estimate_id, 'estimate_id');
  await assertOwned(tenantId, 'users', assigned_to, 'assigned_to');

  const { rows } = await pool.query(
    `INSERT INTO work_orders (
      tenant_id, lead_id, estimate_id, title, description,
      assigned_to, crew_name, scheduled_date, scheduled_time_start,
      scheduled_time_end, line_items, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *`,
    [
      tenantId, lead_id || null, estimate_id || null, title, description || null,
      assigned_to || null, crew_name || null, scheduled_date || null,
      scheduled_time_start || null, scheduled_time_end || null,
      JSON.stringify(line_items), notes || null,
    ]
  );

  const newWorkOrder = rows[0];
  await createMilestones(newWorkOrder.id, milestone_template || 'default');

  return newWorkOrder;
}

export async function createFromEstimate(tenantId, estimateId) {
  const { rows: estRows } = await pool.query(
    `SELECT e.*, l.address FROM estimates e
     LEFT JOIN leads l ON l.id = e.lead_id AND l.tenant_id = e.tenant_id
     WHERE e.id = $1 AND e.tenant_id = $2`,
    [estimateId, tenantId]
  );
  if (!estRows[0]) return null;

  const est = estRows[0];
  const title = `Work Order - ${est.title || est.address || 'Estimate'}`;

  return createWorkOrder(tenantId, {
    title,
    lead_id: est.lead_id,
    estimate_id: est.id,
    line_items: est.line_items || [],
    notes: est.notes || null,
  });
}

export async function updateWorkOrder(tenantId, id, data) {
  const allowedFields = [
    'title', 'description', 'status', 'lead_id', 'assigned_to', 'crew_name',
    'scheduled_date', 'scheduled_time_start', 'scheduled_time_end',
    'line_items', 'notes',
  ];

  // Nullable non-text columns. WorkOrderDetail seeds its form with '' for every
  // unset optional field (WorkOrdersView.jsx:59-63) and PATCHes the whole form,
  // so an unassigned or unscheduled work order sends '' here. Postgres rejects
  // '' for uuid/date/time columns (22P02), which errorHandler.js:32 maps to a
  // 400 — so "Save Changes" failed on almost every work order. createWorkOrder
  // already coerces these at :303-306 (`x || null`); update was the odd one out.
  // Same shape as the estimate autosave bug (estimateService.js:176).
  const emptyToNull = [
    'lead_id', 'assigned_to', 'scheduled_date',
    'scheduled_time_start', 'scheduled_time_end',
  ];

  const setClauses = ['updated_at = now()'];
  const params = [tenantId, id];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      let val = field === 'line_items' ? JSON.stringify(data[field]) : data[field];
      if (emptyToNull.includes(field) && val === '') val = null;
      params.push(val);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 1) return getWorkOrder(tenantId, id);

  const { rows } = await pool.query(
    `UPDATE work_orders SET ${setClauses.join(', ')}
     WHERE id = $2 AND tenant_id = $1
     RETURNING *`,
    params
  );

  return rows[0] || null;
}

export async function completeWorkOrder(tenantId, id) {
  const { rows } = await pool.query(
    `UPDATE work_orders
     SET status = 'completed', completed_at = now(), updated_at = now()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, tenantId]
  );
  return rows[0] || null;
}
