/**
 * On-demand storm history proxy via NOAA Storm Events API.
 * Fetches historical severe weather events near a given location.
 * NO bulk data import — queries NOAA API at runtime and caches briefly in memory.
 *
 * Data source: https://www.ncdc.noaa.gov/stormevents/
 * API: NOAA SWDI (Severe Weather Data Inventory) — free, public, no API key needed
 * Also uses: NOAA Storm Events CSV FTP (via NCEI web service)
 */

const SWDI_BASE = 'https://www.ncei.noaa.gov/swdiws';

// In-memory cache: key -> { data, expiresAt }
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (historical data doesn't change)
const MAX_CACHE_ENTRIES = 500;

function getCacheKey(lat, lng, radiusMiles, eventType) {
  // Round to 2 decimal places to improve cache hit rates (~1km precision)
  return `${lat.toFixed(2)}:${lng.toFixed(2)}:${radiusMiles}:${eventType}`;
}

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt < now) cache.delete(key);
  }
  // Hard cap to prevent memory bloat
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (let i = 0; i < oldest.length - MAX_CACHE_ENTRIES; i++) {
      cache.delete(oldest[i][0]);
    }
  }
}

/**
 * Fetch hail events near a location from NOAA SWDI.
 * SWDI supports: hail, wind (meso-vortex), tornado (shear), nldn (lightning)
 */
async function fetchSWDIEvents(lat, lng, radiusMiles, eventType = 'hail', startYear, endYear) {
  // SWDI endpoint: /swdiws/{format}/{dataset}/{startDate}:{endDate}/{params}
  // Dataset: nx3hail (MESH hail), nx3tvs (tornado vortex signatures), nx3meso (mesocyclone), nldn (lightning)
  const datasetMap = {
    hail: 'nx3hail',
    tornado: 'nx3tvs',
    wind: 'nx3meso',
  };
  const dataset = datasetMap[eventType] || 'nx3hail';
  const start = `${startYear}0101`;
  const end = `${endYear}1231`;

  // SWDI uses a bounding box or point+radius. Point+radius via "ext" parameter.
  const url = `${SWDI_BASE}/json/${dataset}/${start}:${end}?stat=tilesum:${lng},${lat}&radius=${radiusMiles * 1.60934}&limit=500`;

  const resp = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    throw new Error(`SWDI API returned ${resp.status}`);
  }

  return resp.json();
}

/**
 * Fetch storm events from NOAA Storm Events database (NCEI).
 * Uses the bulk data search API endpoint.
 */
async function fetchStormEventsNcei(lat, lng, radiusMiles, startYear, endYear) {
  // Use the NOAA Storm Events web service — search by lat/lng with radius
  // This is the same data behind https://www.ncdc.noaa.gov/stormevents/
  const url = `https://www.ncdc.noaa.gov/stormevents/csv?eventType=ALL` +
    `&beginDate_mm=01&beginDate_dd=01&beginDate_yyyy=${startYear}` +
    `&endDate_mm=12&endDate_dd=31&endDate_yyyy=${endYear}` +
    `&county=ALL&state=ALL` +
    `&hailfilter=0.00&tornfilter=0&windfilter=000` +
    `&sort=DT&submitbutton=Search&staession=Search`;

  // This CSV endpoint isn't reliably JSON-parseable, so we'll use SWDI instead
  // and supplement with our own storm_events table for recent data
  return null;
}

/**
 * Get storm history for a location. Primary public API.
 * Returns summarized storm history from NOAA SWDI + our own storm_events DB.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radiusMiles - Search radius in miles (default 5)
 * @param {number} years - How many years back to search (default 5)
 */
/**
 * Fetch hail events within a bounding box for heat map display.
 * SWDI bbox queries are limited to 31 days, so we query each year's storm season
 * (March-June) in parallel. Returns array of { lat, lng, weight } points.
 */
export async function getHailHeatmapData(west, south, east, north, years = 10) {
  const cacheKey = `heatmap:${west.toFixed(1)}:${south.toFixed(1)}:${east.toFixed(1)}:${north.toFixed(1)}:${years}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  evictExpired();

  const endYear = new Date().getFullYear();
  const startYear = endYear - Math.min(years, 10);

  // SWDI bbox queries are limited to 31 days. Query peak hail months (Mar-Jun) per year.
  // Use 2-month windows to reduce API calls: Mar-Apr and May-Jun per year.
  const windows = [];
  for (let y = startYear; y <= endYear; y++) {
    windows.push({ start: `${y}0301`, end: `${y}0401` });
    windows.push({ start: `${y}0401`, end: `${y}0501` });
    windows.push({ start: `${y}0501`, end: `${y}0601` });
  }

  // Fetch all windows in parallel
  const allPoints = [];
  const results = await Promise.allSettled(
    windows.map(async (w) => {
      const url = `${SWDI_BASE}/json/nx3hail/${w.start}:${w.end}?bbox=${west},${south},${east},${north}&limit=500`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      const items = data.swdiJsonResponse?.result || data.result || [];
      return items
        .filter(item => item.SHAPE || (item.LAT && item.LON))
        .map(item => {
          let lat, lng;
          if (item.SHAPE) {
            const m = item.SHAPE.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/);
            if (m) { lng = parseFloat(m[1]); lat = parseFloat(m[2]); }
          }
          if (!lat) { lat = parseFloat(item.LAT); lng = parseFloat(item.LON); }
          return { lat, lng, weight: parseFloat(item.MAXSIZE || item.MAX_SIZE || 1) };
        })
        .filter(p => !isNaN(p.lat) && !isNaN(p.lng));
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.length) allPoints.push(...r.value);
  }

  cache.set(cacheKey, { data: allPoints, expiresAt: Date.now() + CACHE_TTL });
  return allPoints;
}

export async function getStormHistory(lat, lng, radiusMiles = 5, years = 5) {
  evictExpired();

  const cacheKey = getCacheKey(lat, lng, radiusMiles, 'all');
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const endYear = new Date().getFullYear();
  const startYear = endYear - years;

  // Fetch hail and tornado data in parallel from SWDI
  const [hailResult, tornadoResult] = await Promise.allSettled([
    fetchSWDIEvents(lat, lng, radiusMiles, 'hail', startYear, endYear),
    fetchSWDIEvents(lat, lng, radiusMiles, 'tornado', startYear, endYear),
  ]);

  const hailEvents = hailResult.status === 'fulfilled' ? parseSWDIResponse(hailResult.value, 'hail') : [];
  const tornadoEvents = tornadoResult.status === 'fulfilled' ? parseSWDIResponse(tornadoResult.value, 'tornado') : [];

  const allEvents = [...hailEvents, ...tornadoEvents]
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Build summary
  const summary = buildSummary(allEvents, years);

  const result = {
    location: { lat, lng },
    radiusMiles,
    yearsSearched: years,
    events: allEvents.slice(0, 100), // Cap at 100 most recent
    summary,
  };

  cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
  return result;
}

function parseSWDIResponse(data, eventType) {
  if (!data || !Array.isArray(data.result)) return [];

  return data.result.map(item => ({
    date: item.ZTIME || item.ztime || item.WSR_ID || null,
    type: eventType,
    maxSize: item.MAX_SIZE || item.MAXSIZE || null, // hail size in inches
    severity: item.CELL_ID ? 'detected' : 'unknown',
    lat: item.LAT || item.lat,
    lng: item.LON || item.lon,
    raw: item,
  })).filter(e => e.date);
}

function buildSummary(events, years) {
  const hailEvents = events.filter(e => e.type === 'hail');
  const tornadoEvents = events.filter(e => e.type === 'tornado');

  // Group by year
  const byYear = {};
  for (const e of events) {
    const year = new Date(e.date).getFullYear();
    if (!isNaN(year)) {
      byYear[year] = (byYear[year] || 0) + 1;
    }
  }

  // Max hail size
  const maxHailSize = hailEvents.reduce((max, e) => {
    const size = parseFloat(e.maxSize);
    return !isNaN(size) && size > max ? size : max;
  }, 0);

  // Risk classification
  const totalEvents = events.length;
  const annualAvg = totalEvents / Math.max(years, 1);
  let riskLevel = 'low';
  if (annualAvg >= 10 || maxHailSize >= 2) riskLevel = 'extreme';
  else if (annualAvg >= 5 || maxHailSize >= 1.5) riskLevel = 'high';
  else if (annualAvg >= 2 || maxHailSize >= 1) riskLevel = 'moderate';

  return {
    totalEvents,
    hailCount: hailEvents.length,
    tornadoCount: tornadoEvents.length,
    maxHailSizeInches: maxHailSize,
    averageEventsPerYear: Math.round(annualAvg * 10) / 10,
    riskLevel,
    byYear,
  };
}
