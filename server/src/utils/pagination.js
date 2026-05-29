// Shared pagination helper. Clamps ?limit and ?offset query params so that
// PostgreSQL never receives a negative LIMIT/OFFSET (which throws and surfaces
// as a 500 to the caller).
//
// Defaults mirror the values previously hard-coded across list routes:
// limit defaults to 50, capped at 200; offset defaults to 0.
export function parsePagination(query, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const rawLimit = parseInt(query?.limit, 10);
  const rawOffset = parseInt(query?.offset, 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), maxLimit)
    : defaultLimit;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
  return { limit, offset };
}
