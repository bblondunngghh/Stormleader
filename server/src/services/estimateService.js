import pool from '../db/pool.js';
import crypto from 'crypto';
import { sendEstimateEmail } from './emailService.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { createFromEstimate as createWorkOrderFromEstimate } from './workOrderService.js';

// ============================================================
// TOKEN / MERGE FIELD REPLACEMENT
// ============================================================

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
const fmtCurrency = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function replaceTokens(text, estimate) {
  if (!text || typeof text !== 'string') return text;
  const tokens = {
    '{{customer_name}}': estimate.customer_name || '',
    '{{customer_phone}}': estimate.customer_phone || '',
    '{{customer_email}}': estimate.customer_email || '',
    '{{customer_address}}': estimate.customer_address || '',
    '{{estimate_number}}': estimate.estimate_number || '',
    '{{estimate_date}}': fmtDate(estimate.created_at),
    '{{valid_until}}': fmtDate(estimate.valid_until),
    '{{company_name}}': estimate.company_name || 'StormLeads',
    '{{total}}': fmtCurrency(estimate.total),
    '{{subtotal}}': fmtCurrency(estimate.subtotal),
  };
  let result = text;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replaceAll(token, value);
  }
  return result;
}

// ============================================================
// ESTIMATES CRUD
// ============================================================

export async function createEstimate(tenantId, userId, data) {
  // Generate next estimate number for tenant
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM estimates WHERE tenant_id = $1`,
    [tenantId]
  );
  const num = parseInt(countRows[0].cnt, 10) + 1;
  const estimate_number = `EST-${String(num).padStart(3, '0')}`;
  const public_token = crypto.randomBytes(32).toString('hex');

  const {
    lead_id, customer_name, customer_address, customer_phone, customer_email,
    line_items = [], tax_rate = 0, discount_type = 'flat', discount_value = 0,
    scope_of_work, terms, warranty_info, notes, valid_until,
    financing_enabled = false, financing_plan_ids = [],
  } = data;

  const { subtotal, tax_amount, total } = calculateTotals(line_items, tax_rate, discount_type, discount_value);

  const { rows } = await pool.query(
    `INSERT INTO estimates (
      tenant_id, created_by, lead_id, estimate_number, public_token,
      customer_name, customer_address, customer_phone, customer_email,
      line_items, subtotal, tax_rate, tax_amount, discount_type, discount_value, total,
      scope_of_work, terms, warranty_info, notes, valid_until,
      financing_enabled, financing_plan_ids
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
    RETURNING *`,
    [
      tenantId, userId, lead_id || null, estimate_number, public_token,
      customer_name || null, customer_address || null, customer_phone || null, customer_email || null,
      JSON.stringify(line_items), subtotal, tax_rate, tax_amount, discount_type, discount_value, total,
      scope_of_work || null, terms || null, warranty_info || null, notes || null, valid_until || null,
      financing_enabled, JSON.stringify(financing_plan_ids),
    ]
  );

  // Sync estimate total to lead's estimated_value
  const estimate = rows[0];
  if (estimate && estimate.lead_id) {
    await syncLeadEstimatedValue(estimate.lead_id, tenantId);
  }

  return estimate;
}

export async function getEstimates(tenantId, filters = {}) {
  const { status, lead_id, limit = 50, offset = 0 } = filters;
  const params = [tenantId];
  const conditions = ['e.tenant_id = $1'];

  if (status) {
    params.push(status);
    conditions.push(`e.status = $${params.length}`);
  }
  if (lead_id) {
    params.push(lead_id);
    conditions.push(`e.lead_id = $${params.length}`);
  }

  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT e.*, u.first_name AS creator_first_name, u.last_name AS creator_last_name,
            l.contact_name AS lead_name, l.address AS lead_address
     FROM estimates e
     LEFT JOIN users u ON u.id = e.created_by
     LEFT JOIN leads l ON l.id = e.lead_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM estimates e WHERE ${conditions.join(' AND ')}`,
    params.slice(0, params.length - 2)
  );

  return { estimates: rows, total: parseInt(countRows[0].total, 10) };
}

export async function getEstimateDetail(tenantId, estimateId) {
  const { rows } = await pool.query(
    `SELECT e.*, u.first_name AS creator_first_name, u.last_name AS creator_last_name,
            l.contact_name AS lead_name, l.address AS lead_address, l.city AS lead_city,
            l.contact_phone AS lead_phone, l.contact_email AS lead_email,
            t.name AS company_name
     FROM estimates e
     LEFT JOIN users u ON u.id = e.created_by
     LEFT JOIN leads l ON l.id = e.lead_id
     LEFT JOIN tenants t ON t.id = e.tenant_id
     WHERE e.id = $1 AND e.tenant_id = $2`,
    [estimateId, tenantId]
  );
  return rows[0] || null;
}

export async function updateEstimate(tenantId, estimateId, updates) {
  const allowedFields = [
    'lead_id', 'customer_name', 'customer_address', 'customer_phone', 'customer_email',
    'line_items', 'tax_rate', 'discount_type', 'discount_value',
    'scope_of_work', 'terms', 'warranty_info', 'notes', 'valid_until', 'status',
    'financing_enabled', 'financing_plan_ids',
    'insurance_details', 'upgrades',
  ];

  const setClauses = [];
  const params = [tenantId, estimateId];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      const jsonFields = ['line_items', 'financing_plan_ids', 'insurance_details', 'upgrades'];
      const val = jsonFields.includes(field) ? JSON.stringify(updates[field]) : updates[field];
      params.push(val);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  // Recalculate totals if line items or pricing fields changed
  if (updates.line_items || updates.tax_rate !== undefined || updates.discount_type || updates.discount_value !== undefined) {
    const current = await getEstimateDetail(tenantId, estimateId);
    if (!current) return null;

    const lineItems = updates.line_items || current.line_items;
    const taxRate = updates.tax_rate !== undefined ? updates.tax_rate : current.tax_rate;
    const discType = updates.discount_type || current.discount_type;
    const discValue = updates.discount_value !== undefined ? updates.discount_value : current.discount_value;

    const { subtotal, tax_amount, total } = calculateTotals(lineItems, taxRate, discType, discValue);
    params.push(subtotal, tax_amount, total);
    setClauses.push(`subtotal = $${params.length - 2}`, `tax_amount = $${params.length - 1}`, `total = $${params.length}`);
  }

  if (setClauses.length === 0) return getEstimateDetail(tenantId, estimateId);

  const { rows } = await pool.query(
    `UPDATE estimates SET ${setClauses.join(', ')}
     WHERE id = $2 AND tenant_id = $1
     RETURNING *`,
    params
  );

  // Sync estimate total to lead's estimated_value
  const estimate = rows[0];
  if (estimate && estimate.lead_id) {
    await syncLeadEstimatedValue(estimate.lead_id, tenantId);
  }

  // Auto-create work order when estimate is accepted via admin update
  if (estimate && updates.status === 'accepted') {
    try {
      const { rows: existingWo } = await pool.query(
        'SELECT id FROM work_orders WHERE estimate_id = $1', [estimate.id]
      );
      if (existingWo.length === 0) {
        await createWorkOrderFromEstimate(tenantId, estimate.id);
      }
    } catch (err) {
      logger.warn({ err, estimateId: estimate.id }, 'Auto work order creation failed');
    }
  }

  return estimate || null;
}

export async function deleteEstimate(tenantId, estimateId) {
  // Fetch lead_id before deleting so we can sync the lead's estimated_value
  const { rows: estRows } = await pool.query(
    `SELECT lead_id FROM estimates WHERE id = $1 AND tenant_id = $2`,
    [estimateId, tenantId]
  );
  const leadId = estRows[0]?.lead_id;

  const { rowCount } = await pool.query(
    `DELETE FROM estimates WHERE id = $1 AND tenant_id = $2`,
    [estimateId, tenantId]
  );

  if (rowCount > 0 && leadId) {
    await syncLeadEstimatedValue(leadId, tenantId);
  }

  return rowCount > 0;
}

export async function sendEstimate(tenantId, estimateId) {
  // Get full estimate with company name for email
  const { rows: detailRows } = await pool.query(
    `SELECT e.*, t.name AS company_name
     FROM estimates e
     JOIN tenants t ON t.id = e.tenant_id
     WHERE e.id = $1 AND e.tenant_id = $2 AND e.status = 'draft'`,
    [estimateId, tenantId]
  );
  if (!detailRows[0]) return null;

  const estimate = detailRows[0];

  // Update status
  const { rows } = await pool.query(
    `UPDATE estimates SET status = 'sent', sent_at = now()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [estimateId, tenantId]
  );

  // Send email if customer has an email address
  if (estimate.customer_email) {
    try {
      await sendEstimateEmail(estimate.customer_email, estimate, config.APP_URL);
    } catch (err) {
      logger.error({ err, estimateId, to: estimate.customer_email }, 'Failed to send estimate email');
    }
  }

  return rows[0] || null;
}

export async function duplicateEstimate(tenantId, userId, estimateId) {
  const original = await getEstimateDetail(tenantId, estimateId);
  if (!original) return null;

  return createEstimate(tenantId, userId, {
    lead_id: original.lead_id,
    customer_name: original.customer_name,
    customer_address: original.customer_address,
    customer_phone: original.customer_phone,
    customer_email: original.customer_email,
    line_items: original.line_items,
    tax_rate: parseFloat(original.tax_rate),
    discount_type: original.discount_type,
    discount_value: parseFloat(original.discount_value),
    scope_of_work: original.scope_of_work,
    terms: original.terms,
    warranty_info: original.warranty_info,
    notes: original.notes,
    valid_until: original.valid_until,
  });
}

/**
 * Generate Good/Better/Best tiered estimates from a single estimate.
 * Good = 85% of original price (basic materials)
 * Better = original price (standard — the source estimate)
 * Best = 120% of original price (premium materials/warranty)
 */
export async function generateTiers(tenantId, userId, estimateId) {
  const original = await getEstimateDetail(tenantId, estimateId);
  if (!original) return null;

  const tiers = [
    { label: 'Good', factor: 0.85, desc: 'Standard materials, manufacturer warranty' },
    { label: 'Better', factor: 1.0, desc: 'Upgraded materials, extended warranty' },
    { label: 'Best', factor: 1.20, desc: 'Premium materials, lifetime warranty, priority scheduling' },
  ];

  const results = [];
  for (const tier of tiers) {
    const adjustedItems = (original.line_items || []).map(item => ({
      ...item,
      unit_price: Math.round((parseFloat(item.unit_price) || 0) * tier.factor * 100) / 100,
    }));

    const estimate = await createEstimate(tenantId, userId, {
      lead_id: original.lead_id,
      customer_name: original.customer_name,
      customer_address: original.customer_address,
      customer_phone: original.customer_phone,
      customer_email: original.customer_email,
      line_items: adjustedItems,
      tax_rate: parseFloat(original.tax_rate),
      discount_type: original.discount_type,
      discount_value: parseFloat(original.discount_value),
      scope_of_work: original.scope_of_work,
      terms: original.terms,
      warranty_info: original.warranty_info,
      notes: `[${tier.label} Tier] ${tier.desc}\n\n${original.notes || ''}`.trim(),
      valid_until: original.valid_until,
    });

    results.push({ ...estimate, tier_label: tier.label });
  }

  return results;
}

// ============================================================
// PUBLIC (customer-facing)
// ============================================================

export async function getEstimateByToken(token) {
  const { rows } = await pool.query(
    `SELECT e.*, t.name AS company_name,
            (t.stripe_account_id IS NOT NULL AND t.stripe_onboarding_complete = true) AS stripe_connected
     FROM estimates e
     JOIN tenants t ON t.id = e.tenant_id
     WHERE e.public_token = $1`,
    [token]
  );
  if (rows.length === 0) return null;

  // Mark as viewed if first time
  if (!rows[0].viewed_at) {
    await pool.query(
      `UPDATE estimates SET viewed_at = now(), status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
       WHERE id = $1`,
      [rows[0].id]
    );
  }
  return rows[0];
}

export async function acceptEstimate(token, signerName, signatureData) {
  const { rows } = await pool.query(
    `UPDATE estimates
     SET status = 'accepted', signed_at = now(), signer_name = $2, signature_data = $3
     WHERE public_token = $1 AND status IN ('sent', 'viewed')
     RETURNING *`,
    [token, signerName, signatureData]
  );
  const estimate = rows[0];
  if (estimate && estimate.lead_id) {
    await syncLeadEstimatedValue(estimate.lead_id, estimate.tenant_id);
  }

  // Auto-create work order when estimate is approved/signed
  if (estimate) {
    try {
      const { rows: existingWo } = await pool.query(
        'SELECT id FROM work_orders WHERE estimate_id = $1', [estimate.id]
      );
      if (existingWo.length === 0) {
        await createWorkOrderFromEstimate(estimate.tenant_id, estimate.id);
      }
    } catch (err) {
      logger.warn({ err, estimateId: estimate.id }, 'Auto work order creation failed');
    }
  }

  return estimate || null;
}

// In-person signing (SumoQuote on-the-spot pattern) — works by ID + tenant
export async function signEstimateInPerson(tenantId, estimateId, signerName, signatureData) {
  const { rows } = await pool.query(
    `UPDATE estimates
     SET status = 'accepted', signed_at = now(), signer_name = $3, signature_data = $4
     WHERE id = $1 AND tenant_id = $2 AND status IN ('draft', 'sent', 'viewed')
     RETURNING *`,
    [estimateId, tenantId, signerName, signatureData]
  );
  const estimate = rows[0];
  if (estimate && estimate.lead_id) {
    await syncLeadEstimatedValue(estimate.lead_id, estimate.tenant_id);
  }

  // Auto-create work order
  if (estimate) {
    try {
      const { rows: existingWo } = await pool.query(
        'SELECT id FROM work_orders WHERE estimate_id = $1', [estimate.id]
      );
      if (existingWo.length === 0) {
        await createWorkOrderFromEstimate(estimate.tenant_id, estimate.id);
      }
    } catch (err) {
      logger.warn({ err, estimateId: estimate.id }, 'Auto work order creation from in-person sign failed');
    }
  }

  return estimate || null;
}

export async function declineEstimate(token) {
  const { rows } = await pool.query(
    `UPDATE estimates SET status = 'declined'
     WHERE public_token = $1 AND status IN ('sent', 'viewed')
     RETURNING *`,
    [token]
  );
  const estimate = rows[0];
  if (estimate && estimate.lead_id) {
    await syncLeadEstimatedValue(estimate.lead_id, estimate.tenant_id);
  }
  return estimate || null;
}

// ============================================================
// TEMPLATES
// ============================================================

export async function getTemplates(tenantId) {
  let { rows } = await pool.query(
    `SELECT * FROM estimate_templates WHERE tenant_id = $1 ORDER BY position, name`,
    [tenantId]
  );
  // Auto-seed default templates if none exist for this tenant
  if (rows.length === 0) {
    // SRS Austin, TX pricing — effective 04/15/2024
    const defaults = [
      // Shingles
      ['GAF Timberline HDZ', 'Architectural shingles', 'sq', 122.97, 'Shingles', 0],
      ['GAF Timberline Natural Shadow', 'Architectural shingles', 'sq', 116.97, 'Shingles', 1],
      ['OC Duration Tru Def', 'Owens Corning architectural', 'sq', 123.60, 'Shingles', 2],
      ['CertainTeed Landmark AR', 'Architectural shingles', 'sq', 115.00, 'Shingles', 3],
      ['CertainTeed Landmark MAX DEF', 'Architectural shingles', 'sq', 119.00, 'Shingles', 4],
      ['IKO Cambridge', 'Architectural shingles', 'sq', 112.95, 'Shingles', 5],
      ['IKO Dynasty', 'Premium architectural shingles', 'sq', 118.35, 'Shingles', 6],
      ['Atlas Pinnacle Pristine', 'Architectural shingles', 'sq', 115.77, 'Shingles', 7],
      ['GAF Armorshield II IR', 'Impact resistant shingles', 'sq', 154.98, 'Shingles', 8],
      ['CertainTeed Landmark Climateflex IR', 'Impact resistant shingles', 'sq', 153.72, 'Shingles', 9],
      ['Atlas Pinnacle Impact', 'Impact resistant shingles', 'sq', 140.10, 'Shingles', 10],
      // Starter
      ['GAF ProStart Starter', 'Starter strip (120 lf/bdl)', 'bdl', 52.80, 'Starter / Ridge', 11],
      ['OC Starter Strip', 'Starter strip (100 lf/bdl)', 'bdl', 58.99, 'Starter / Ridge', 12],
      ['CertainTeed Swift Starter', 'Starter strip (116 lf/bdl)', 'bdl', 52.91, 'Starter / Ridge', 13],
      // Hip & Ridge
      ['GAF Seal-a-Ridge', 'Hip & ridge (25 lf/bdl)', 'bdl', 67.13, 'Starter / Ridge', 14],
      ['GAF Timbertex', 'Hip & ridge (20 lf/bdl)', 'bdl', 64.48, 'Starter / Ridge', 15],
      ['GAF Z-Ridge', 'Hip & ridge (33 lf/bdl)', 'bdl', 71.00, 'Starter / Ridge', 16],
      ['OC Pro Edge H&R', 'Hip & ridge (33 lf/bdl)', 'bdl', 77.77, 'Starter / Ridge', 17],
      ['CertainTeed Cedar Crest H&R IR', 'Impact resistant (20 lf/bdl)', 'bdl', 75.38, 'Starter / Ridge', 18],
      // Underlayment
      ['SPEC Synthetic Underlay', 'Synthetic underlayment 10SQ roll', 'roll', 79.95, 'Underlayment', 19],
      ['RhinoRoof U20 Synthetic', 'Synthetic underlayment 10SQ roll', 'roll', 83.44, 'Underlayment', 20],
      ['GAF FeltBuster', 'Synthetic underlayment 10SQ roll', 'roll', 99.68, 'Underlayment', 21],
      ['GAF Tiger Paw', 'Premium synthetic 10SQ roll', 'roll', 191.01, 'Underlayment', 22],
      ['GAF Deck Armor', 'Premium breathable 10SQ roll', 'roll', 296.02, 'Underlayment', 23],
      ['OC ProArmor Underlayment', 'Synthetic underlayment 10SQ roll', 'roll', 114.11, 'Underlayment', 24],
      ['15# Felt / 30# Felt', '15# 4SQ or 30# 2SQ roll', 'roll', 22.98, 'Underlayment', 25],
      // Ice & Water Shield
      ['GAF StormGuard I&W', 'Ice & water shield 2SQ roll', 'roll', 105.75, 'Underlayment', 26],
      ['MFM IB3 Ice Buster SA', 'Self-adhering I&W 2SQ roll', 'roll', 72.03, 'Underlayment', 27],
      ['Carlisle WIP 300 High Temp', 'High temp I&W 2SQ roll', 'roll', 130.00, 'Underlayment', 28],
      ['Carlisle WIP 250 High Temp', 'High temp I&W 2SQ roll', 'roll', 106.50, 'Underlayment', 29],
      ['OC WeatherLock I&W', 'Ice & water shield 2SQ roll', 'roll', 115.04, 'Underlayment', 30],
      // Ventilation
      ['GAF Cobra Ridge Vent', '9" or 12" ridge vent', 'each', 14.71, 'Ventilation', 31],
      ['Lomanco 550 Low Profile Vent', 'Static roof vent', 'each', 17.04, 'Ventilation', 32],
      ['Lomanco 750 Slant Back Vent', 'Slant back static vent', 'each', 19.74, 'Ventilation', 33],
      ['Butler VX25 Static Dome Vent', 'Dome static vent', 'each', 43.37, 'Ventilation', 34],
      ['Lomanco 12" Turbine Vent', 'Wind-driven turbine vent', 'each', 79.73, 'Ventilation', 35],
      ['Attic Breeze 35W Solar Vent', 'Solar powered attic vent', 'each', 590.21, 'Ventilation', 36],
      ['Butler VX2414AM Power Vent', 'Electric power vent', 'each', 95.33, 'Ventilation', 37],
      // Metal / Flashing
      ['1.5"x1.5" Painted Drip Edge', 'Embossed drip edge', 'each', 5.55, 'Metal / Flashing', 38],
      ['2"x2" Painted Drip Edge', 'Embossed or smooth drip edge', 'each', 6.95, 'Metal / Flashing', 39],
      ['20"x50\' Valley Metal Roll', 'Pre-bent valley metal', 'roll', 64.98, 'Metal / Flashing', 40],
      ['4"x4"x8" Step Flashing', 'Step flashing 100/bdl', 'bdl', 59.48, 'Metal / Flashing', 41],
      ['4"x5"x10\' Headwall Flashing', 'Headwall flashing', 'each', 18.59, 'Metal / Flashing', 42],
      ['4"x5"x10\' Turnback Flashing', 'Turnback flashing', 'each', 18.87, 'Metal / Flashing', 43],
      // Pipe Boots
      ['3n1 Pipe Boot', 'Standard pipe boot', 'each', 6.85, 'Pipe Boots', 44],
      ['4" Pipe Boot', 'Standard 4" pipe boot', 'each', 10.71, 'Pipe Boots', 45],
      ['1.5" Lead 2.5#', 'Lead pipe flashing', 'each', 18.27, 'Pipe Boots', 46],
      ['2" Lead 2.5#', 'Lead pipe flashing', 'each', 19.56, 'Pipe Boots', 47],
      ['3" Lead 2.5#', 'Lead pipe flashing', 'each', 25.69, 'Pipe Boots', 48],
      ['4" Lead 2.5#', 'Lead pipe flashing', 'each', 34.25, 'Pipe Boots', 49],
      ['1.5" Bullet Boot', 'Rubber pipe boot', 'each', 16.00, 'Pipe Boots', 50],
      ['2" Bullet Boot', 'Rubber pipe boot', 'each', 18.00, 'Pipe Boots', 51],
      ['3" Bullet Boot', 'Rubber pipe boot', 'each', 20.00, 'Pipe Boots', 52],
      ['4" Bullet Boot', 'Rubber pipe boot', 'each', 34.95, 'Pipe Boots', 53],
      ['0"-5-3/8" Split Boot', 'Split pipe boot', 'each', 39.70, 'Pipe Boots', 54],
      // Fasteners
      ['1" Plastic Caps', '2000/box', 'box', 18.00, 'Fasteners', 55],
      ['1-1/4" Coil Nails', '7200/box', 'box', 49.95, 'Fasteners', 56],
      ['3/4" Coil Nails', 'Coil roofing nails', 'box', 56.00, 'Fasteners', 57],
      ['3/8" Staples', 'Staples', 'box', 7.99, 'Fasteners', 58],
      // Accessories / Sealants
      ['NP-1 Caulk', 'Polyurethane sealant', 'each', 7.71, 'Accessories', 59],
      ['Geocel 2300 Clear', 'Clear sealant', 'each', 8.69, 'Accessories', 60],
      ['Duralink 35 Caulk', 'Sealant', 'each', 7.71, 'Accessories', 61],
      ['Geocel Spray Paint', 'Touch-up paint', 'each', 8.50, 'Accessories', 62],
      // Delivery
      ['Ground Drop Delivery', 'SRS ground delivery', 'each', 80.00, 'Delivery', 63],
      ['Roof Load Delivery', 'SRS rooftop delivery', 'each', 100.00, 'Delivery', 64],
    ];
    for (const [name, desc, unit, price, section, pos] of defaults) {
      await pool.query(
        `INSERT INTO estimate_templates (tenant_id, name, description, unit, default_unit_price, section, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, name, desc, unit, price, section, pos]
      );
    }
    ({ rows } = await pool.query(
      `SELECT * FROM estimate_templates WHERE tenant_id = $1 ORDER BY position, name`,
      [tenantId]
    ));
  }
  return rows;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Sync the sum of non-declined estimate totals to the lead's estimated_value.
 */
async function syncLeadEstimatedValue(leadId, tenantId) {
  const { rows: [totals] } = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS sum FROM estimates
     WHERE lead_id = $1 AND tenant_id = $2 AND status != 'declined'`,
    [leadId, tenantId]
  );
  await pool.query(
    'UPDATE leads SET estimated_value = $1 WHERE id = $2 AND tenant_id = $3',
    [totals.sum, leadId, tenantId]
  );
}

function calculateTotals(lineItems, taxRate, discountType, discountValue) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  const subtotal = items.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  }, 0);

  let discount = 0;
  if (discountType === 'percent') {
    discount = subtotal * (Number(discountValue) || 0) / 100;
  } else {
    discount = Number(discountValue) || 0;
  }

  const taxable = Math.max(0, subtotal - discount);
  const tax_amount = taxable * ((Number(taxRate) || 0) / 100);
  const total = taxable + tax_amount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax_amount: Math.round(tax_amount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
