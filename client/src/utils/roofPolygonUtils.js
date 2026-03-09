/**
 * Roof polygon utilities: area calculation, edge classification, vertex snapping
 */

const DEG2RAD = Math.PI / 180;
const FT_PER_DEG_LAT = 111320 * 3.28084; // ~365,221 ft per degree latitude

/**
 * Convert lat/lng vertices to local XY plane in feet, centered on centroid
 */
function toLocalFt(vertices) {
  const n = vertices.length;
  if (n === 0) return { points: [], cLat: 0, cLng: 0 };
  const cLat = vertices.reduce((s, v) => s + v[1], 0) / n;
  const cLng = vertices.reduce((s, v) => s + v[0], 0) / n;
  const lngScale = FT_PER_DEG_LAT * Math.cos(cLat * DEG2RAD);
  const points = vertices.map(v => [
    (v[0] - cLng) * lngScale,
    (v[1] - cLat) * FT_PER_DEG_LAT,
  ]);
  return { points, cLat, cLng };
}

/**
 * Shoelace formula for polygon area in sq ft from [lng,lat] vertices
 */
export function polygonAreaSqFt(vertices) {
  if (vertices.length < 3) return 0;
  const { points } = toLocalFt(vertices);
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i][0] * points[j][1];
    area -= points[j][0] * points[i][1];
  }
  return Math.abs(area) / 2;
}

/**
 * True roof area accounting for pitch
 */
export function trueRoofArea(footprintSqFt, pitchDeg) {
  if (pitchDeg <= 0) return footprintSqFt;
  return footprintSqFt / Math.cos(pitchDeg * DEG2RAD);
}

/**
 * Distance between two [lng,lat] points in feet (haversine)
 */
export function haversineDistanceFt(c1, c2) {
  const R = 20902231; // Earth radius in feet
  const dLat = (c2[1] - c1[1]) * DEG2RAD;
  const dLng = (c2[0] - c1[0]) * DEG2RAD;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(c1[1] * DEG2RAD) * Math.cos(c2[1] * DEG2RAD) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Edge length between two vertices in feet
 */
function edgeLengthFt(v1, v2) {
  return haversineDistanceFt(v1, v2);
}

/**
 * Create a normalized edge key from two vertices (for shared-edge detection)
 * Rounds to ~0.3ft precision to handle snapping tolerance
 */
function edgeKey(v1, v2) {
  const round = (v) => [Math.round(v[0] * 1e6) / 1e6, Math.round(v[1] * 1e6) / 1e6];
  const a = round(v1);
  const b = round(v2);
  // Sort lexicographically so A-B == B-A
  if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) {
    return `${a[0]},${a[1]}|${b[0]},${b[1]}`;
  }
  return `${b[0]},${b[1]}|${a[0]},${a[1]}`;
}

/**
 * Classify edges across all facets.
 * Returns { edges: [{v1, v2, lengthFt, type, facetIds}], totals: {ridge, eave, rake, ...} }
 *
 * Rules:
 * - Shared edge (2 facets) → ridge (default for residential roofs)
 * - Unshared edge → eave or rake based on orientation relative to facet slope
 */
export function classifyEdges(facets) {
  // Build edge map: key → { v1, v2, facetIds[] }
  const edgeMap = new Map();

  facets.forEach((facet, fi) => {
    const verts = facet.vertices;
    for (let i = 0; i < verts.length; i++) {
      const v1 = verts[i];
      const v2 = verts[(i + 1) % verts.length];
      const key = edgeKey(v1, v2);
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { v1, v2, facetIds: [], lengthFt: edgeLengthFt(v1, v2) });
      }
      edgeMap.get(key).facetIds.push(fi);
    }
  });

  const edges = [];
  const totals = { ridge: 0, eave: 0, rake: 0, valley: 0, hip: 0, flashing: 0 };

  for (const [, edge] of edgeMap) {
    let type;
    if (edge.facetIds.length >= 2) {
      // Shared edge — default to ridge
      // Could be hip or valley, but without elevation data we default to ridge
      type = 'ridge';
    } else {
      // Unshared edge — determine eave vs rake
      // Eave = bottom edge (roughly horizontal relative to slope), Rake = side edge
      // Heuristic: compare edge angle to a horizontal reference
      // Longer unshared edges tend to be eaves, shorter tend to be rakes
      const facet = facets[edge.facetIds[0]];
      type = classifyUnsharedEdge(edge.v1, edge.v2, facet);
    }
    edge.type = type;
    edges.push(edge);
    totals[type] = (totals[type] || 0) + edge.lengthFt;
  }

  return { edges, totals };
}

/**
 * Classify an unshared edge as eave or rake.
 * Uses the edge's angle relative to the facet centroid:
 * - Edges where both vertices are on the "lower" side of the facet = eave
 * - Edges that run "up" the slope = rake
 *
 * Simple heuristic: if the edge midpoint is farther from the roof center
 * (approximated by the average of all facet centroids), it's more likely an eave.
 * For a single facet, we use edge orientation: more horizontal = eave, more vertical = rake.
 */
function classifyUnsharedEdge(v1, v2, facet) {
  // Compute edge angle relative to East (0°)
  const dx = v2[0] - v1[0];
  const dy = v2[1] - v1[1];
  const edgeAngle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Compute the facet's "slope direction" from centroid → lowest point
  // Without elevation, approximate with facet centroid to edge midpoint direction
  const verts = facet.vertices;
  const cx = verts.reduce((s, v) => s + v[0], 0) / verts.length;
  const cy = verts.reduce((s, v) => s + v[1], 0) / verts.length;
  const mx = (v1[0] + v2[0]) / 2;
  const my = (v1[1] + v2[1]) / 2;
  const toEdgeAngle = Math.atan2(my - cy, mx - cx) * (180 / Math.PI);

  // If edge is roughly perpendicular to the direction from center to edge midpoint = eave
  // If roughly parallel = rake
  let angleDiff = Math.abs(edgeAngle - toEdgeAngle) % 180;
  if (angleDiff > 90) angleDiff = 180 - angleDiff;

  // perpendicular = ~90°, parallel = ~0°
  return angleDiff > 45 ? 'eave' : 'rake';
}

/**
 * Snap a coordinate to the nearest existing vertex within threshold pixels.
 * Returns snapped coordinate or original if no snap.
 */
export function snapToVertex(coord, facets, map, thresholdPx = 10) {
  if (!map) return { snapped: coord, didSnap: false, snapTarget: null };

  const point = map.project(coord);
  let closest = null;
  let closestDist = Infinity;

  facets.forEach((facet, fi) => {
    facet.vertices.forEach((v, vi) => {
      const vPoint = map.project(v);
      const dx = point.x - vPoint.x;
      const dy = point.y - vPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist && dist < thresholdPx) {
        closestDist = dist;
        closest = { coord: v, facetIndex: fi, vertexIndex: vi };
      }
    });
  });

  if (closest) {
    return { snapped: closest.coord, didSnap: true, snapTarget: closest };
  }
  return { snapped: coord, didSnap: false, snapTarget: null };
}

/**
 * Check if a click is near the first vertex of the active polygon (to close it)
 */
export function isNearFirstVertex(coord, firstVertex, map, thresholdPx = 12) {
  if (!map || !firstVertex) return false;
  const p1 = map.project(coord);
  const p2 = map.project(firstVertex);
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy) < thresholdPx;
}

/**
 * Get polygon centroid [lng, lat]
 */
export function polygonCentroid(vertices) {
  const n = vertices.length;
  if (n === 0) return [0, 0];
  return [
    vertices.reduce((s, v) => s + v[0], 0) / n,
    vertices.reduce((s, v) => s + v[1], 0) / n,
  ];
}
