/**
 * Simple in-memory cache with TTL support.
 * No external dependencies — uses a plain Map.
 */
const store = new Map();

/**
 * Get a cached value. Returns null if key is missing or expired.
 */
export function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Store a value with a TTL in milliseconds.
 */
export function set(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Check if a valid (non-expired) entry exists for the key.
 */
export function has(key) {
  const entry = store.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return false;
  }
  return true;
}

/**
 * Clear all cached entries.
 */
export function clear() {
  store.clear();
}

export default { get, set, has, clear };
