import logger from '../utils/logger.js';

/**
 * Census Geocoder Service — free address geocoding, no API key required.
 * Replaces Google Geocoding API for server-side geocoding.
 *
 * Single address: https://geocoding.geo.census.gov/geocoder/locations/onelineaddress
 * Batch (up to 10,000): https://geocoding.geo.census.gov/geocoder/locations/addressbatch
 *
 * Returns lat/lng coordinates from US Census TIGER database.
 */

const BASE = 'https://geocoding.geo.census.gov/geocoder';

const STATE_ABBRS = {
  'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA',
  'colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA',
  'hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS',
  'kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA',
  'michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT',
  'nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM',
  'new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK',
  'oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC',
  'south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT',
  'virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY',
  'district of columbia':'DC',
};

// In-memory cache for single lookups
const cache = new Map();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days (addresses don't move)
const MAX_CACHE = 1000;

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
 * Geocode a single address. Returns { lat, lng, matchedAddress } or null.
 */
export async function geocodeAddress(address, city, state, zip) {
  const oneline = [address, city, state, zip].filter(Boolean).join(', ');
  if (!oneline.trim()) return null;

  evictExpired();
  const cacheKey = oneline.toLowerCase().trim();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const params = new URLSearchParams({
      address: oneline,
      benchmark: 'Public_AR_Current',
      format: 'json',
    });

    const res = await fetch(`${BASE}/locations/onelineaddress?${params}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`Census geocoder returned ${res.status}`);
    const json = await res.json();

    const match = json.result?.addressMatches?.[0];
    if (!match) {
      cache.set(cacheKey, { data: null, expiresAt: Date.now() + CACHE_TTL });
      return null;
    }

    const result = {
      lat: match.coordinates.y,
      lng: match.coordinates.x,
      matchedAddress: match.matchedAddress,
      tigerLineId: match.tigerLine?.tigerLineId,
      state: match.addressComponents?.state,
      county: match.geographies?.Counties?.[0]?.BASENAME || null,
    };

    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
    return result;
  } catch (err) {
    logger.warn({ err, address: oneline }, 'Census geocoding failed');
    return null;
  }
}

/**
 * Reverse geocode: lat/lng → address. Returns { address, city, state, zip } or null.
 */
export async function reverseGeocode(lat, lng) {
  const cacheKey = `rev:${lat.toFixed(5)}:${lng.toFixed(5)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const params = new URLSearchParams({
      x: String(lng),
      y: String(lat),
      benchmark: 'Public_AR_Current',
      vintage: 'Current_Current',
      format: 'json',
    });

    const res = await fetch(`${BASE}/geographies/coordinates?${params}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`Census reverse geocoder returned ${res.status}`);
    const json = await res.json();

    // Census coordinate lookup returns geography info but not a street address.
    // Use the FCC Area API as a fallback for a rough address, or return geography data.
    const tract = json.result?.geographies?.['Census Tracts']?.[0];
    const county = json.result?.geographies?.['Counties']?.[0];

    if (!tract && !county) {
      cache.set(cacheKey, { data: null, expiresAt: Date.now() + CACHE_TTL });
      return null;
    }

    // Census doesn't provide street-level reverse geocoding.
    // Use the free Nominatim (OpenStreetMap) reverse geocoder instead.
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: { 'User-Agent': 'StormLeads/1.0' },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!nomRes.ok) throw new Error(`Nominatim returned ${nomRes.status}`);
    const nom = await nomRes.json();

    const addr = nom.address || {};
    const streetNum = addr.house_number || '';
    const route = addr.road || '';
    const street = [streetNum, route].filter(Boolean).join(' ');

    // Nominatim uses different keys for city depending on area type
    const city = addr.city || addr.town || addr.village || addr.hamlet
      || addr.municipality || addr.suburb || addr.neighbourhood
      || (addr.county ? addr.county.replace(/ County$/, '') : '') || '';

    // Map full state name to abbreviation
    const stateAbbr = STATE_ABBRS[addr.state?.toLowerCase()] || addr['ISO3166-2-lvl4']?.replace('US-', '') || addr.state || '';

    const result = {
      address: street || nom.display_name?.split(',')[0] || '',
      city,
      state: stateAbbr,
      zip: addr.postcode || '',
      county: county?.BASENAME || addr.county?.replace(/ County$/, '') || '',
      display: nom.display_name || '',
    };

    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
    return result;
  } catch (err) {
    logger.warn({ err, lat, lng }, 'Reverse geocoding failed');
    return null;
  }
}

/**
 * Batch geocode up to 10,000 addresses via Census batch API.
 * Input: array of { id, address, city, state, zip }
 * Returns: Map<id, { lat, lng, matchedAddress }>
 *
 * The batch API accepts a CSV file upload.
 */
export async function batchGeocode(addresses) {
  if (!addresses.length) return new Map();

  // Census batch API accepts CSV: id, street, city, state, zip
  const csvLines = addresses.map(a =>
    `"${a.id}","${(a.address || '').replace(/"/g, '""')}","${(a.city || '').replace(/"/g, '""')}","${(a.state || '').replace(/"/g, '""')}","${(a.zip || '').replace(/"/g, '""')}"`
  );
  const csvContent = csvLines.join('\n');

  // Census batch limit is 10,000 per request
  const results = new Map();
  const chunks = [];
  for (let i = 0; i < csvLines.length; i += 10000) {
    chunks.push(csvLines.slice(i, i + 10000).join('\n'));
  }

  for (const chunk of chunks) {
    try {
      const formData = new FormData();
      formData.append('addressFile', new Blob([chunk], { type: 'text/csv' }), 'addresses.csv');
      formData.append('benchmark', 'Public_AR_Current');

      const res = await fetch(`${BASE}/locations/addressbatch`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(120000), // 2 min for batch
      });

      if (!res.ok) {
        logger.error({ status: res.status }, 'Census batch geocode failed');
        continue;
      }

      const text = await res.text();
      // Response is CSV: id, input address, match indicator, match type, matched address, lng/lat, tiger line id, side
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        // Parse CSV carefully — fields may be quoted
        const fields = parseCSVLine(line);
        if (fields.length < 6) continue;

        const id = fields[0]?.replace(/"/g, '').trim();
        const matchIndicator = fields[2]?.replace(/"/g, '').trim();

        if (matchIndicator === 'Match' || matchIndicator === 'Non_Match') {
          if (matchIndicator === 'Match') {
            const matchedAddr = fields[4]?.replace(/"/g, '').trim();
            const coords = fields[5]?.replace(/"/g, '').trim();
            if (coords) {
              const [lng, lat] = coords.split(',').map(Number);
              if (!isNaN(lat) && !isNaN(lng)) {
                results.set(id, { lat, lng, matchedAddress: matchedAddr });
              }
            }
          }
          // Non_Match: id exists but no result — leave out of results map
        }
      }
    } catch (err) {
      logger.error({ err }, 'Census batch geocode request failed');
    }
  }

  logger.info({ total: addresses.length, matched: results.size }, 'Census batch geocode complete');
  return results;
}

/**
 * Simple CSV line parser that handles quoted fields.
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}
