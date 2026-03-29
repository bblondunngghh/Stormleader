import pool from '../db/pool.js';

// ============================================================
// MILESTONES
// ============================================================

const DEFAULT_MILESTONES = [
  'Permit Pulled',
  'Materials Delivered',
  'Tear-off',
  'Install',
  'Cleanup',
  'Final Inspection',
  'Complete',
];

export const MILESTONE_TEMPLATES = {
  default: {
    label: 'General (Default)',
    milestones: DEFAULT_MILESTONES,
  },
  shingle_replacement: {
    label: 'Shingle Replacement',
    milestones: [
      'Permit Pulled',
      'Materials Ordered',
      'Materials Delivered',
      'Dumpster Placed',
      'Tear-off Complete',
      'Inspect Decking',
      'Install Underlayment',
      'Install Shingles',
      'Install Flashing & Vents',
      'Install Ridge Cap',
      'Cleanup & Debris Removal',
      'Final Inspection',
      'Homeowner Walk-through',
    ],
  },
  metal_roof: {
    label: 'Metal Roof Install',
    milestones: [
      'Permit Pulled',
      'Materials Ordered',
      'Materials Delivered',
      'Tear-off Existing Roof',
      'Inspect & Repair Decking',
      'Install Underlayment',
      'Install Metal Panels',
      'Install Trim & Flashing',
      'Seal All Penetrations',
      'Cleanup & Debris Removal',
      'Final Inspection',
      'Homeowner Walk-through',
    ],
  },
  gutter_install: {
    label: 'Gutter Installation',
    milestones: [
      'Measure & Plan',
      'Materials Ordered',
      'Remove Old Gutters',
      'Inspect Fascia Board',
      'Repair Fascia (if needed)',
      'Install New Gutters',
      'Install Downspouts',
      'Install Gutter Guards',
      'Test Water Flow',
      'Cleanup',
      'Homeowner Walk-through',
    ],
  },
  siding_replacement: {
    label: 'Siding Replacement',
    milestones: [
      'Permit Pulled',
      'Materials Ordered',
      'Materials Delivered',
      'Remove Existing Siding',
      'Inspect Sheathing',
      'Install House Wrap',
      'Install Siding Panels',
      'Install Trim & J-Channel',
      'Caulk & Seal',
      'Cleanup & Debris Removal',
      'Final Inspection',
      'Homeowner Walk-through',
    ],
  },
  storm_damage_repair: {
    label: 'Storm Damage Repair',
    milestones: [
      'Initial Inspection Photos',
      'Insurance Claim Filed',
      'Adjuster Meeting Scheduled',
      'Adjuster Meeting Complete',
      'Supplement Submitted (if needed)',
      'Claim Approved',
      'Materials Ordered',
      'Materials Delivered',
      'Emergency Tarp / Board-up',
      'Tear-off Damaged Areas',
      'Install Repairs',
      'Final Inspection Photos',
      'Cleanup',
      'Homeowner Walk-through',
      'Final Payment Collected',
    ],
  },
  roof_inspection: {
    label: 'Roof Inspection Only',
    milestones: [
      'Schedule Inspection',
      'Exterior Photos (all sides)',
      'Roof Access & Safety Setup',
      'Inspect Shingles / Covering',
      'Inspect Flashing & Vents',
      'Inspect Gutters & Downspouts',
      'Check Attic (if accessible)',
      'Document Findings',
      'Generate Report',
      'Deliver Report to Homeowner',
    ],
  },
  flat_roof: {
    label: 'Flat / Low-Slope Roof',
    milestones: [
      'Permit Pulled',
      'Materials Ordered',
      'Materials Delivered',
      'Remove Existing Membrane',
      'Inspect & Repair Substrate',
      'Install Insulation',
      'Install Membrane (TPO/EPDM/PVC)',
      'Seal Seams & Penetrations',
      'Install Edge Metal & Flashing',
      'Flood Test',
      'Cleanup',
      'Final Inspection',
      'Homeowner Walk-through',
    ],
  },
};

export async function createMilestones(workOrderId, templateKey = 'default') {
  const template = MILESTONE_TEMPLATES[templateKey] || MILESTONE_TEMPLATES.default;
  const milestoneNames = template.milestones;
  const placeholders = milestoneNames.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`);
  const params = [workOrderId];
  milestoneNames.forEach((name, i) => { params.push(name, i + 1); });
  await pool.query(
    `INSERT INTO work_order_milestones (work_order_id, name, sort_order) VALUES ${placeholders.join(', ')}`,
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
  const { rows } = await pool.query(
    `UPDATE work_order_milestones
     SET completed = $3,
         completed_at = CASE WHEN $3 = true THEN NOW() ELSE NULL END,
         photo_url = COALESCE($4, photo_url)
     WHERE id = $2 AND work_order_id = $1
     RETURNING *`,
    [workOrderId, milestoneId, completed, photoUrl || null]
  );
  return rows[0] || null;
}

export async function checkAndCompleteWorkOrder(workOrderId) {
  const milestones = await getMilestones(workOrderId);
  if (milestones.length > 0 && milestones.every(m => m.completed)) {
    await pool.query(
      "UPDATE work_orders SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND status != 'completed'",
      [workOrderId]
    );
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
     LEFT JOIN leads l ON wo.lead_id = l.id
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
     LEFT JOIN leads l ON wo.lead_id = l.id
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
     LEFT JOIN leads l ON l.id = e.lead_id
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

  const setClauses = ['updated_at = now()'];
  const params = [tenantId, id];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      const val = field === 'line_items' ? JSON.stringify(data[field]) : data[field];
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
