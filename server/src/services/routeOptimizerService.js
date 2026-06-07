import logger from '../utils/logger.js';

/**
 * OSRM Route Optimizer — free routing for canvassing route optimization.
 * Uses the public OSRM demo server (router.project-osrm.org).
 * No API key required. Rate-limited but fine for on-demand use.
 *
 * For production, self-host OSRM with: docker run -t -v data:/data osrm/osrm-backend
 */

const OSRM_BASE = 'https://router.project-osrm.org';

const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE = 100;

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt < now) cache.delete(key);
  }
  if (cache.size > MAX_CACHE) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (let i = 0; i < oldest.length - MAX_CACHE; i++) cache.delete(oldest[i][0]);
  }
}

/**
 * Optimize a route through a list of addresses/coordinates.
 * Uses OSRM's trip service for TSP (traveling salesman) optimization.
 *
 * @param {Array<{lat: number, lng: number, id?: string, address?: string}>} stops
 * @returns {{ distance, duration, orderedStops, geometry }}
 */
export async function optimizeRoute(stops) {
  if (!stops || stops.length < 2) return null;
  if (stops.length > 100) {
    return { error: 'Maximum 100 stops per route' };
  }

  const invalid = stops.some(s => !s || !Number.isFinite(Number(s.lat)) || !Number.isFinite(Number(s.lng)));
  if (invalid) return { error: 'Each stop must include numeric lat and lng' };

  evictExpired();

  // Build coordinate string: lng,lat;lng,lat;...
  const coords = stops.map(s => `${s.lng},${s.lat}`).join(';');
  const cacheKey = coords;

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    // Use trip endpoint for TSP optimization (best order to visit all stops)
    const url = `${OSRM_BASE}/trip/v1/driving/${coords}?source=first&roundtrip=false&geometries=geojson&overview=full&steps=false`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`OSRM returned ${res.status}`);
    const data = await res.json();

    if (data.code !== 'Ok' || !data.trips?.length) {
      return { error: data.message || 'Route optimization failed' };
    }

    const trip = data.trips[0];
    const waypoints = data.waypoints || [];

    // Map waypoints back to original stops in optimized order
    const orderedStops = waypoints
      .sort((a, b) => a.waypoint_index - b.waypoint_index)
      .map(wp => {
        const originalIdx = wp.trips_index !== undefined ? wp.waypoint_index : 0;
        const stop = stops[waypoints.indexOf(wp)];
        return {
          ...stop,
          waypointIndex: wp.waypoint_index,
          snappedLat: wp.location[1],
          snappedLng: wp.location[0],
          distanceFromRoad: wp.distance,
        };
      });

    const result = {
      distance: Math.round(trip.distance), // meters
      distanceMiles: Math.round(trip.distance * 0.000621371 * 10) / 10,
      duration: Math.round(trip.duration), // seconds
      durationMinutes: Math.round(trip.duration / 60),
      geometry: trip.geometry, // GeoJSON LineString
      orderedStops,
      stopCount: stops.length,
    };

    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
    return result;
  } catch (err) {
    logger.warn({ err, stopCount: stops.length }, 'OSRM route optimization failed');
    return { error: 'Route optimization unavailable' };
  }
}

/**
 * Get driving directions between two points.
 */
export async function getDirections(fromLat, fromLng, toLat, toLng) {
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=true`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`OSRM returned ${res.status}`);
    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes?.length) return null;

    const route = data.routes[0];
    return {
      distance: Math.round(route.distance),
      distanceMiles: Math.round(route.distance * 0.000621371 * 10) / 10,
      duration: Math.round(route.duration),
      durationMinutes: Math.round(route.duration / 60),
      geometry: route.geometry,
      steps: route.legs?.[0]?.steps?.map(s => ({
        instruction: s.maneuver?.type + (s.maneuver?.modifier ? ` ${s.maneuver.modifier}` : ''),
        name: s.name,
        distance: Math.round(s.distance),
        duration: Math.round(s.duration),
      })),
    };
  } catch (err) {
    logger.warn({ err }, 'OSRM directions failed');
    return null;
  }
}
