import { contours } from 'd3-contour';
import * as turf from '@turf/turf';
import logger from '../utils/logger.js';

/**
 * Convert a gridded hail-size raster into GeoJSON polygon features at given thresholds.
 *
 * @param {{ width: number, height: number, values: Float32Array, bbox: { west, south, east, north } }} grid
 * @param {number[]} thresholds - hail size breakpoints in inches (e.g. [1.0, 1.5, 2.0])
 * @returns {object[]} Array of GeoJSON Feature objects with hail_size_max_in property
 */
export function buildContours(grid, thresholds = [1.0, 1.5, 2.0]) {
  const { width, height, values, bbox } = grid;

  if (!width || !height || !values || values.length === 0) {
    logger.warn('Empty grid, returning no contours');
    return [];
  }

  // d3-contour operates in pixel space — generate contour polygons
  const contourGenerator = contours().size([width, height]).thresholds(thresholds);

  const multiPolygons = contourGenerator(values);
  const features = [];

  // Scale factors: convert pixel coords to geographic coords
  const xScale = (bbox.east - bbox.west) / width;
  const yScale = (bbox.north - bbox.south) / height;

  for (const mp of multiPolygons) {
    if (!mp.coordinates || mp.coordinates.length === 0) continue;

    // Transform pixel coordinates to lon/lat
    const transformed = mp.coordinates.map((polygon) =>
      polygon.map((ring) =>
        ring.map(([px, py]) => [
          bbox.west + px * xScale,
          // d3 contour y=0 is top, geo y=0 is south — flip
          bbox.north - py * yScale,
        ])
      )
    );

    let feature = {
      type: 'Feature',
      geometry: {
        type: mp.type, // MultiPolygon
        coordinates: transformed,
      },
      properties: {
        hail_size_max_in: mp.value,
      },
    };

    // Simplify geometry to reduce payload size
    try {
      feature = turf.simplify(feature, { tolerance: 0.005, highQuality: true });
      feature.properties.hail_size_max_in = mp.value;
    } catch (err) {
      logger.warn({ err }, 'Simplification failed, using raw geometry');
    }

    features.push(feature);
  }

  logger.info(`Built ${features.length} contour features from ${thresholds.length} thresholds`);
  return features;
}
