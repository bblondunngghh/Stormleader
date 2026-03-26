import logger from '../utils/logger.js';

/**
 * FEMA Housing Assistance API — damage application density by ZIP code.
 * Free, no API key. Shows how many homeowners in a ZIP applied for FEMA
 * disaster assistance, how much damage was inspected, and how much was approved.
 * Useful for identifying areas with repeated storm damage claims.
 */

const BASE = 'https://www.fema.gov/api/open/v2/HousingAssistanceOwners';

const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_CACHE = 200;

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
 * Get FEMA housing assistance data for a ZIP code.
 * Returns aggregated stats across all disasters for that ZIP.
 */
export async function getHousingAssistance(zipCode) {
  if (!zipCode || zipCode.length < 5) return null;
  const zip = zipCode.substring(0, 5);

  evictExpired();
  const cached = cache.get(zip);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const params = new URLSearchParams({
      '$filter': `zipCode eq '${zip}'`,
      '$select': 'disasterNumber,zipCode,city,state,county,validRegistrations,totalInspected,totalDamage,totalApprovedIhpAmount,approvedForFemaAssistance,averageFemaInspectedDamage',
    });

    const res = await fetch(`${BASE}?${params}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`FEMA Housing API returned ${res.status}`);
    const json = await res.json();
    const records = json.HousingAssistanceOwners || [];

    if (records.length === 0) {
      cache.set(zip, { data: null, expiresAt: Date.now() + CACHE_TTL });
      return null;
    }

    // Aggregate across all disasters
    const totalRegistrations = records.reduce((sum, r) => sum + (r.validRegistrations || 0), 0);
    const totalInspected = records.reduce((sum, r) => sum + (r.totalInspected || 0), 0);
    const totalDamage = records.reduce((sum, r) => sum + (r.totalDamage || 0), 0);
    const totalApproved = records.reduce((sum, r) => sum + (r.totalApprovedIhpAmount || 0), 0);
    const totalApprovedCount = records.reduce((sum, r) => sum + (r.approvedForFemaAssistance || 0), 0);

    const result = {
      zipCode: zip,
      city: records[0].city,
      state: records[0].state,
      county: records[0].county?.replace(' (County)', ''),
      disasterCount: records.length,
      totalRegistrations,
      totalInspected,
      totalDamage: Math.round(totalDamage),
      totalApproved: Math.round(totalApproved),
      totalApprovedCount,
      avgDamagePerInspection: totalInspected > 0 ? Math.round(totalDamage / totalInspected) : 0,
      // Density score: how claim-heavy is this ZIP? (0-100)
      claimDensityScore: Math.min(100, Math.round(
        Math.min(totalRegistrations, 500) * 0.1 +
        Math.min(records.length, 20) * 2 +
        (totalDamage > 1000000 ? 20 : totalDamage > 100000 ? 10 : 0)
      )),
    };

    cache.set(zip, { data: result, expiresAt: Date.now() + CACHE_TTL });
    return result;
  } catch (err) {
    logger.warn({ err, zipCode: zip }, 'FEMA Housing Assistance API failed');
    return null;
  }
}
