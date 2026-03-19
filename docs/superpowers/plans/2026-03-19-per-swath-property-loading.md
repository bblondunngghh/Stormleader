# Per-Swath Property Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace viewport-based property loading in StormMap with per-swath sequential loading (5k batches, 50k cap) triggered at zoom 10+, with a progress bar showing loaded/total counts.

**Architecture:** The idle listener at zoom 10+ identifies visible swaths via bbox overlap, then loads properties sequentially per swath using the existing paginated `/api/properties/in-swath/:id` endpoint. A new `SwathPropertyProgress` component shows real-time progress. Properties feed into the existing `propFeaturesRef` so canvas rendering, click handlers, and labels work unchanged.

**Tech Stack:** React, Google Maps JS API, axios, PostGIS, existing glass CSS design system

**Spec:** `docs/superpowers/specs/2026-03-19-per-swath-property-loading-design.md`

---

### Task 1: Align backend filters between count and data endpoints

**Files:**
- Modify: `server/src/services/propertyService.js:18-53` (`findPropertiesInSwath`)

The count endpoint at `server/src/routes/properties.js:55-60` has different filters than `findPropertiesInSwath`. Align them completely so progress bar totals match actual row counts.

- [ ] **Step 1: Align findPropertiesInSwath filters with count endpoint**

In `server/src/services/propertyService.js`, update the WHERE clause in `findPropertiesInSwath` (lines 41-43). Replace:

```sql
     WHERE ST_Intersects(p.location, se.geom)
     AND (p.fema_fd_id IS NOT NULL OR p.year_built IS NOT NULL OR p.roof_sqft > 0 OR p.homestead_exempt = true
          OR COALESCE(p.assessed_value, p.fema_replacement_value) > 15000)
```

with (matching the count endpoint exactly):

```sql
     WHERE p.location && se.geom AND ST_Intersects(p.location, se.geom)
     AND (p.year_built IS NOT NULL OR p.fema_year_built IS NOT NULL OR p.roof_sqft > 0 OR p.fema_sqft > 0 OR COALESCE(p.assessed_value, p.fema_replacement_value) > 15000 OR p.homestead_exempt = true)
     AND p.address_line1 IS NOT NULL AND TRIM(p.address_line1) != '' AND p.address_line1 != '0'
```

This adds: (a) `p.location && se.geom` bbox pre-filter for performance, (b) `fema_year_built` and `fema_sqft` to the quality filter, (c) address filter. And removes `fema_fd_id` to match the count query.

- [ ] **Step 2: Verify build**

Run: `cd /c/Projects/stormleads && node -e "import('./server/src/services/propertyService.js')"`
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add server/src/services/propertyService.js
git commit -m "fix: align findPropertiesInSwath filters with count endpoint"
```

---

### Task 2: Update API client to support pagination and abort signals

**Files:**
- Modify: `client/src/api/storms.js:24-28`

- [ ] **Step 1: Update getPropertiesInSwath signature**

In `client/src/api/storms.js`, replace lines 24-25:

```js
export const getPropertiesInSwath = (stormEventId) =>
  client.get(`/properties/in-swath/${stormEventId}`);
```

with:

```js
export const getPropertiesInSwath = (stormEventId, { limit, offset, signal } = {}) =>
  client.get(`/properties/in-swath/${stormEventId}`, {
    params: { limit, offset },
    signal,
  });
```

- [ ] **Step 2: Update getSwathPropertyCount to support abort signal**

Replace lines 27-28:

```js
export const getSwathPropertyCount = (stormEventId) =>
  client.get(`/properties/in-swath/${stormEventId}/count`);
```

with:

```js
export const getSwathPropertyCount = (stormEventId, { signal } = {}) =>
  client.get(`/properties/in-swath/${stormEventId}/count`, { signal });
```

- [ ] **Step 3: Verify build**

Run: `cd /c/Projects/stormleads/client && npx vite build 2>&1 | tail -5`
Expected: `✓ built in` with no errors

- [ ] **Step 4: Commit**

```bash
git add client/src/api/storms.js
git commit -m "feat: add pagination and abort signal support to swath API functions"
```

---

### Task 3: Add progress bar CSS styles

**Files:**
- Modify: `client/src/index.css` (append after the existing `.import-progress` styles around line 430)

- [ ] **Step 1: Add swath progress bar styles**

Add after the `.import-progress__text` rule (around line 430):

```css
/* Swath property loading progress */
.swath-property-progress {
  position: absolute;
  top: calc(var(--space-lg) + 52px + var(--space-sm));
  right: var(--space-lg);
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 12px / 10px;
  animation: import-pulse 2s ease-in-out infinite;
  transition: opacity 0.5s ease;
}
.swath-property-progress--done {
  animation: none;
  opacity: 0;
  pointer-events: none;
}
.swath-property-progress__bar {
  width: 80px;
  height: 5px;
  border-radius: 3px;
  background: oklch(0.3 0.02 250 / 0.5);
  overflow: hidden;
}
.swath-property-progress__fill {
  height: 100%;
  border-radius: 3px;
  background: oklch(0.65 0.18 170);
  transition: width 0.4s ease;
  min-width: 2px;
}
.swath-property-progress__text {
  font-size: 11px;
  font-weight: 600;
  color: oklch(0.75 0.1 170);
  white-space: nowrap;
}
.swath-property-progress__label {
  font-size: 9px;
  font-weight: 700;
  color: oklch(0.55 0.05 170);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

- [ ] **Step 2: Verify build**

Run: `cd /c/Projects/stormleads/client && npx vite build 2>&1 | tail -5`
Expected: `✓ built in` with no errors

- [ ] **Step 3: Commit**

```bash
git add client/src/index.css
git commit -m "feat: add swath property progress bar styles"
```

---

### Task 4: Add SwathPropertyProgress component to StormMap

**Files:**
- Modify: `client/src/components/StormMap.jsx` (add component before the default export, around line 115)

- [ ] **Step 1: Add the SwathPropertyProgress component**

Insert before `export default function StormMap()` (around line 115):

```jsx
/* ── Swath Property Loading Progress ──────────────────────── */
function SwathPropertyProgress({ state }) {
  const [displayCount, setDisplayCount] = useState(0);
  const targetRef = useRef(0);
  const animRef = useRef(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!state) { setDisplayCount(0); setDone(false); return; }
    targetRef.current = state.loaded;
    if (state.finished) {
      setDisplayCount(state.loaded);
      const t = setTimeout(() => setDone(true), 2000);
      return () => clearTimeout(t);
    }
    setDone(false);
  }, [state]);

  // Smooth count-up animation
  useEffect(() => {
    if (!state || state.finished) return;
    const animate = () => {
      setDisplayCount(prev => {
        const target = targetRef.current;
        if (prev >= target) return target;
        const step = Math.max(1, Math.ceil((target - prev) / 20));
        return Math.min(prev + step, target);
      });
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [state]);

  if (!state) return null;

  const { total, swathIndex, swathCount, limitReached } = state;
  const pct = total > 0 ? Math.round((displayCount / (limitReached ? displayCount : total)) * 100) : 0;

  let label = '';
  if (swathCount > 1) label = `Swath ${swathIndex + 1}/${swathCount}`;

  let text = `${displayCount.toLocaleString()} / ${total.toLocaleString()} properties`;
  if (limitReached) text += ' (limit reached)';

  return (
    <div className={`swath-property-progress glass ${done ? 'swath-property-progress--done' : ''}`}>
      {label && <span className="swath-property-progress__label">{label}</span>}
      <div className="swath-property-progress__bar">
        <div className="swath-property-progress__fill" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="swath-property-progress__text">{text}</span>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /c/Projects/stormleads/client && npx vite build 2>&1 | tail -5`
Expected: `✓ built in` with no errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/StormMap.jsx
git commit -m "feat: add SwathPropertyProgress component"
```

---

### Task 5: Replace loadProperties with loadSwathProperties

This is the core task. Replace the viewport-based property loading with per-swath sequential loading.

**Files:**
- Modify: `client/src/components/StormMap.jsx`

- [ ] **Step 1: Update imports**

At line 4, add `getPropertiesInSwath` to the import:

```js
import { getSwaths, getPropertiesInSwath, getSwathPropertyCount, getAffectedProperties, getMapProperties, createProperty, fetchFemaData } from '../api/storms';
```

Note: Keep `getAffectedProperties` and `getMapProperties` in the import for now — they may still be referenced by other code paths. They will become unused after the replacement.

- [ ] **Step 2: Add new refs and state**

After the existing refs (around line 155, after `const propBboxRef = useRef(null);`), add:

```js
const swathPropCacheRef = useRef(new Map()); // stormEventId -> Feature[]
const swathLoadedRef = useRef(new Set()); // fully loaded swath IDs
const swathAbortRef = useRef(null); // AbortController for current loading session
const swathDebounceRef = useRef(null); // debounce timer
const [swathProgress, setSwathProgress] = useState(null); // progress bar state
```

- [ ] **Step 3: Add bbox overlap helper**

Add this helper function inside the component, after the new refs:

```js
// Check if a storm feature's polygon bbox overlaps the map viewport
function featureBboxOverlaps(feature, bounds) {
  const geom = feature.geometry;
  if (!geom?.coordinates || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) return false;
  const coords = geom.type === 'MultiPolygon' ? geom.coordinates.flat(2) : geom.coordinates.flat(1);
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [lng, lat] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  return !(maxLat < sw.lat() || minLat > ne.lat() || maxLng < sw.lng() || minLng > ne.lng());
}
```

- [ ] **Step 4: Add loadSwathProperties function**

Add this function after the bbox helper (replacing the old `loadProperties`). Do NOT delete `loadProperties` yet — we'll remove it in step 6.

```js
const SWATH_BATCH_SIZE = 5000;
const SWATH_MAX_PROPERTIES = 50000;

const loadSwathProperties = useCallback(async (map) => {
  if (!map) return;
  const zoom = map.getZoom();

  // Too zoomed out — clear everything
  if (zoom < 8) {
    if (swathAbortRef.current) swathAbortRef.current.abort();
    swathPropCacheRef.current.clear();
    swathLoadedRef.current.clear();
    propFeaturesRef.current = [];
    setSwathProgress(null);
    if (canvasOverlayRef.current) canvasOverlayRef.current.requestDraw();
    for (const lbl of propLabelsRef.current) lbl.map = null;
    propLabelsRef.current = [];
    return;
  }

  // Below zoom 10 — don't start new loads but keep existing
  if (zoom < 10) return;

  const bounds = map.getBounds();
  if (!bounds) return;

  // Find swaths that overlap the viewport (polygons only)
  const visibleSwaths = stormFeaturesRef.current.filter(f =>
    f.id && featureBboxOverlaps(f, bounds) && !swathLoadedRef.current.has(f.id)
  );

  if (visibleSwaths.length === 0) return;

  // Abort any previous loading session before starting a new one
  if (swathAbortRef.current) swathAbortRef.current.abort();
  const abort = new AbortController();
  swathAbortRef.current = abort;

  const totalSwaths = visibleSwaths.length;

  for (let si = 0; si < visibleSwaths.length; si++) {
    if (abort.signal.aborted) break;
    const swath = visibleSwaths[si];
    const swathId = swath.id;

    // Skip if already loaded (could have been loaded by a concurrent trigger)
    if (swathLoadedRef.current.has(swathId)) continue;

    try {
      // Get count first
      const countRes = await getSwathPropertyCount(swathId, { signal: abort.signal });
      const total = countRes.data?.count || 0;

      if (total === 0) {
        swathLoadedRef.current.add(swathId);
        continue;
      }

      setSwathProgress({ loaded: 0, total, swathIndex: si, swathCount: totalSwaths, finished: false, limitReached: false });

      let offset = 0;
      let loaded = 0;
      const swathFeatures = [];

      while (offset < total && offset < SWATH_MAX_PROPERTIES) {
        if (abort.signal.aborted) break;

        const res = await getPropertiesInSwath(swathId, {
          limit: SWATH_BATCH_SIZE,
          offset,
          signal: abort.signal,
        });

        const features = res.data?.features || [];
        if (features.length === 0) break;

        swathFeatures.push(...features);
        loaded += features.length;
        offset += SWATH_BATCH_SIZE;

        const limitReached = offset >= SWATH_MAX_PROPERTIES && total > SWATH_MAX_PROPERTIES;

        // Update cache and trigger redraw after each batch
        swathPropCacheRef.current.set(swathId, swathFeatures);
        propFeaturesRef.current = Array.from(swathPropCacheRef.current.values()).flat();
        if (canvasOverlayRef.current) canvasOverlayRef.current.requestDraw();
        updatePropertyLabels(map, propFeaturesRef.current);

        setSwathProgress({ loaded, total, swathIndex: si, swathCount: totalSwaths, finished: false, limitReached });
      }

      swathLoadedRef.current.add(swathId);

    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') break;
      // Network error — skip this swath, continue with next
      console.warn(`Failed to load properties for swath ${swathId}:`, err.message);
      continue;
    }
  }

  if (!abort.signal.aborted) {
    setSwathProgress(prev => prev ? { ...prev, finished: true } : null);
  }
}, []);
```

- [ ] **Step 5: Verify build**

Run: `cd /c/Projects/stormleads/client && npx vite build 2>&1 | tail -5`
Expected: `✓ built in` with no errors (unused `loadProperties` still present)

- [ ] **Step 6: Remove old loadProperties and rewire idle listener**

Now remove the old code and wire up the new function:

**6a.** Delete the entire `loadProperties` function (lines 265-340, from `const propLoadingRef = useRef(false);` through the closing `}, [timeRange, improvedOnly]);`).

**6b.** Also remove the now-unused refs that were only used by `loadProperties`:
- `const propCacheRef = useRef(new Map());` (line 154)
- `const propBboxRef = useRef(null);` (line 155)
- `const propLoadingRef = useRef(false);` (was line 267)

**6c.** Update the idle listener (around line 908-913) from:

```js
map.addListener('idle', () => {
  const c = map.getCenter();
  sessionStorage.setItem('stormMapViewport', JSON.stringify({ lat: c.lat(), lng: c.lng(), zoom: map.getZoom() }));
  clearTimeout(propTimeout);
  propTimeout = setTimeout(() => loadProperties(map), 800);
});
```

to:

```js
map.addListener('idle', () => {
  const c = map.getCenter();
  sessionStorage.setItem('stormMapViewport', JSON.stringify({ lat: c.lat(), lng: c.lng(), zoom: map.getZoom() }));
  clearTimeout(swathDebounceRef.current);
  swathDebounceRef.current = setTimeout(() => loadSwathProperties(map), 500);
});
```

**6d.** Update the time range effect (around lines 1116-1124) from:

```js
useEffect(() => {
  if (mapRef.current) {
    propCacheRef.current.clear();
    propBboxRef.current = null;
    loadStorms(mapRef.current);
    loadProperties(mapRef.current, true);
  }
}, [timeRange, loadStorms, loadProperties]);
```

to:

```js
useEffect(() => {
  if (mapRef.current) {
    if (swathAbortRef.current) swathAbortRef.current.abort();
    swathPropCacheRef.current.clear();
    swathLoadedRef.current.clear();
    setSwathProgress(null);
    propFeaturesRef.current = [];
    loadStorms(mapRef.current);
    // Swath properties will reload via idle listener after storms load
  }
}, [timeRange, loadStorms]);
```

**6e.** Update the cleanup in the main useEffect return (around lines 1103-1112). Replace:

```js
propCacheRef.current.clear();
propBboxRef.current = null;
```

with:

```js
if (swathAbortRef.current) swathAbortRef.current.abort();
swathPropCacheRef.current.clear();
swathLoadedRef.current.clear();
```

**6f.** Update the initial load (around line 1055-1057). Replace:

```js
maps.event.addListenerOnce(map, 'idle', async () => {
  await loadStorms(map);
  await loadProperties(map);
```

with:

```js
maps.event.addListenerOnce(map, 'idle', async () => {
  await loadStorms(map);
  loadSwathProperties(map);
```

**6g.** Update `handleAddressSelect` (around line 1191). Replace:

```js
loadProperties(map);
```

with:

```js
loadSwathProperties(map);
```

Also update the `handleAddressSelect` dependency array (around line 1315). Replace:

```js
}, [loadProperties]);
```

with:

```js
}, [loadSwathProperties]);
```

**6h.** Remove unused imports from line 4. Remove `getAffectedProperties` and `getMapProperties` from the import statement (they are no longer called). Also remove `propLoading` state (line 131) and the `setPropLoading` calls. Remove the `improvedOnly` state and its `onImprovedOnlyChange` prop on `LayerPanel` — the per-swath loading uses the backend's built-in quality filter instead. Update the loading indicator JSX (around line 1332) from:

```jsx
{(mapLoading || propLoading) && (
```

to:

```jsx
{mapLoading && (
```

- [ ] **Step 7: Verify build**

Run: `cd /c/Projects/stormleads/client && npx vite build 2>&1 | tail -5`
Expected: `✓ built in` with no errors

- [ ] **Step 8: Commit**

```bash
git add client/src/components/StormMap.jsx
git commit -m "feat: replace viewport property loading with per-swath sequential loading"
```

---

### Task 6: Add progress bar to StormMap JSX

**Files:**
- Modify: `client/src/components/StormMap.jsx` (the return JSX)

- [ ] **Step 1: Add SwathPropertyProgress to the render**

In the JSX return, inside `<div className="storm-map-wrapper">`, after the loading indicator block and before the map legends, add:

```jsx
<SwathPropertyProgress state={swathProgress} />
```

So the structure becomes:

```jsx
<div className="storm-map-wrapper">
  <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
  {mapLoading && (
    <div className="storm-map-loading">...</div>
  )}
  <SwathPropertyProgress state={swathProgress} />
  <div className="map-legends">...</div>
</div>
```

- [ ] **Step 2: Verify build**

Run: `cd /c/Projects/stormleads/client && npx vite build 2>&1 | tail -5`
Expected: `✓ built in` with no errors

- [ ] **Step 3: Manual test**

Open `http://localhost:5173`, navigate to Storm Map, zoom into an area with storm swaths (zoom 10+). Verify:
- Progress bar appears on the right side below the search bar
- Shows "X / Y properties" with smooth count-up
- Properties appear incrementally on the canvas
- Progress bar fades out after loading completes
- Zooming out below 8 clears properties
- Panning at zoom 10+ adds new swaths without cancelling current loads

- [ ] **Step 4: Commit**

```bash
git add client/src/components/StormMap.jsx
git commit -m "feat: wire up swath property progress bar in storm map UI"
```
