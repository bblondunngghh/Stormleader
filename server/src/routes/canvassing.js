import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import pool from '../db/pool.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// Valid outcomes for validation
const VALID_OUTCOMES = ['not_home', 'interested', 'not_interested', 'scheduled', 'follow_up', 'already_customer'];

// GET /api/crm/canvass-pins — list pins with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { bbox, date, user_id } = req.query;
    const params = [req.tenantId];
    let idx = 2;

    let sql = `
      SELECT cp.*, u.name as user_name,
             ST_Y(cp.location::geometry) as lat, ST_X(cp.location::geometry) as lng
      FROM canvass_pins cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.tenant_id = $1
    `;

    if (bbox) {
      const [w, s, e, n] = bbox.split(',').map(Number);
      if ([w, s, e, n].some(isNaN)) {
        return res.status(400).json({ error: 'Invalid bbox format. Use w,s,e,n' });
      }
      sql += ` AND ST_Within(cp.location, ST_MakeEnvelope($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, 4326))`;
      params.push(w, s, e, n);
      idx += 4;
    }

    if (date) {
      sql += ` AND cp.created_at::date = $${idx}`;
      params.push(date);
      idx++;
    }

    if (user_id) {
      sql += ` AND cp.user_id = $${idx}`;
      params.push(user_id);
      idx++;
    }

    sql += ' ORDER BY cp.created_at DESC';

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/canvass-pins/stats — daily stats
router.get('/stats', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const { rows } = await pool.query(
      `SELECT outcome, COUNT(*)::int as count
       FROM canvass_pins
       WHERE tenant_id = $1 AND created_at::date = $2
       GROUP BY outcome`,
      [req.tenantId, date]
    );

    const total = rows.reduce((sum, r) => sum + r.count, 0);
    res.json({ date, total, outcomes: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/canvass-pins — create a pin
router.post('/', async (req, res, next) => {
  try {
    const { lat, lng, outcome, notes, address } = req.body;

    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }
    if (outcome && !VALID_OUTCOMES.includes(outcome)) {
      return res.status(400).json({ error: `Invalid outcome. Valid: ${VALID_OUTCOMES.join(', ')}` });
    }

    const { rows } = await pool.query(
      `INSERT INTO canvass_pins (tenant_id, user_id, location, address, outcome, notes)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7)
       RETURNING *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng`,
      [req.tenantId, req.user.id, lng, lat, address || null, outcome || null, notes || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/crm/canvass-pins/:id — update outcome/notes
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { outcome, notes, address } = req.body;

    if (outcome && !VALID_OUTCOMES.includes(outcome)) {
      return res.status(400).json({ error: `Invalid outcome. Valid: ${VALID_OUTCOMES.join(', ')}` });
    }

    // Build dynamic SET clause
    const sets = [];
    const params = [req.tenantId, id];
    let idx = 3;

    if (outcome !== undefined) {
      sets.push(`outcome = $${idx}`);
      params.push(outcome);
      idx++;
    }
    if (notes !== undefined) {
      sets.push(`notes = $${idx}`);
      params.push(notes);
      idx++;
    }
    if (address !== undefined) {
      sets.push(`address = $${idx}`);
      params.push(address);
      idx++;
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { rows } = await pool.query(
      `UPDATE canvass_pins SET ${sets.join(', ')}
       WHERE tenant_id = $1 AND id = $2
       RETURNING *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/canvass-pins/:id/convert — convert pin to lead
router.post('/:id/convert', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get the pin
    const { rows: pinRows } = await client.query(
      `SELECT *, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
       FROM canvass_pins
       WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );

    if (pinRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pin not found' });
    }

    const pin = pinRows[0];

    if (pin.lead_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Pin already converted to a lead', lead_id: pin.lead_id });
    }

    // 2. Create a property
    const { rows: propRows } = await client.query(
      `INSERT INTO properties (location, address_line1, data_source)
       VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, 'canvassing')
       RETURNING id`,
      [pin.lng, pin.lat, pin.address || null]
    );
    const propertyId = propRows[0].id;

    // 3. Create a lead
    const { rows: leadRows } = await client.query(
      `INSERT INTO leads (tenant_id, property_id, source, stage, address, assigned_rep_id)
       VALUES ($1, $2, 'canvassing', 'new', $3, $4)
       RETURNING *`,
      [req.tenantId, propertyId, pin.address || null, req.user.id]
    );
    const lead = leadRows[0];

    // 4. Update pin with lead_id
    await client.query(
      `UPDATE canvass_pins SET lead_id = $1 WHERE id = $2`,
      [lead.id, pin.id]
    );

    await client.query('COMMIT');
    res.status(201).json(lead);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;
