import logger from '../utils/logger.js';

/**
 * Census ACS on-demand proxy.
 * Fetches median year built and owner-occupancy rate by lat/lng.
 * Two-step: (1) reverse-geocode to Census tract, (2) query ACS 5-year data.
 * Free, no API key required. 24hr in-memory cache.
 */

const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_CACHE = 500;

function getCacheKey(lat, lng) {
  return `${lat.toFixed(2)}:${lng.toFixed(2)}`;
}

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
 * Get Census tract FIPS codes for a lat/lng via Census Geocoder.
 */
async function getTractFips(lat, lng) {
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Census geocoder returned ${res.status}`);
  const json = await res.json();
  const tract = json.result?.geographies?.['Census Tracts']?.[0];
  if (!tract) return null;
  return { state: tract.STATE, county: tract.COUNTY, tract: tract.TRACT, countyName: tract.BASENAME };
}

/**
 * Get ACS 5-year data for a Census tract.
 * B25035_001E = Median year structure built
 * B25003_002E = Owner-occupied housing units
 * B25003_001E = Total occupied housing units
 */
async function getAcsData(state, county, tract) {
  const url = `https://api.census.gov/data/2022/acs/acs5?get=B25035_001E,B25003_002E,B25003_001E&for=tract:${tract}&in=state:${state}&in=county:${county}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Census ACS returned ${res.status}`);
  const json = await res.json();
  if (!json || json.length < 2) return null;
  const row = json[1];
  const medianYearBuilt = parseInt(row[0]) || null;
  const ownerOccupied = parseInt(row[1]) || 0;
  const totalOccupied = parseInt(row[2]) || 0;
  return {
    medianYearBuilt,
    ownerOccupied,
    totalOccupied,
    ownerOccupiedRate: totalOccupied > 0 ? ownerOccupied / totalOccupied : null,
  };
}

/**
 * Get Census ACS demographics for a location. Primary public API.
 * Returns: { medianYearBuilt, homeAge, ownerOccupiedRate, countyName }
 */
export async function getCensusProfile(lat, lng) {
  evictExpired();

  const key = getCacheKey(lat, lng);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const fips = await getTractFips(lat, lng);
  if (!fips) return null;

  const acs = await getAcsData(fips.state, fips.county, fips.tract);
  if (!acs) return null;

  const currentYear = new Date().getFullYear();
  const result = {
    medianYearBuilt: acs.medianYearBuilt,
    homeAge: acs.medianYearBuilt ? currentYear - acs.medianYearBuilt : null,
    ownerOccupiedRate: acs.ownerOccupiedRate,
    countyName: fips.countyName,
    stateFips: fips.state,
    countyFips: fips.county,
  };

  cache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL });
  return result;
}
