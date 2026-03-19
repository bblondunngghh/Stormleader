const DB_NAME = 'stormleads-props';
const DB_VERSION = 1;
const STORE_NAME = 'properties';
const TILES_STORE = 'tiles';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_TS_KEY = 'stormleads-cache-ts';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(TILES_STORE)) {
        db.createObjectStore(TILES_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Check if cache is expired (older than 7 days)
function isCacheExpired() {
  const ts = localStorage.getItem(CACHE_TS_KEY);
  if (!ts) return true;
  return Date.now() - parseInt(ts, 10) > CACHE_MAX_AGE_MS;
}

function touchCacheTimestamp() {
  if (!localStorage.getItem(CACHE_TS_KEY)) {
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  }
}

// Save properties in bulk (upsert by id)
export async function cacheProperties(features) {
  if (!features.length) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const f of features) {
      const id = f.id || f.properties?.id;
      if (id) store.put({ id, feature: f });
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    touchCacheTimestamp();
  } catch (e) {
    console.warn('Property cache write failed:', e.message);
  }
}

// Load all cached properties (returns [] if expired)
export async function loadCachedProperties() {
  try {
    if (isCacheExpired()) {
      await clearPropertyCache();
      return [];
    }
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    const rows = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.map(r => r.feature);
  } catch (e) {
    console.warn('Property cache read failed:', e.message);
    return [];
  }
}

// Save loaded tile keys
export async function cacheTileKeys(keys) {
  if (!keys.length) return;
  try {
    const db = await openDB();
    const tx = db.transaction(TILES_STORE, 'readwrite');
    const store = tx.objectStore(TILES_STORE);
    for (const key of keys) {
      store.put({ key });
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('Tile cache write failed:', e.message);
  }
}

// Load all cached tile keys (returns [] if expired)
export async function loadCachedTileKeys() {
  try {
    if (isCacheExpired()) return [];
    const db = await openDB();
    const tx = db.transaction(TILES_STORE, 'readonly');
    const store = tx.objectStore(TILES_STORE);
    const req = store.getAll();
    const rows = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.map(r => r.key);
  } catch (e) {
    console.warn('Tile cache read failed:', e.message);
    return [];
  }
}

// Clear all cached data (used on time range change)
export async function clearPropertyCache() {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_NAME, TILES_STORE], 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(TILES_STORE).clear();
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    localStorage.removeItem(CACHE_TS_KEY);
  } catch (e) {
    console.warn('Property cache clear failed:', e.message);
  }
}
