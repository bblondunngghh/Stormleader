# Per-Swath Property Loading with Progress Bar

## Summary

Replace the current viewport-based property loading in StormMap with per-swath loading that triggers at zoom 10+. Properties load sequentially per swath in batches of 5,000 (up to 50k per swath) with a progress bar showing loaded/total counts.

## Trigger & Lifecycle

- **Zoom 10+**: After a 500ms debounce (viewport must be idle), identify storm swaths intersecting the viewport. For each, fetch property count, then paginate properties in 5k batches.
- **Pan at zoom 10+**: Continue in-progress loads. Queue any newly visible swaths.
- **Zoom in further**: Same — keep loading, add new swaths.
- **Zoom out to 9**: Keep loaded properties visible, don't start new loads.
- **Zoom out to 8 or below**: Cancel active fetches, clear all properties and cache (existing behavior).

## Loading Strategy

1. On viewport idle at zoom 10+, determine which swaths intersect the viewport using a bounding-box check: compute min/max lat/lng of each swath's coordinates and test overlap with the viewport bounds. This is fast and sufficient since swaths are already spatially close to their bounding box.
2. Skip swaths already fully loaded (cached by storm event ID, accessed as `feature.id`).
3. For unloaded swaths, fetch count via `GET /api/properties/in-swath/:id/count`.
4. Load swaths **sequentially** (one at a time) to avoid overloading Neon DB.
5. Each swath loads in pages: `GET /api/properties/in-swath/:id?limit=5000&offset=0`, then `offset=5000`, etc., up to 50,000.
6. After each batch, merge into the property cache and trigger a canvas redraw so dots appear incrementally.
7. When the 50k cap is reached, stop loading that swath and show `"50,000 / 82,000 (limit reached)"` in the progress bar so the user understands it's intentional.

## Progress Bar

- **Position**: Right side of the storm map, below the address search bar. Absolutely positioned.
- **Style**: Reuse the glass card + bar pattern from `ImportProgress` in TopBar.jsx.
- **Single swath**: `"12,500 / 38,200 properties"` with bar filling proportionally.
- **Multiple swaths**: `"Swath 2/3 — 8,000 / 22,000 properties"` showing which swath is loading and its progress.
- **Limit reached**: `"50,000 / 82,000 (limit reached)"` when cap is hit.
- **Smooth count-up animation**: Same `requestAnimationFrame` approach as `ImportProgress`.
- **Fades out**: 2-second delay after completion so user sees 100%, then fade with 0.5s CSS transition.

## Cancellation

- Only cancel active fetches when zooming out to **zoom 8 or below**.
- Use an `AbortController` per loading session. Create a new one when loading starts; abort it on zoom-out below 8.
- **Time range change**: abort active loading session, clear cache, then re-trigger for visible swaths.
- **500ms debounce**: viewport must be idle for 500ms before loading begins. Rapid zoom/pan resets the timer, preventing unnecessary requests.
- Panning or zooming in does NOT cancel — loads continue and new swaths are queued.

## Caching

- Cache loaded properties by storm event ID (`swathPropCacheRef: Map<stormEventId, Feature[]>`). Cache key is `feature.id` from the storm features in `stormFeaturesRef`.
- When a swath is fully loaded (or 50k cap reached), mark it complete so re-entering the viewport skips it.
- Cache clears on zoom out to 8 or below, or on time range change.
- The combined cache feeds into `propFeaturesRef` (flattened from all cached swaths) so the existing canvas overlay, click handlers, and label rendering continue to work unchanged.

## Backend Changes

### Align count endpoint filters with data query

The count endpoint (`/api/properties/in-swath/:id/count`) has extra filters (`address_line1 IS NOT NULL`, etc.) that `findPropertiesInSwath` does not. These must be aligned so the progress bar total matches actual row count. Update `findPropertiesInSwath` to include the same address filter, OR remove the extra filters from the count endpoint.

### Pass AbortController signal

No other backend changes needed. Existing endpoints support pagination:

- `GET /api/properties/in-swath/:stormEventId/count` — returns total count
- `GET /api/properties/in-swath/:stormEventId?limit=5000&offset=0` — paginated properties

## Frontend Changes

### `client/src/api/storms.js`

Update `getPropertiesInSwath` signature to accept options:

```js
export const getPropertiesInSwath = (stormEventId, { limit, offset, signal } = {}) =>
  client.get(`/properties/in-swath/${stormEventId}`, {
    params: { limit, offset },
    signal,
  });
```

### `client/src/components/StormMap.jsx`

- **Remove** the existing `loadProperties` function and its refs (`propCacheRef`, `propBboxRef`, `propLoadingRef`).
- **Add** `loadSwathProperties` that implements the per-swath sequential loading strategy.
- **Add** `SwathPropertyProgress` inline component (glass card with progress bar + count text).
- **Add refs**: `swathPropCacheRef` (Map<stormEventId, Feature[]>), `swathLoadAbortRef` (AbortController), `swathLoadStateRef` (current loading state for progress UI).
- **Feed** `propFeaturesRef` from the flattened swath cache so canvas overlay, click handlers, and labels work unchanged.
- **Wire up** the existing `idle` listener to trigger `loadSwathProperties` with 500ms debounce at zoom 10+, and the zoom listener to cancel/clear at zoom < 8.
- Point-type storm events (no polygon geometry) are skipped — they cannot spatially contain properties.

### `client/src/index.css`

Add styles for `swath-property-progress` component, similar to existing `import-progress` styles.

## Edge Cases

- Swath with 0 properties: skip, move to next swath.
- Network error mid-load: stop loading that swath, show error state briefly, continue with next swath.
- Time range change: abort active loads, clear cache, re-trigger for visible swaths.
- Point-type storms: skip (no polygon to intersect with properties).
