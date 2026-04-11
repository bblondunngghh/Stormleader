import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import validateId from '../middleware/validateId.js';
import pool from '../db/pool.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// GET /api/crm/automations — list all automations for tenant
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM automations WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [req.tenantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/automations — create automation
router.post('/', async (req, res, next) => {
  try {
    const { name, trigger_type, trigger_config, action_type, action_config } = req.body;
    if (!name || !trigger_type || !action_type) {
      return res.status(400).json({ error: 'name, trigger_type, and action_type are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO automations (tenant_id, name, trigger_type, trigger_config, action_type, action_config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.tenantId, name, trigger_type, trigger_config || {}, action_type, action_config || {}]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/crm/automations/:id — update automation
router.patch('/:id', validateId(), async (req, res, next) => {
  try {
    const { name, trigger_type, trigger_config, action_type, action_config, is_active } = req.body;
    const setClauses = [];
    const params = [req.tenantId, req.params.id];

    if (name !== undefined) { params.push(name); setClauses.push(`name = $${params.length}`); }
    if (trigger_type !== undefined) { params.push(trigger_type); setClauses.push(`trigger_type = $${params.length}`); }
    if (trigger_config !== undefined) { params.push(JSON.stringify(trigger_config)); setClauses.push(`trigger_config = $${params.length}`); }
    if (action_type !== undefined) { params.push(action_type); setClauses.push(`action_type = $${params.length}`); }
    if (action_config !== undefined) { params.push(JSON.stringify(action_config)); setClauses.push(`action_config = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active); setClauses.push(`is_active = $${params.length}`); }

    if (setClauses.length === 0) return res.status(400).json({ error: 'No fields to update' });

    setClauses.push('updated_at = NOW()');

    const { rows } = await pool.query(
      `UPDATE automations SET ${setClauses.join(', ')} WHERE id = $2 AND tenant_id = $1 RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Automation not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/crm/automations/:id — delete automation
router.delete('/:id', validateId(), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM automations WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Automation not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/crm/automations/:id/toggle — toggle is_active
router.patch('/:id/toggle', validateId(), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE automations SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Automation not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
