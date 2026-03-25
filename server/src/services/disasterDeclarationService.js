import logger from '../utils/logger.js';

const OPENFEMA_BASE = 'https://www.fema.gov/api/open/v2';

// In-memory cache to avoid hammering the free API
// Key: "state:county" or "fips", Value: { data, fetchedAt }
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(state, county) {
  return `${state.toUpperCase()}:${county.toUpperCase()}`;
}

function isStale(entry) {
  return !entry || Date.now() - entry.fetchedAt > CACHE_TTL_MS;
}

/**
 * Fetch disaster declarations for a county from OpenFEMA API (free, no auth needed)
 * Returns: { declarations: [...], summary: { total, byType, byYear, recentCount } }
 */
export async function getDisasterDeclarations(state, county) {
  const key = getCacheKey(state, county);
  const cached = cache.get(key);
  if (cached && !isStale(cached)) return cached.data;

  try {
    // OpenFEMA DisasterDeclarationsSummaries endpoint — free, no API key
    const params = new URLSearchParams({
      $filter: `state eq '${state.toUpperCase()}' and designatedArea eq '${titleCase(county)} (County)'`,
      $select: 'disasterNumber,declarationDate,incidentType,declarationTitle,incidentBeginDate,incidentEndDate,designatedArea,fyDeclared',
      $orderby: 'declarationDate desc',
      $top: '200',
    });

    const url = `${OPENFEMA_BASE}/DisasterDeclarationsSummaries?${params}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`OpenFEMA API returned ${res.status}`);
    }

    const json = await res.json();
    const declarations = (json.DisasterDeclarationsSummaries || []).map(d => ({
      disasterNumber: d.disasterNumber,
      declarationDate: d.declarationDate,
      incidentType: d.incidentType,
      title: d.declarationTitle,
      incidentBegin: d.incidentBeginDate,
      incidentEnd: d.incidentEndDate,
      area: d.designatedArea,
      fiscalYear: d.fyDeclared,
    }));

    // Deduplicate by disaster number (same disaster can have multiple program declarations)
    const seen = new Set();
    const unique = declarations.filter(d => {
      if (seen.has(d.disasterNumber)) return false;
      seen.add(d.disasterNumber);
      return true;
    });

    // Build summary
    const byType = {};
    const byYear = {};
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    let recentCount = 0;

    for (const d of unique) {
      byType[d.incidentType] = (byType[d.incidentType] || 0) + 1;
      const year = d.fiscalYear || new Date(d.declarationDate).getFullYear();
      byYear[year] = (byYear[year] || 0) + 1;
      if (new Date(d.declarationDate) >= fiveYearsAgo) recentCount++;
    }

    const result = {
      declarations: unique,
      summary: {
        total: unique.length,
        recentCount,
        byType,
        byYear,
      },
    };

    cache.set(key, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    logger.error({ err, state, county }, 'Failed to fetch disaster declarations');
    // Return empty on failure, don't break the UI
    return { declarations: [], summary: { total: 0, recentCount: 0, byType: {}, byYear: {} } };
  }
}

/**
 * Get a "risk score" for a county based on disaster declaration frequency
 * Returns 0-100 scale
 */
export function computeCountyRiskScore(summary) {
  if (!summary || summary.total === 0) return 0;

  let score = 0;

  // Base: total declarations (capped at 50 for max contribution)
  score += Math.min(summary.total, 50) * 0.6; // max 30 pts

  // Recency: recent declarations weighted more
  score += Math.min(summary.recentCount, 15) * 2; // max 30 pts

  // Frequency of severe weather types
  const severeTypes = ['Severe Storm(s)', 'Hurricane', 'Tornado', 'Severe Ice Storm'];
  const severeCount = severeTypes.reduce((sum, t) => sum + (summary.byType[t] || 0), 0);
  score += Math.min(severeCount, 20) * 2; // max 40 pts

  return Math.min(Math.round(score), 100);
}

function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
