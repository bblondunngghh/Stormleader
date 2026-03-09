import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as roofMeasurementService from '../services/roofMeasurementService.js';
import pool from '../db/pool.js';

const router = Router();

router.use(authenticate, tenantScope);

// GET /api/roof-measurement/config
router.get('/config', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT roof_measurement_enabled FROM tenant_skip_trace_config WHERE tenant_id = $1',
      [req.tenantId]
    );
    res.json({ roof_measurement_enabled: rows[0]?.roof_measurement_enabled || false });
  } catch (err) { next(err); }
});

// PUT /api/roof-measurement/config
router.put('/config', async (req, res, next) => {
  try {
    const { roof_measurement_enabled } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO tenant_skip_trace_config (tenant_id, roof_measurement_enabled)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE SET roof_measurement_enabled = $2, updated_at = NOW()
       RETURNING roof_measurement_enabled`,
      [req.tenantId, roof_measurement_enabled]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/roof-measurement/measure
router.post('/measure', async (req, res, next) => {
  try {
    const { propertyId } = req.body;
    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId is required' });
    }

    // Check roof measurement is enabled and has payment method
    const { rows: config } = await pool.query(
      'SELECT roof_measurement_enabled, stripe_payment_method_id FROM tenant_skip_trace_config WHERE tenant_id = $1',
      [req.tenantId]
    );
    if (!config[0]?.roof_measurement_enabled) {
      return res.status(403).json({ error: 'Roof measurement is not enabled for your account' });
    }
    if (!config[0]?.stripe_payment_method_id) {
      return res.status(402).json({ error: 'No payment method configured. Add a card in Settings.' });
    }

    const result = await roofMeasurementService.measureRoof(req.tenantId, propertyId);
    res.json(result);
  } catch (err) {
    if (err.message.includes('not configured')) {
      return res.status(503).json({ error: 'Roof measurement service not configured. Set GOOGLE_SOLAR_API_KEY.' });
    }
    if (err.message.includes('does not have roof data') || err.message.includes('No roof data available')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('No roof segment data')) {
      return res.status(404).json({ error: 'No roof segment data available for this location.' });
    }
    next(err);
  }
});

// POST /api/roof-measurement/manual — Free manual entry (no API call)
router.post('/manual', async (req, res, next) => {
  try {
    const { propertyId, roof_sqft, roof_pitch_degrees, roof_segments,
      roof_ridge_ft, roof_valley_ft, roof_eave_ft, roof_rake_ft, roof_hip_ft, roof_drip_edge_ft, roof_flashing_ft,
      source_type, additive } = req.body;
    if (!propertyId) return res.status(400).json({ error: 'propertyId is required' });
    if (!roof_sqft && !roof_ridge_ft && !roof_eave_ft && !roof_rake_ft) return res.status(400).json({ error: 'roof_sqft or edge measurements are required' });
    const result = await roofMeasurementService.manualRoofEntry(propertyId, {
      roof_sqft, roof_pitch_degrees, roof_segments,
      roof_ridge_ft, roof_valley_ft, roof_eave_ft, roof_rake_ft, roof_hip_ft, roof_drip_edge_ft, roof_flashing_ft,
      source_type, additive,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/roof-measurement/segments/:propertyId — Return parsed Google Solar segment data for overlay
router.get('/segments/:propertyId', async (req, res, next) => {
  try {
    const { propertyId } = req.params;
    const { rows } = await pool.query(
      `SELECT raw_response FROM roof_measurement_usage
       WHERE tenant_id = $1 AND property_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [req.tenantId, propertyId]
    );
    if (!rows.length || !rows[0].raw_response) {
      return res.json({ segments: [] });
    }
    const data = typeof rows[0].raw_response === 'string'
      ? JSON.parse(rows[0].raw_response)
      : rows[0].raw_response;

    // If this was a dataLayers measurement, return facet polygons directly
    if (data.source === 'datalayers' && data.facets) {
      const segments = data.facets.map((f, i) => ({
        index: i,
        area_sqft: f.areaSqft || f.area_sqft || 0,
        pitch: f.pitchDegrees || f.avgSlope || 0,
        azimuth: Math.round(f.azimuth || f.avgAspect || 0),
        polygon: f.polygon || [], // actual polygon coordinates [lng, lat][]
        source: 'datalayers',
      }));
      return res.json({ segments, outline: data.outline || [], source: 'datalayers' });
    }

    const rawSegments = data.solarPotential?.roofSegmentStats || [];
    const segments = rawSegments.map((seg, i) => {
      const areaM2 = seg.stats?.areaMeters2 || 0;
      const pitchDeg = seg.pitchDegrees || 0;
      const pitchRad = (pitchDeg * Math.PI) / 180;
      const azimuth = seg.azimuthDegrees || 0;
      const bb = seg.boundingBox;
      let centerLat = seg.center?.latitude || 0;
      let centerLng = seg.center?.longitude || 0;
      let widthM = 0, depthM = 0;

      if (bb?.sw && bb?.ne) {
        const latAvg = (bb.sw.latitude + bb.ne.latitude) / 2;
        const latScale = 111320;
        const lngScale = 111320 * Math.cos((latAvg * Math.PI) / 180);
        widthM = Math.abs(bb.ne.longitude - bb.sw.longitude) * lngScale;
        depthM = Math.abs(bb.ne.latitude - bb.sw.latitude) * latScale;
        if (!centerLat) centerLat = latAvg;
        if (!centerLng) centerLng = (bb.sw.longitude + bb.ne.longitude) / 2;
      }

      // Estimate dimensions from area if bounding box unavailable
      if (widthM === 0 || depthM === 0) {
        const footprintM2 = areaM2 * Math.cos(pitchRad);
        widthM = Math.sqrt(footprintM2 * 1.5);
        depthM = footprintM2 / widthM;
      }

      // The bounding box width/depth are axis-aligned, but the roof segment is rotated
      // by azimuth. We want the segment's actual width (along ridge/eave) and depth (run).
      // For a segment facing azimuth A, the ridge runs perpendicular to A.
      // Estimate actual segment dims from area: width_along_ridge * depth_run = footprint_area
      const footprintM2 = areaM2 * Math.cos(pitchRad);
      // Use aspect ratio from bounding box but scale to match actual area
      const bbArea = widthM * depthM;
      const scale = bbArea > 0 ? Math.sqrt(footprintM2 / bbArea) : 1;
      const segWidthM = widthM * scale;
      const segDepthM = depthM * scale;

      return {
        index: i,
        area_sqft: Math.round(areaM2 * 10.7639),
        pitch: Math.round(pitchDeg * 10) / 10,
        azimuth: Math.round(azimuth),
        center: { lat: centerLat, lng: centerLng },
        width_ft: Math.round(segWidthM * 3.28084),
        depth_ft: Math.round(segDepthM * 3.28084),
        width_m: Math.round(segWidthM * 100) / 100,
        depth_m: Math.round(segDepthM * 100) / 100,
      };
    });
    res.json({ segments });
  } catch (err) { next(err); }
});

// GET /api/roof-measurement/usage
router.get('/usage', async (req, res, next) => {
  try {
    const usage = await roofMeasurementService.getUsage(req.tenantId);
    res.json(usage);
  } catch (err) { next(err); }
});

// GET /api/roof-measurement/balance
router.get('/balance', async (req, res, next) => {
  try {
    const balance = await roofMeasurementService.getBalance(req.tenantId);
    res.json(balance);
  } catch (err) { next(err); }
});

export default router;
