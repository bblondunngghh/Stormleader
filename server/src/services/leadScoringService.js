import pool from '../db/pool.js';
import logger from '../utils/logger.js';

/**
 * Lead Scoring Algorithm
 *
 * Computes a 0-100 score based on multiple factors:
 * - Storm damage severity (hail size, wind speed)
 * - Property value (assessed value, roof sqft)
 * - Recency of storm event
 * - Activity engagement (recent contact, follow-ups)
 * - Insurance info completeness
 * - Property data completeness (FEMA data, year built)
 */

const WEIGHTS = {
  stormDamage: 30,    // max 30 points
  propertyValue: 20,  // max 20 points
  recency: 20,        // max 20 points
  engagement: 15,     // max 15 points
  dataQuality: 15,    // max 15 points
};

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function computeScoreFromFactors(factors) {
  let score = 0;

  // --- Storm Damage (0-30) ---
  let stormScore = 0;
  if (factors.hailSizeIn) {
    // 1" = 5pts, 2" = 15pts, 3"+ = 25pts, 4"+ = 30pts
    if (factors.hailSizeIn >= 4) stormScore = 30;
    else if (factors.hailSizeIn >= 3) stormScore = 25;
    else if (factors.hailSizeIn >= 2) stormScore = 15;
    else if (factors.hailSizeIn >= 1) stormScore = 5;
    else stormScore = 2;
  }
  if (factors.windSpeedMph) {
    // Add wind bonus: 60+ mph = 5pts, 80+ = 10pts
    const windBonus = factors.windSpeedMph >= 80 ? 10 : factors.windSpeedMph >= 60 ? 5 : 0;
    stormScore = Math.min(30, stormScore + windBonus);
  }
  score += stormScore;
  factors.stormDamageScore = stormScore;

  // --- Property Value (0-20) ---
  let propScore = 0;
  const val = factors.assessedValue || 0;
  const sqft = factors.roofSqft || 0;
  if (val > 0) {
    // $100k = 5, $200k = 10, $400k = 15, $600k+ = 20
    if (val >= 600000) propScore = 20;
    else if (val >= 400000) propScore = 15;
    else if (val >= 200000) propScore = 10;
    else if (val >= 100000) propScore = 5;
    else propScore = 2;
  } else if (sqft > 0) {
    // Use roof sqft as proxy: 2000+ = 15, 1500+ = 10, 1000+ = 5
    if (sqft >= 2000) propScore = 15;
    else if (sqft >= 1500) propScore = 10;
    else if (sqft >= 1000) propScore = 5;
    else propScore = 2;
  }
  score += propScore;
  factors.propertyValueScore = propScore;

  // --- Recency (0-20) ---
  let recencyScore = 0;
  if (factors.daysSinceStorm != null) {
    // Same day = 20, within 3 days = 18, within week = 15, within 2 weeks = 10, within month = 5
    if (factors.daysSinceStorm <= 1) recencyScore = 20;
    else if (factors.daysSinceStorm <= 3) recencyScore = 18;
    else if (factors.daysSinceStorm <= 7) recencyScore = 15;
    else if (factors.daysSinceStorm <= 14) recencyScore = 10;
    else if (factors.daysSinceStorm <= 30) recencyScore = 5;
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

  // --- Data Quality (0-15) ---
  let dataScore = 0;
  if (factors.hasAddress) dataScore += 3;
  if (factors.hasFemaData) dataScore += 3;
  if (factors.hasYearBuilt) dataScore += 2;
  if (factors.hasRoofType) dataScore += 2;
  if (factors.hasOwnerInfo) dataScore += 3;
  if (factors.hasEstimate) dataScore += 2;
  dataScore = Math.min(15, dataScore);
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

  const factors = {
    hailSizeIn: parseFloat(r.hail_size_max_in || r.hail_size_in) || null,
    windSpeedMph: parseFloat(r.wind_speed_max_mph) || null,
    assessedValue: parseFloat(r.assessed_value) || 0,
    roofSqft: parseInt(r.roof_sqft) || 0,
    daysSinceStorm,
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
