import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { getStormHistory } from './stormHistoryService.js';
import { getDisasterDeclarations, computeCountyRiskScore } from './disasterDeclarationService.js';
import { getCensusProfile } from './censusAcsService.js';

/**
 * Lead Scoring Algorithm
 *
 * Computes a 0-100 score based on multiple factors:
 * - Storm damage severity (hail size, wind speed) — 25 pts
 * - Hail risk history (NOAA SWDI 10yr frequency) — 15 pts
 * - Property value (assessed value, roof sqft) — 15 pts
 * - Recency of storm event — 20 pts
 * - Activity engagement (recent contact, follow-ups) — 15 pts
 * - Property data completeness (FEMA data, year built) — 10 pts
 */

const WEIGHTS = {
  stormDamage: 20,    // max 20 points — current storm severity
  hailRisk: 15,       // max 15 points — NOAA SWDI 10yr history
  disasterZone: 10,   // max 10 points — FEMA disaster declarations
  propertyProfile: 15, // max 15 points — value + Census ACS (age, ownership)
  recency: 15,        // max 15 points — how recent the storm event is
  engagement: 15,     // max 15 points — contact info, activity, follow-ups
  dataQuality: 10,    // max 10 points — completeness of lead data
};

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function computeScoreFromFactors(factors) {
  let score = 0;

  // --- Storm Damage (0-20) ---
  let stormScore = 0;
  if (factors.hailSizeIn) {
    if (factors.hailSizeIn >= 4) stormScore = 20;
    else if (factors.hailSizeIn >= 3) stormScore = 16;
    else if (factors.hailSizeIn >= 2) stormScore = 10;
    else if (factors.hailSizeIn >= 1) stormScore = 5;
    else stormScore = 2;
  }
  if (factors.windSpeedMph) {
    const windBonus = factors.windSpeedMph >= 80 ? 6 : factors.windSpeedMph >= 60 ? 3 : 0;
    stormScore = Math.min(20, stormScore + windBonus);
  }
  score += stormScore;
  factors.stormDamageScore = stormScore;

  // --- Hail Risk History (0-15) — NOAA SWDI 10yr data ---
  let hailRiskScore = 0;
  if (factors.hailRiskLevel) {
    if (factors.hailRiskLevel === 'extreme') hailRiskScore = 15;
    else if (factors.hailRiskLevel === 'high') hailRiskScore = 12;
    else if (factors.hailRiskLevel === 'moderate') hailRiskScore = 7;
    else if (factors.hailRiskLevel === 'low') hailRiskScore = 2;
  }
  if (factors.maxHistoricalHailIn >= 2) hailRiskScore = Math.min(15, hailRiskScore + 3);
  else if (factors.maxHistoricalHailIn >= 1.5) hailRiskScore = Math.min(15, hailRiskScore + 1);
  score += hailRiskScore;
  factors.hailRiskScore = hailRiskScore;

  // --- FEMA Disaster Zone (0-10) ---
  let disasterScore = 0;
  if (factors.femaRiskScore != null) {
    // femaRiskScore is 0-100 from computeCountyRiskScore, scale to 0-10
    disasterScore = Math.round(factors.femaRiskScore / 10);
  }
  score += disasterScore;
  factors.disasterZoneScore = disasterScore;

  // --- Property Profile (0-15) — value + Census ACS home age/ownership ---
  let propScore = 0;
  const val = factors.assessedValue || 0;
  const sqft = factors.roofSqft || 0;
  // Property value: 0-8 points
  if (val >= 600000) propScore = 8;
  else if (val >= 400000) propScore = 6;
  else if (val >= 200000) propScore = 4;
  else if (val >= 100000) propScore = 2;
  else if (sqft >= 2000) propScore = 6;
  else if (sqft >= 1000) propScore = 3;
  // Home age bonus: older homes = more likely roof damage (0-4 points)
  if (factors.homeAge >= 30) propScore += 4;
  else if (factors.homeAge >= 20) propScore += 3;
  else if (factors.homeAge >= 10) propScore += 2;
  else if (factors.homeAge > 0) propScore += 1;
  // Owner-occupied bonus (0-3 points) — owners more likely to repair than landlords
  if (factors.ownerOccupiedRate >= 0.7) propScore += 3;
  else if (factors.ownerOccupiedRate >= 0.5) propScore += 2;
  else if (factors.ownerOccupiedRate > 0) propScore += 1;
  propScore = Math.min(15, propScore);
  score += propScore;
  factors.propertyProfileScore = propScore;

  // --- Recency (0-15) ---
  let recencyScore = 0;
  if (factors.daysSinceStorm != null) {
    if (factors.daysSinceStorm <= 1) recencyScore = 15;
    else if (factors.daysSinceStorm <= 3) recencyScore = 13;
    else if (factors.daysSinceStorm <= 7) recencyScore = 10;
    else if (factors.daysSinceStorm <= 14) recencyScore = 7;
    else if (factors.daysSinceStorm <= 30) recencyScore = 4;
    else recencyScore = 2;
  }
  score += recencyScore;
  factors.recencyScore = recencyScore;

  // --- Engagement (0-15) ---
  let engagementScore = 0;
  // Has contact info
  if (factors.hasPhone) engagementScore += 3;
  if (factors.hasEmail) engagementScore += 2;
  // Recent activity count (more touches = warmer lead)
  if (factors.recentActivityCount >= 5) engagementScore += 5;
  else if (factors.recentActivityCount >= 3) engagementScore += 3;
  else if (factors.recentActivityCount >= 1) engagementScore += 1;
  // Has upcoming follow-up scheduled
  if (factors.hasUpcomingFollowUp) engagementScore += 3;
  // Has insurance info
  if (factors.hasInsurance) engagementScore += 2;
  engagementScore = Math.min(15, engagementScore);
  score += engagementScore;
  factors.engagementScore = engagementScore;

  // --- Data Quality (0-10) ---
  let dataScore = 0;
  if (factors.hasAddress) dataScore += 2;
  if (factors.hasFemaData) dataScore += 2;
  if (factors.hasYearBuilt) dataScore += 1;
  if (factors.hasRoofType) dataScore += 1;
  if (factors.hasOwnerInfo) dataScore += 2;
  if (factors.hasEstimate) dataScore += 2;
  dataScore = Math.min(10, dataScore);
  score += dataScore;
  factors.dataQualityScore = dataScore;

  return { score: clamp(score, 0, 100), factors };
}

/**
 * Score a single lead by ID
 */
export async function scoreLead(tenantId, leadId) {
  const { rows } = await pool.query(`
    SELECT
      l.id, l.contact_phone, l.contact_email, l.address,
      l.insurance_company, l.hail_size_in, l.next_follow_up,
      l.storm_event_id, l.property_id,
      p.assessed_value, p.roof_sqft, p.year_built, p.roof_type,
      p.owner_first_name, p.fema_fd_id, p.fema_year_built,
      ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng,
      se.hail_size_max_in, se.wind_speed_max_mph, se.event_start,
      (SELECT COUNT(*) FROM activities a WHERE a.lead_id = l.id AND a.created_at > NOW() - INTERVAL '30 days') AS recent_activity_count,
      (SELECT COUNT(*) FROM estimates e WHERE e.lead_id = l.id AND e.tenant_id = $1) AS estimate_count
    FROM leads l
    LEFT JOIN properties p ON l.property_id = p.id
    LEFT JOIN storm_events se ON l.storm_event_id = se.id
    WHERE l.id = $2 AND l.tenant_id = $1 AND l.deleted_at IS NULL
  `, [tenantId, leadId]);

  if (rows.length === 0) return null;

  const r = rows[0];

  const daysSinceStorm = r.event_start
    ? Math.floor((Date.now() - new Date(r.event_start).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Fetch on-demand data in parallel (all cached 24hr in memory, no DB writes)
  const lat = parseFloat(r.lat);
  const lng = parseFloat(r.lng);
  let hailRiskLevel = null, maxHistoricalHailIn = 0, hailHistoryCount = 0;
  let femaRiskScore = null;
  let homeAge = null, ownerOccupiedRate = null;

  if (!isNaN(lat) && !isNaN(lng)) {
    const [hailResult, censusResult] = await Promise.allSettled([
      getStormHistory(lat, lng, 5, 10),
      getCensusProfile(lat, lng),
    ]);

    if (hailResult.status === 'fulfilled' && hailResult.value?.summary) {
      hailRiskLevel = hailResult.value.summary.riskLevel;
      maxHistoricalHailIn = hailResult.value.summary.maxHailSizeInches || 0;
      hailHistoryCount = hailResult.value.summary.hailCount || 0;
    }

    if (censusResult.status === 'fulfilled' && censusResult.value) {
      const census = censusResult.value;
      homeAge = census.homeAge;
      ownerOccupiedRate = census.ownerOccupiedRate;

      // Use Census county to fetch FEMA disaster data
      if (census.countyName && census.stateFips) {
        try {
          // Map state FIPS to abbreviation for FEMA API
          const stateAbbr = r.state || fipsToState(census.stateFips);
          if (stateAbbr) {
            const femaData = await getDisasterDeclarations(stateAbbr, census.countyName);
            femaRiskScore = computeCountyRiskScore(femaData.summary);
          }
        } catch (err) {
          logger.warn({ err, leadId }, 'Failed to fetch FEMA disaster data — scoring without it');
        }
      }
    }
  }

  const factors = {
    hailSizeIn: parseFloat(r.hail_size_max_in || r.hail_size_in) || null,
    windSpeedMph: parseFloat(r.wind_speed_max_mph) || null,
    assessedValue: parseFloat(r.assessed_value) || 0,
    roofSqft: parseInt(r.roof_sqft) || 0,
    daysSinceStorm,
    hailRiskLevel,
    maxHistoricalHailIn,
    hailHistoryCount,
    femaRiskScore,
    homeAge,
    ownerOccupiedRate,
    hasPhone: !!r.contact_phone,
    hasEmail: !!r.contact_email,
    recentActivityCount: parseInt(r.recent_activity_count) || 0,
    hasUpcomingFollowUp: r.next_follow_up && new Date(r.next_follow_up) > new Date(),
    hasInsurance: !!r.insurance_company,
    hasAddress: !!r.address,
    hasFemaData: !!r.fema_fd_id,
    hasYearBuilt: !!(r.year_built || r.fema_year_built),
    hasRoofType: !!r.roof_type,
    hasOwnerInfo: !!r.owner_first_name,
    hasEstimate: parseInt(r.estimate_count) > 0,
  };

  const { score, factors: scoredFactors } = computeScoreFromFactors(factors);

  // Update lead with score (single write, acceptable for on-demand)
  await pool.query(`
    UPDATE leads SET lead_score = $1, lead_score_factors = $2, lead_score_updated_at = NOW()
    WHERE id = $3 AND tenant_id = $4
  `, [score, JSON.stringify(scoredFactors), leadId, tenantId]);

  return { score, factors: scoredFactors };
}

/**
 * Batch score all leads for a tenant (use sparingly — respects Neon free tier)
 * Only scores leads that haven't been scored in the last 24 hours
 */
export async function scoreAllLeads(tenantId) {
  const { rows: leads } = await pool.query(`
    SELECT id FROM leads
    WHERE tenant_id = $1 AND deleted_at IS NULL
      AND (lead_score_updated_at IS NULL OR lead_score_updated_at < NOW() - INTERVAL '24 hours')
    ORDER BY created_at DESC
    LIMIT 100
  `, [tenantId]);

  const results = [];
  for (const lead of leads) {
    try {
      const result = await scoreLead(tenantId, lead.id);
      if (result) results.push({ id: lead.id, score: result.score });
    } catch (err) {
      logger.error({ err, leadId: lead.id }, 'Failed to score lead');
    }
  }

  return { scored: results.length, results };
}

/**
 * Get score breakdown labels for display
 */
export function getScoreLabel(score) {
  if (score >= 80) return { label: 'Excellent', color: 'oklch(0.75 0.18 145)' };
  if (score >= 60) return { label: 'Good', color: 'oklch(0.75 0.15 85)' };
  if (score >= 40) return { label: 'Fair', color: 'oklch(0.75 0.15 60)' };
  if (score >= 20) return { label: 'Low', color: 'oklch(0.65 0.15 30)' };
  return { label: 'Minimal', color: 'oklch(0.55 0.1 0)' };
}

// Common US state FIPS → abbreviation (covers storm-prone states)
const FIPS_TO_STATE = {
  '01':'AL','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','12':'FL',
  '13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY',
  '22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO',
  '30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC',
  '38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY',
};
function fipsToState(fips) { return FIPS_TO_STATE[fips] || null; }
