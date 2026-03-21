import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import pool from '../db/pool.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

function parseDateRange(query) {
  const start = query.start || '2000-01-01';
  const end = query.end || '2099-12-31';
  return [start, end];
}

// Revenue by month
router.get('/revenue', async (req, res, next) => {
  try {
    const [start, end] = parseDateRange(req.query);
    const { rows } = await pool.query(
      `SELECT
        DATE_TRUNC('month', l.created_at) as month,
        SUM(COALESCE(l.estimated_value, 0)) as estimated,
        SUM(COALESCE(l.actual_value, 0)) as actual,
        COUNT(*) as lead_count
      FROM leads l
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
        AND l.created_at BETWEEN $2 AND $3
      GROUP BY DATE_TRUNC('month', l.created_at)
      ORDER BY month`,
      [req.tenantId, start, end]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Pipeline — leads count and value by stage
router.get('/pipeline', async (req, res, next) => {
  try {
    const [start, end] = parseDateRange(req.query);
    const { rows } = await pool.query(
      `SELECT
        l.stage,
        COUNT(*) as count,
        SUM(COALESCE(l.estimated_value, 0)) as total_value
      FROM leads l
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
        AND l.created_at BETWEEN $2 AND $3
      GROUP BY l.stage
      ORDER BY CASE l.stage
        WHEN 'new' THEN 1 WHEN 'contacted' THEN 2 WHEN 'appt_set' THEN 3
        WHEN 'inspected' THEN 4 WHEN 'estimate_sent' THEN 5 WHEN 'negotiating' THEN 6
        WHEN 'sold' THEN 7 WHEN 'in_production' THEN 8 WHEN 'on_hold' THEN 9 WHEN 'lost' THEN 10
      END`,
      [req.tenantId, start, end]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Conversion rates by source
router.get('/conversion', async (req, res, next) => {
  try {
    const [start, end] = parseDateRange(req.query);
    const { rows } = await pool.query(
      `SELECT
        COALESCE(l.source, 'unknown') as source,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE l.stage = 'sold') as sold,
        SUM(COALESCE(l.estimated_value, 0)) FILTER (WHERE l.stage = 'sold') as sold_value
      FROM leads l
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
        AND l.created_at BETWEEN $2 AND $3
      GROUP BY l.source
      ORDER BY total DESC`,
      [req.tenantId, start, end]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Rep performance
router.get('/rep-performance', async (req, res, next) => {
  try {
    const [start, end] = parseDateRange(req.query);
    const { rows } = await pool.query(
      `SELECT
        u.id, u.name,
        COUNT(l.id) as leads_assigned,
        COUNT(l.id) FILTER (WHERE l.stage = 'sold') as leads_sold,
        SUM(COALESCE(l.estimated_value, 0)) FILTER (WHERE l.stage = 'sold') as sold_value,
        COUNT(a.id) as activity_count
      FROM users u
      LEFT JOIN leads l ON l.assigned_rep_id = u.id AND l.tenant_id = $1 AND l.deleted_at IS NULL
        AND l.created_at BETWEEN $2 AND $3
      LEFT JOIN activities a ON a.user_id = u.id AND a.tenant_id = $1
        AND a.created_at BETWEEN $2 AND $3
      WHERE u.tenant_id = $1 AND u.is_active = true
      GROUP BY u.id, u.name
      ORDER BY sold_value DESC NULLS LAST`,
      [req.tenantId, start, end]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Stage duration — average days per stage
router.get('/stage-duration', async (req, res, next) => {
  try {
    const [start, end] = parseDateRange(req.query);
    const { rows } = await pool.query(
      `SELECT
        l.stage,
        ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - l.updated_at)) / 86400), 1) as avg_days
      FROM leads l
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
        AND l.created_at BETWEEN $2 AND $3
      GROUP BY l.stage`,
      [req.tenantId, start, end]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Lead source distribution
router.get('/lead-sources', async (req, res, next) => {
  try {
    const [start, end] = parseDateRange(req.query);
    const { rows } = await pool.query(
      `SELECT
        COALESCE(l.source, 'unknown') as source,
        COUNT(*) as count,
        SUM(COALESCE(l.estimated_value, 0)) as total_value
      FROM leads l
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
        AND l.created_at BETWEEN $2 AND $3
      GROUP BY l.source
      ORDER BY count DESC`,
      [req.tenantId, start, end]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
