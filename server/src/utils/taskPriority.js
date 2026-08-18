/**
 * tasks.priority is the `lead_priority` enum — its only members are
 * hot | warm | cold (006_leads.sql). Automation and drip action configs were
 * authored against a low/medium/high/urgent vocabulary that belongs to no
 * table in this schema, so any value stored under the old vocabulary (and the
 * old 'medium' default) raises 22P02 on INSERT.
 *
 * Normalize on the way in so already-saved configs keep working.
 */
const VALID = new Set(['hot', 'warm', 'cold']);

const LEGACY = {
  urgent: 'hot',
  high: 'hot',
  medium: 'warm',
  low: 'cold',
};

export function normalizeTaskPriority(value) {
  if (VALID.has(value)) return value;
  return LEGACY[value] || 'warm';
}

export default normalizeTaskPriority;
