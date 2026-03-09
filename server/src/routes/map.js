import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import * as stormService from '../services/stormService.js';
import * as propertyService from '../services/propertyService.js';
import pool from '../db/pool.js';

const router = Router();
router.use(authenticate);

// Check PostGIS availability once at startup
let hasPostGIS = null;
async function checkPostGIS() {
  if (hasPostGIS !== null) return hasPostGIS;
  try {
    const { rows } = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS e`
    );
    hasPostGIS = rows[0].e;
  } catch {
    hasPostGIS = false;
  }
  return hasPostGIS;
}

const emptyFC = { type: 'FeatureCollection', features: [] };

// Debug endpoint to diagnose map issues — remove after fixing
router.get('/debug', async (req, res) => {
  try {
    const postgis = await checkPostGIS();
    const { rows: ext } = await pool.query(`SELECT extname FROM pg_extension ORDER BY extname`);
    const { rows: tables } = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('storm_events','properties') ORDER BY table_name`);
    const colInfo = {};
    for (const t of tables) {
      const { rows: cols } = await pool.query(`SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ('geom','location','drift_corrected_geom','bbox') ORDER BY column_name`, [t.table_name]);
      colInfo[t.table_name] = cols;
    }
    const { rows: counts } = await pool.query(`SELECT (SELECT count(*) FROM storm_events) AS storms, (SELECT count(*) FROM properties) AS props`);
    res.json({ postgis, extensions: ext.map(e => e.extname), tables: tables.map(t => t.table_name), columns: colInfo, counts: counts[0] });
  } catch (err) {
    res.status(500).json({ error: err.message, code: err.code });
  }
});

// GET /api/map/properties?bbox=w,s,e,n&improvedOnly=true
router.get('/properties', async (req, res, next) => {
  try {
    if (!(await checkPostGIS())) return res.json(emptyFC);
    const { bbox, improvedOnly } = req.query;
    if (!bbox) return res.status(400).json({ error: 'bbox required' });
    const bboxArr = bbox.split(',').map(Number);
    if (bboxArr.length !== 4 || bboxArr.some(isNaN)) return res.status(400).json({ error: 'Invalid bbox' });
    const result = await propertyService.getPropertiesInViewport(bboxArr, 1000, { improvedOnly: improvedOnly === 'true' });
    res.json(result);
  } catch (err) {
    // Return empty collection instead of 500 for geo query failures
    if (err.code && err.code.startsWith('XX') || err.message?.includes('ST_')) {
      return res.json(emptyFC);
    }
    next(err);
  }
});

// GET /api/map/affected-properties?bbox=w,s,e,n&timeRange=30d&improvedOnly=true
router.get('/affected-properties', async (req, res, next) => {
  try {
    if (!(await checkPostGIS())) return res.json(emptyFC);
    const { bbox, timeRange, improvedOnly } = req.query;
    if (!bbox) return res.status(400).json({ error: 'bbox required' });
    const bboxArr = bbox.split(',').map(Number);
    if (bboxArr.length !== 4 || bboxArr.some(isNaN)) return res.status(400).json({ error: 'Invalid bbox' });
    const result = await propertyService.getPropertiesInStormZones(bboxArr, timeRange || '30d', 5000, { improvedOnly: improvedOnly === 'true' });
    res.json(result);
  } catch (err) {
    if (err.code && err.code.startsWith('XX') || err.message?.includes('ST_')) {
      return res.json(emptyFC);
    }
    next(err);
  }
});

// GET /api/map/swaths?bbox=w,s,e,n&timeRange=7d
router.get('/swaths', async (req, res, next) => {
  try {
    if (!(await checkPostGIS())) return res.json(emptyFC);
    const { bbox, timeRange, startDate, endDate } = req.query;
    if (!bbox) return res.status(400).json({ error: 'bbox required' });
    const bboxArr = bbox.split(',').map(Number);
    if (bboxArr.length !== 4 || bboxArr.some(isNaN)) return res.status(400).json({ error: 'Invalid bbox' });
    const result = await stormService.getSwathsByViewport(bboxArr, timeRange || '7d', startDate, endDate);
    res.json(result);
  } catch (err) {
    if (err.code && err.code.startsWith('XX') || err.message?.includes('ST_')) {
      return res.json(emptyFC);
    }
    next(err);
  }
});

export default router;
