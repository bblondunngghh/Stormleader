import { Router } from 'express';
import { listCounties, getCounty, addCounty, triggerImport, getImportStatus } from '../services/countyService.js';

const router = Router();

/**
 * GET /api/counties — list all registered county data sources
 */
router.get('/', async (req, res, next) => {
  try {
    const counties = await listCounties();
    res.json(counties);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/counties — add a new county ArcGIS endpoint
 */
router.post('/', async (req, res, next) => {
  try {
    const { county_name, state, fips_code, arcgis_url, field_map, geometry_type, data_source_tag, bbox } = req.body;

    if (!county_name || !arcgis_url || !field_map || !data_source_tag) {
      return res.status(400).json({ error: 'county_name, arcgis_url, field_map, and data_source_tag are required' });
    }

    const county = await addCounty({ county_name, state, fips_code, arcgis_url, field_map, geometry_type, data_source_tag, bbox });
    res.status(201).json(county);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'County already exists' });
    }
    next(err);
  }
});

/**
 * POST /api/counties/:id/import — manually trigger import for a county
 * :id can be a UUID or county name (e.g. "harris")
 */
router.post('/:id/import', async (req, res, next) => {
  try {
    const county = await getCounty(req.params.id);
    if (!county) {
      return res.status(404).json({ error: 'County not found' });
    }

    const result = triggerImport(county.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/counties/:id/status — check import progress
 */
router.get('/:id/status', async (req, res, next) => {
  try {
    const county = await getCounty(req.params.id);
    if (!county) {
      return res.status(404).json({ error: 'County not found' });
    }

    const importStatus = getImportStatus(county.id);
    res.json({
      county_name: county.county_name,
      last_imported_at: county.last_imported_at,
      total_records: county.total_records,
      current_import: importStatus,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
