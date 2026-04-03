import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import pool from '../db/pool.js';
import {
  generateContent,
  getTemplates,
  generateContentBatch,
  CONTENT_TYPES,
  TONES,
} from '../services/contentService.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// POST /api/crm/content/generate — generate a single piece of content
router.post('/generate', (req, res, next) => {
  try {
    const { type, tone, variables } = req.body;

    if (!type || !CONTENT_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${CONTENT_TYPES.join(', ')}` });
    }
    if (!tone || !TONES.includes(tone)) {
      return res.status(400).json({ error: `Invalid tone. Must be one of: ${TONES.join(', ')}` });
    }

    const result = generateContent(type, tone, variables || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/crm/content/templates — list available templates
router.get('/templates', (req, res, next) => {
  try {
    const { type, tone } = req.query;

    if (type && !CONTENT_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${CONTENT_TYPES.join(', ')}` });
    }
    if (tone && !TONES.includes(tone)) {
      return res.status(400).json({ error: `Invalid tone. Must be one of: ${TONES.join(', ')}` });
    }

    if (type && tone) {
      const tpls = getTemplates(type, tone);
      return res.json({ type, tone, count: tpls.length, templates: tpls });
    }

    // Return counts for all type/tone combos
    const summary = {};
    for (const t of CONTENT_TYPES) {
      summary[t] = {};
      for (const tn of TONES) {
        summary[t][tn] = getTemplates(t, tn).length;
      }
    }
    res.json({ types: CONTENT_TYPES, tones: TONES, templateCounts: summary });
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/content/generate-batch — generate multiple pieces at once
router.post('/generate-batch', (req, res, next) => {
  try {
    const { type, tone, variables, count = 5 } = req.body;

    if (!type || !CONTENT_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${CONTENT_TYPES.join(', ')}` });
    }
    if (!tone || !TONES.includes(tone)) {
      return res.status(400).json({ error: `Invalid tone. Must be one of: ${TONES.join(', ')}` });
    }

    const results = generateContentBatch(type, tone, variables || {}, Math.min(count, 10));
    res.json({ type, tone, count: results.length, results });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// CONTENT LIBRARY — persist saved content to DB (replaces localStorage)
// ============================================================

// GET /api/crm/content/library — list saved content
router.get('/library', async (req, res, next) => {
  try {
    const { type, limit = '100', offset = '0' } = req.query;
    const params = [req.tenantId];
    const conditions = ['tenant_id = $1'];
    if (type) {
      params.push(type);
      conditions.push(`content_type = $${params.length}`);
    }
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const { rows } = await pool.query(
      `SELECT * FROM content_library WHERE ${conditions.join(' AND ')} ORDER BY saved_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total FROM content_library WHERE ${conditions.join(' AND ')}`,
      params.slice(0, params.length - 2)
    );
    res.json({ items: rows, total: parseInt(countRows[0].total, 10) });
  } catch (err) {
    next(err);
  }
});

// POST /api/crm/content/library — save content item
router.post('/library', async (req, res, next) => {
  try {
    const { content, content_type, tone } = req.body;
    if (!content || !content_type) return res.status(400).json({ error: 'content and content_type are required' });
    const { rows } = await pool.query(
      `INSERT INTO content_library (tenant_id, user_id, content, content_type, tone)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.tenantId, req.user.id, JSON.stringify(content), content_type, tone || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/crm/content/library/:id — delete saved content
router.delete('/library/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM content_library WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Content not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
