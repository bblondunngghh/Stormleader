import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import pool from '../db/pool.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// GET /api/crm/territories — list all territories for tenant
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*,
              CONCAT(u.first_name, ' ', u.last_name) as assigned_user_name,
              ST_AsGeoJSON(t.polygon)::json as geojson,
              (SELECT COUNT(*)::int FROM canvass_pins cp
               WHERE cp.tenant_id = t.tenant_id
                 AND t.polygon IS NOT NULL
                 AND ST_Within(cp.location, t.polygon)) as pin_count
       FROM canvass_territories t
       LEFT JOIN users u ON t.assigned_user_id = u.id
       WHERE t.tenant_id = $1
       ORDER BY t.created_at DESC`,
      [req.tenantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/territories/:id — single territory with pins
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*,
              CONCAT(u.first_name, ' ', u.last_name) as assigned_user_name,
              ST_AsGeoJSON(t.polygon)::json as geojson
       FROM canvass_territories t
       LEFT JOIN users u ON t.assigned_user_id = u.id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Territory not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/territories — create territory
router.post('/', async (req, res, next) => {
  try {
    const { name, color, coordinates, assigned_user_id, notes } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
      return res.status(400).json({ error: 'coordinates must be an array of at least 3 [lng, lat] pairs' });
    }

    // Validate all coordinates are numeric to prevent WKT injection
    if (coordinates.some(c => !Array.isArray(c) || c.length < 2 || typeof c[0] !== 'number' || typeof c[1] !== 'number' || !isFinite(c[0]) || !isFinite(c[1]))) {
      return res.status(400).json({ error: 'Each coordinate must be [lng, lat] with finite numeric values' });
    }

    // Close the polygon ring if not already closed
    const ring = [...coordinates];
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([...first]);
    }

    const coordStr = ring.map(c => `${c[0]} ${c[1]}`).join(', ');
    const wkt = `POLYGON((${coordStr}))`;

    const { rows } = await pool.query(
      `INSERT INTO canvass_territories (tenant_id, name, color, polygon, assigned_user_id, notes)
       VALUES ($1, $2, $3, ST_GeomFromText($4, 4326), $5, $6)
       RETURNING *, ST_AsGeoJSON(polygon)::json as geojson`,
      [req.tenantId, name, color || 'oklch(0.65 0.27 29)', wkt, assigned_user_id || null, notes || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/crm/territories/:id — update territory
router.patch('/:id', async (req, res, next) => {
  try {
    const { name, color, coordinates, assigned_user_id, notes } = req.body;
    const sets = [];
    const params = [req.tenantId, req.params.id];
    let idx = 3;

    if (name !== undefined) { sets.push(`name = $${idx}`); params.push(name); idx++; }
    if (color !== undefined) { sets.push(`color = $${idx}`); params.push(color); idx++; }
    if (notes !== undefined) { sets.push(`notes = $${idx}`); params.push(notes); idx++; }
    if (assigned_user_id !== undefined) {
      sets.push(`assigned_user_id = $${idx}`);
      params.push(assigned_user_id || null);
      idx++;
    }
    if (coordinates && Array.isArray(coordinates) && coordinates.length >= 3) {
      // Validate all coordinates are numeric to prevent WKT injection
      if (coordinates.some(c => !Array.isArray(c) || c.length < 2 || typeof c[0] !== 'number' || typeof c[1] !== 'number' || !isFinite(c[0]) || !isFinite(c[1]))) {
        return res.status(400).json({ error: 'Each coordinate must be [lng, lat] with finite numeric values' });
      }
      const ring = [...coordinates];
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
      const coordStr = ring.map(c => `${c[0]} ${c[1]}`).join(', ');
      sets.push(`polygon = ST_GeomFromText($${idx}, 4326)`);
      params.push(`POLYGON((${coordStr}))`);
      idx++;
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    sets.push('updated_at = now()');

    const { rows } = await pool.query(
      `UPDATE canvass_territories SET ${sets.join(', ')}
       WHERE tenant_id = $1 AND id = $2
       RETURNING *, ST_AsGeoJSON(polygon)::json as geojson`,
      params
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Territory not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/crm/territories/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM canvass_territories WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Territory not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/territories/:id/pins — pins within a territory
router.get('/:id/pins', async (req, res, next) => {
  try {
    const { rows: tRows } = await pool.query(
      'SELECT polygon FROM canvass_territories WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    );
    if (tRows.length === 0) return res.status(404).json({ error: 'Territory not found' });

    const { rows } = await pool.query(
      `SELECT cp.*, CONCAT(u.first_name, ' ', u.last_name) as user_name,
              ST_Y(cp.location::geometry) as lat, ST_X(cp.location::geometry) as lng
       FROM canvass_pins cp
       JOIN users u ON cp.user_id = u.id
       WHERE cp.tenant_id = $1
         AND ST_Within(cp.location, (SELECT polygon FROM canvass_territories WHERE id = $2))
       ORDER BY cp.created_at DESC`,
      [req.tenantId, req.params.id]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
