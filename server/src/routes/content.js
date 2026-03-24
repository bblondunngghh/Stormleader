import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
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

export default router;
