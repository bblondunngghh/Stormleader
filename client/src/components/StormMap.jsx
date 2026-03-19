import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Supercluster from 'supercluster';
import { loadGoogleMaps } from '../lib/googleMaps';
import { cacheProperties, loadCachedProperties, cacheTileKeys, loadCachedTileKeys, clearPropertyCache } from '../lib/propertyCache';
import { getSwaths, getPropertiesInSwath, getSwathPropertyCount, createProperty, fetchFemaData, getFemaLiveProperties } from '../api/storms';
import { addPropertyToPipeline, createManualLead } from '../api/crm';
import { TimeFilter, LayerPanel } from './MapControls';
import AddressSearch from './AddressSearch';
import SwathPopup from './SwathPopup';

// Clean address strings from messy data (trailing commas, extra spaces)
function cleanAddr(str) {
  if (!str) return '';
  return str.replace(/[\s,]+$/, '').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
}

// Format full address as two lines, extracting street from city/state/zip
function formatFullAddr(addr, city, state, zip) {
  let raw = cleanAddr(addr) || '';
  const c = city?.trim();
  const s = state?.trim()?.toUpperCase() || '';
  const z = zip?.trim() && zip.trim() !== '0' ? zip.trim() : '';
  // Extract just the street part if address_line1 already contains city/state/zip
  let street = raw;
  if (c) {
    const cityIdx = raw.toUpperCase().indexOf(c.toUpperCase());
    if (cityIdx > 0) street = raw.substring(0, cityIdx).replace(/[\s,]+$/, '');
  }
  street = titleCase(street) || 'N/A';
  // Build location line
  let location = '';
  if (c) location += titleCase(c);
  if (s) location += (location ? ', ' : '') + s;
  if (z) location += (location ? ' ' : '') + z;
  if (!location) return street;
  return `${street}<br>${location}`;
}

// Title-case a name string (JOHN DOE → John Doe)
function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Format owner name: county data stores as "LASTNAME FIRSTNAME MI" — flip to "First Last"
// Skip reordering for LLCs, trusts, estates, partnerships, etc.
function formatOwner(first, last) {
  const raw = [first, last].filter(s => s?.trim()).join(' ').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  const bizWords = ['LLC', 'INC', 'CORP', 'TRUST', 'ESTATE', 'LTD', 'PARTNERSHIP', 'LP', 'LLP', 'CHURCH', 'ASSOCIATION'];
  if (bizWords.some(w => upper.includes(w))) return titleCase(raw);
  // If first_name is provided separately, use as-is
  if (first?.trim() && last?.trim()) return titleCase(first.trim() + ' ' + last.trim());
  // Single field with "LAST FIRST..." — split and reorder
  const parts = raw.split(/\s+/);
  if (parts.length >= 2) {
    const lastName = parts[0];
    const rest = parts.slice(1).join(' ');
    return titleCase(rest + ' ' + lastName);
  }
  return titleCase(raw);
}

const FEMA_LABELS = {
  bldg: { W: 'Wood', M: 'Masonry', H: 'Manufactured', S: 'Steel' },
  found: { S: 'Slab', C: 'Crawlspace', B: 'Basement', P: 'Pier', I: 'Pile', F: 'Fill', W: 'Solid Wall' },
};
function femaLabel(type, code) {
  return FEMA_LABELS[type]?.[code] || code;
}

// Severity color scale (hot to cold)
const SEVERITY_COLORS = {
  extreme: '#ff2d55',
  severe: '#ff6b35',
  moderate: '#dcb428',
  minor: '#00d4aa',
  unknown: '#888',
};
function severityColor(rating) {
  if (!rating) return '#888';
  return SEVERITY_COLORS[rating.toLowerCase()] || '#888';
}

// Hail severity color scale by size (inches)
// Avoids red (reserved for tornadoes) — uses green → yellow → orange → hot pink → purple
function hailSeverityColor(sizeIn) {
  if (!sizeIn || sizeIn < 0.5) return { fill: '#66d97a', stroke: '#3a9e4e' };      // light green
  if (sizeIn < 0.75) return { fill: '#8fd94e', stroke: '#5a9e26' };                // yellow-green
  if (sizeIn < 0.88) return { fill: '#b8d92e', stroke: '#7a9e12' };                // lime
  if (sizeIn < 1.0) return { fill: '#d4d926', stroke: '#9a9e0e' };                 // yellow-lime
  if (sizeIn < 1.25) return { fill: '#f5c542', stroke: '#b8941a' };                // yellow
  if (sizeIn < 1.5) return { fill: '#f5a623', stroke: '#c8841a' };                 // amber
  if (sizeIn < 1.75) return { fill: '#ff8c00', stroke: '#cc7000' };                // dark orange
  if (sizeIn < 2.0) return { fill: '#ff6322', stroke: '#cc4e1a' };                 // red-orange
  if (sizeIn < 2.5) return { fill: '#e84393', stroke: '#b5348a' };                 // hot pink
  if (sizeIn < 3.0) return { fill: '#c44dcc', stroke: '#9a3da3' };                 // magenta
  return { fill: '#af52de', stroke: '#8a3db8' };                                   // purple — extreme
}

// Layer colors
const COLORS = {
  hail: { fill: '#dcb428', stroke: '#9a7d0e' },
  wind: { fill: '#6c5ce7', stroke: '#3d2db0' },
  tornado: { fill: '#ff2d55', stroke: '#b3001e' },
  thunderstorm: { fill: '#ff9500', stroke: '#cc7700' },
  drift: { fill: '#00e5ff', stroke: '#0097a7' },
  property: '#00d4aa',
};

// Zoom-based circle scale for property markers
function propScale(zoom) {
  if (zoom <= 7) return 3;
  if (zoom <= 10) return 5;
  if (zoom <= 13) return 8;
  return 11;
}

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

function PropertyLegend() {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="map-legend glass">
      <div className="map-legend__title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Properties
        <button
          className="map-legend__info-btn"
          onClick={() => setShowInfo(!showInfo)}
          title="What's the difference?"
        >i</button>
      </div>
      <div className="map-legend__dots">
        <span><span className="map-legend__dot" style={{ background: '#00d4aa' }} />County Records</span>
        <span><span className="map-legend__dot" style={{ background: '#a882ff' }} />FEMA Records</span>
      </div>
      {showInfo && (
        <div className="map-legend__info-panel">
          <p><strong style={{ color: '#00d4aa' }}>County Records</strong> come from county appraisal districts and include owner names, addresses, parcel IDs, and assessed values. These support skip tracing and direct outreach.</p>
          <p><strong style={{ color: '#a882ff' }}>FEMA Records</strong> come from the National Structure Inventory and provide building characteristics (year built, square footage, replacement value, structure type). They cover areas where county data hasn't been imported but don't include owner information.</p>
        </div>
      )}
    </div>
  );
}

export default function StormMap() {
  const [searchParams] = useSearchParams();
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const infoRef = useRef(null);
  const observerRef = useRef(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [layers, setLayers] = useState(() => {
    try {
      const saved = sessionStorage.getItem('stormMapLayers');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { hail: false, wind: false, tornado: false, thunderstorm: false, drift: false, properties: false };
  });
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const [improvedOnly, setImprovedOnly] = useState(() => {
    try {
      const saved = sessionStorage.getItem('stormMapImprovedOnly');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return true;
  });
  const improvedOnlyRef = useRef(improvedOnly);
  improvedOnlyRef.current = improvedOnly;
  const [showFema, setShowFema] = useState(() => {
    try {
      const saved = sessionStorage.getItem('stormMapShowFema');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return true;
  });
  const showFemaRef = useRef(showFema);
  showFemaRef.current = showFema;
  // Persist layer/filter selections in sessionStorage (survives navigation, cleared on new session)
  useEffect(() => { sessionStorage.setItem('stormMapLayers', JSON.stringify(layers)); }, [layers]);
  useEffect(() => { sessionStorage.setItem('stormMapImprovedOnly', JSON.stringify(improvedOnly)); }, [improvedOnly]);
  useEffect(() => { sessionStorage.setItem('stormMapShowFema', JSON.stringify(showFema)); }, [showFema]);

  // Rebuild cluster index when Houses Only or FEMA filter changes
  useEffect(() => {
    if (propFeaturesRef.current.length > 0) {
      rebuildClusterIndex(true);
      if (canvasOverlayRef.current) canvasOverlayRef.current.requestDraw();
    }
  }, [improvedOnly, showFema]);

  const [searchLoading, setSearchLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const searchMarkerRef = useRef(null);
  const dataLayersRef = useRef({});
  const stormFeaturesRef = useRef([]); // individual storm features for click lookups
  const propLabelsRef = useRef([]);
  const propFeaturesRef = useRef([]);
  const clusterIndexRef = useRef(null);
  const showPropertyPopupRef = useRef(null);
  const swathPropCacheRef = useRef(new Map()); // stormEventId -> Feature[]
  const swathLoadedRef = useRef(new Set()); // fully loaded swath IDs
  const swathAbortRef = useRef(null); // AbortController for current loading session
  const cacheRestoredRef = useRef(false); // gate property loading until cache is restored
  const femaLoadedTilesRef = useRef(new Set()); // track FEMA-loaded tiles separately
  const femaAbortRef = useRef(null); // separate abort controller for FEMA fetches
  const swathDebounceRef = useRef(null); // debounce timer
  const femaDebounceRef = useRef(null); // separate debounce for FEMA loading
  const [swathProgress, setSwathProgress] = useState(null); // progress bar state
  const [femaLoading, setFemaLoading] = useState(false);
  const femaLoadingCountRef = useRef(0);

  // Load storms once for all of Texas (only ~389, stays on map permanently)
  const stormsLoadedRef = useRef(false);
  const loadStorms = useCallback(async (map) => {
    if (!map) return;
    const txViewport = { west: -106.65, south: 25.84, east: -93.51, north: 36.50 };
    setMapLoading(true);

    try {
      const res = await getSwaths({ timeRange, ...txViewport });
      const geojson = res.data || { type: 'FeatureCollection', features: [] };
      const buckets = { hail: [], wind: [], tornado: [], thunderstorm: [], drift: [] };
      const individualFeatures = [];

      for (const f of geojson.features) {
        // Wind flow lines go to wind bucket
        if (f.properties?._windFlow) {
          buckets.wind.push(f);
          continue;
        }
        // Merged outlines go directly to the right bucket
        if (f.properties?._merged) {
          const mType = f.properties._mergedType;
          if (buckets[mType]) buckets[mType].push(f);
          if (mType === 'hail' && f.properties.drift_geometry) {
            buckets.drift.push({ ...f, id: 'merged_drift', geometry: f.properties.drift_geometry });
          }
          continue;
        }

        if (f.id && !f.properties?.storm_event_id) {
          f.properties = { ...f.properties, storm_event_id: f.id };
        }
        // Store individual polygon features for click popup lookups
        const geomType = f.geometry?.type;
        if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
          individualFeatures.push(f);
        }
        const rawType = f.properties?.raw_data?.type || '';
        const hazards = f.properties?.raw_data?.hazards || [];
        const hasHail = f.properties?.hail_size_max_in;
        const hasWind = f.properties?.wind_speed_max_mph;
        // Points always render individually; polygons only if no merged outlines
        if (geomType === 'Point' || geomType === 'Polygon' || geomType === 'MultiPolygon') {
          // Use hazards array if present, otherwise fall back to type/field detection
          const isHail = hazards.includes('hail') || rawType === 'hail' || (hasHail && !hasWind);
          const isWind = hazards.includes('wind') || rawType === 'wind' || (hasWind && !hasHail);
          const isTornado = hazards.includes('tornado') || rawType === 'tornado';

          if (isTornado) {
            f._layerType = 'tornado';
            buckets.tornado.push(f);
          } else if (rawType === 'severe_thunderstorm' || (isHail && isWind) || (hasHail && hasWind && !rawType)) {
            // Severe thunderstorm warnings (both hail + wind) get their own layer
            f._layerType = 'thunderstorm';
            buckets.thunderstorm.push(f);
            if (f.properties?.drift_geometry && (geomType === 'Polygon' || geomType === 'MultiPolygon')) {
              buckets.drift.push({ ...f, id: `drift_${f.id}`, geometry: f.properties.drift_geometry });
            }
          } else {
            // Pure hail or pure wind events
            if (isHail || hasHail) {
              f._layerType = f._layerType || 'hail';
              buckets.hail.push(f);
              if (f.properties?.drift_geometry && (geomType === 'Polygon' || geomType === 'MultiPolygon')) {
                buckets.drift.push({ ...f, id: `drift_${f.id}`, geometry: f.properties.drift_geometry });
              }
            }
            if (isWind || hasWind) {
              f._layerType = f._layerType || 'wind';
              buckets.wind.push(f);
            }
            // If neither detected, default to wind
            if (!isHail && !hasHail && !isWind && !hasWind) {
              f._layerType = 'wind';
              buckets.wind.push(f);
            }
          }
        }
      }

      // If merged outlines exist, use them instead of individual polygons
      const hasMerged = geojson.features.some(f => f.properties?._merged);
      if (hasMerged) {
        for (const key of ['hail', 'wind', 'tornado', 'thunderstorm', 'drift']) {
          buckets[key] = buckets[key].filter(f => {
            const gt = f.geometry?.type;
            return f.properties?._merged || f.properties?._windFlow || gt === 'Point';
          });
        }
      }

      const dl = dataLayersRef.current;
      for (const key of ['hail', 'wind', 'tornado', 'thunderstorm', 'drift']) {
        const layer = dl[key];
        if (!layer) continue;
        layer.forEach(feat => layer.remove(feat));
        if (buckets[key].length > 0) {
          try {
            layer.addGeoJson({ type: 'FeatureCollection', features: buckets[key] });
          } catch (e) {
            console.warn(`Failed to add ${key} GeoJSON:`, e);
          }
        }
      }
      stormFeaturesRef.current = individualFeatures;
      stormsLoadedRef.current = true;
    } catch (e) {
      console.warn('Failed to load storms:', e);
    }
    setMapLoading(false);
  }, [timeRange]);

  const canvasOverlayRef = useRef(null);

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

  const VIEWPORT_BATCH_SIZE = 10000;

  // Rebuild spatial cluster index from current property features
  const rebuildTimerRef = useRef(null);
  function rebuildClusterIndex(immediate) {
    const doRebuild = () => {
      const improvedOnly = improvedOnlyRef.current;
      const showFema = showFemaRef.current;
      const needsFilter = improvedOnly || !showFema;
      let features = propFeaturesRef.current;
      if (needsFilter) {
        features = features.filter(f => {
          if (improvedOnly && !f.properties?.year_built) return false;
          if (!showFema && f.properties?.data_source === 'fema_nsi_live') return false;
          return true;
        });
      }
      const index = new Supercluster({
        radius: 200, maxZoom: 15, minPoints: 5,
        map: (props) => ({ femaCount: props.data_source === 'fema_nsi_live' ? 1 : 0, totalCount: 1 }),
        reduce: (accumulated, props) => { accumulated.femaCount += props.femaCount; accumulated.totalCount += props.totalCount; },
      });
      index.load(features);
      clusterIndexRef.current = index;
    };
    if (immediate) {
      clearTimeout(rebuildTimerRef.current);
      doRebuild();
    } else {
      clearTimeout(rebuildTimerRef.current);
      rebuildTimerRef.current = setTimeout(doRebuild, 300);
    }
  }

  // Deduplicate properties by id
  const propIdSetRef = useRef(new Set());
  // Grid-based region tracking: "swathId:tileX:tileY" -> loaded
  // Each tile is ~0.05° (~5.5km) so we get good coverage without too many cells
  const TILE_SIZE = 0.05;
  const loadedTilesRef = useRef(new Set());

  // Get tile keys that cover a bounding box
  function getTileKeys(swathId, bbox) {
    const [w, s, e, n] = bbox;
    const keys = [];
    const minX = Math.floor(w / TILE_SIZE);
    const maxX = Math.floor(e / TILE_SIZE);
    const minY = Math.floor(s / TILE_SIZE);
    const maxY = Math.floor(n / TILE_SIZE);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        keys.push(`${swathId}:${x}:${y}`);
      }
    }
    return keys;
  }

  // Check if ALL tiles for this swath+bbox are already loaded
  function isFullyLoaded(swathId, bbox) {
    const keys = getTileKeys(swathId, bbox);
    return keys.every(k => loadedTilesRef.current.has(k));
  }

  // Get bbox covering only the unloaded tiles for this swath
  function getUnloadedBbox(swathId, bbox) {
    const [w, s, e, n] = bbox;
    const minX = Math.floor(w / TILE_SIZE);
    const maxX = Math.floor(e / TILE_SIZE);
    const minY = Math.floor(s / TILE_SIZE);
    const maxY = Math.floor(n / TILE_SIZE);
    let uMinX = Infinity, uMaxX = -Infinity, uMinY = Infinity, uMaxY = -Infinity;
    let hasUnloaded = false;
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (!loadedTilesRef.current.has(`${swathId}:${x}:${y}`)) {
          hasUnloaded = true;
          if (x < uMinX) uMinX = x;
          if (x > uMaxX) uMaxX = x;
          if (y < uMinY) uMinY = y;
          if (y > uMaxY) uMaxY = y;
        }
      }
    }
    if (!hasUnloaded) return null;
    return [uMinX * TILE_SIZE, uMinY * TILE_SIZE, (uMaxX + 1) * TILE_SIZE, (uMaxY + 1) * TILE_SIZE];
  }

  const loadSwathProperties = useCallback(async (map) => {
    if (!map || !cacheRestoredRef.current) return;
    const zoom = map.getZoom();

    // Too zoomed out — abort loading and hide dots, but keep data cached
    if (zoom < 8) {
      if (swathAbortRef.current) swathAbortRef.current.abort();
      setSwathProgress(null);
      if (canvasOverlayRef.current) canvasOverlayRef.current.requestDraw();
      for (const lbl of propLabelsRef.current) lbl.map = null;
      propLabelsRef.current = [];
      return;
    }

    // Between zoom 8-10 — show cached data but don't start new loads
    if (zoom < 10) return;

    const bounds = map.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const viewBbox = [sw.lng(), sw.lat(), ne.lng(), ne.lat()];

    // Abort any previous loading session before starting a new one
    if (swathAbortRef.current) swathAbortRef.current.abort();
    const abort = new AbortController();
    swathAbortRef.current = abort;

    // Find swaths that overlap the viewport and have unloaded tiles
    const visibleSwaths = stormFeaturesRef.current.filter(f =>
      f.id && featureBboxOverlaps(f, bounds) && !isFullyLoaded(f.id, viewBbox)
    );

    const totalSwaths = visibleSwaths.length;
    let totalNew = 0;

    for (let si = 0; si < visibleSwaths.length; si++) {
      if (abort.signal.aborted) break;
      const swath = visibleSwaths[si];
      const swathId = swath.id;

      // Get bbox covering only unloaded tiles
      const fetchBbox = getUnloadedBbox(swathId, viewBbox);
      if (!fetchBbox) continue;

      try {
        let offset = 0;

        while (true) {
          if (abort.signal.aborted) break;

          const res = await getPropertiesInSwath(swathId, {
            limit: VIEWPORT_BATCH_SIZE,
            offset,
            bbox: fetchBbox,
            signal: abort.signal,
          });

          const features = res.data?.features || [];
          if (features.length === 0) break;

          // Deduplicate — only add properties we haven't seen before
          const newFeatures = [];
          for (const f of features) {
            const pid = f.id || f.properties?.id;
            if (pid && !propIdSetRef.current.has(pid)) {
              propIdSetRef.current.add(pid);
              newFeatures.push(f);
            }
          }

          if (newFeatures.length > 0) {
            propFeaturesRef.current = [...propFeaturesRef.current, ...newFeatures];
            totalNew += newFeatures.length;
            rebuildClusterIndex();
            if (canvasOverlayRef.current) canvasOverlayRef.current.requestDraw();
            updatePropertyLabels(map, propFeaturesRef.current);
            // Persist to IndexedDB in background
            cacheProperties(newFeatures);
          }

          setSwathProgress({
            loaded: propFeaturesRef.current.length,
            total: propFeaturesRef.current.length + (features.length === VIEWPORT_BATCH_SIZE ? VIEWPORT_BATCH_SIZE : 0),
            swathIndex: si, swathCount: totalSwaths,
            finished: false, limitReached: false,
          });

          if (features.length < VIEWPORT_BATCH_SIZE) break;
          offset += VIEWPORT_BATCH_SIZE;
        }

        // Mark all tiles in this viewport as loaded for this swath
        if (!abort.signal.aborted) {
          const tileKeys = getTileKeys(swathId, viewBbox);
          for (const key of tileKeys) {
            loadedTilesRef.current.add(key);
          }
          cacheTileKeys(tileKeys);
        }

      } catch (err) {
        if (err.name === 'AbortError' || err.name === 'CanceledError') break;
        console.warn(`Failed to load properties for swath ${swathId}:`, err.message);
        continue;
      }
    }

    if (!abort.signal.aborted) {
      setSwathProgress(prev => prev ? { ...prev, finished: true } : null);
    }

  }, []);

  // Check if a bbox overlaps any storm swath
  function chunkOverlapsSwath(chunkBbox) {
    const [cw, cs, ce, cn] = chunkBbox;
    for (const f of stormFeaturesRef.current) {
      if (!f.geometry?.coordinates) continue;
      const coords = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.flat(2) : f.geometry.coordinates.flat(1);
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const [lng, lat] of coords) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
      // Bbox overlap test
      if (!(maxLat < cs || minLat > cn || maxLng < cw || minLng > ce)) return true;
    }
    return false;
  }

  // Load FEMA properties independently from DB property loading
  const loadFemaProperties = useCallback(async (map) => {
    if (!map || !cacheRestoredRef.current) return;
    const zoom = map.getZoom();
    if (zoom < 8) return;

    const bounds = map.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const viewBbox = [sw.lng(), sw.lat(), ne.lng(), ne.lat()];

    // Build list of unloaded FEMA tile-sized chunks that overlap storm swaths
    const CHUNK = 0.45;
    const chunks = [];
    for (let w = viewBbox[0]; w < viewBbox[2]; w += CHUNK) {
      for (let s = viewBbox[1]; s < viewBbox[3]; s += CHUNK) {
        const cb = [w, s, Math.min(w + CHUNK, viewBbox[2]), Math.min(s + CHUNK, viewBbox[3])];
        // Only fetch FEMA data for areas that have storm swaths
        if (!chunkOverlapsSwath(cb)) continue;
        const cMinX = Math.floor(cb[0] / TILE_SIZE);
        const cMaxX = Math.floor(cb[2] / TILE_SIZE);
        const cMinY = Math.floor(cb[1] / TILE_SIZE);
        const cMaxY = Math.floor(cb[3] / TILE_SIZE);
        let needed = false;
        const keys = [];
        for (let x = cMinX; x <= cMaxX; x++) {
          for (let y = cMinY; y <= cMaxY; y++) {
            const key = `fema:${x}:${y}`;
            keys.push(key);
            if (!femaLoadedTilesRef.current.has(key)) needed = true;
          }
        }
        if (needed) chunks.push({ bbox: cb, keys });
      }
    }

    if (chunks.length === 0) return;

    // Abort previous FEMA session
    if (femaAbortRef.current) femaAbortRef.current.abort();
    const femaAbort = new AbortController();
    femaAbortRef.current = femaAbort;

    setFemaLoading(true);

    // Build spatial grid once for dedup
    const CELL = 0.0003;
    const grid = new Set();
    for (const existing of propFeaturesRef.current) {
      if (!existing.geometry?.coordinates) continue;
      const [eLng, eLat] = existing.geometry.coordinates;
      grid.add(`${Math.round(eLat / CELL)},${Math.round(eLng / CELL)}`);
    }

    for (const chunk of chunks) {
      if (femaAbort.signal.aborted) break;
      try {
        const femaRes = await getFemaLiveProperties({
          west: chunk.bbox[0], south: chunk.bbox[1],
          east: chunk.bbox[2], north: chunk.bbox[3],
          signal: femaAbort.signal,
        });
        const femaFeatures = femaRes.data?.features || [];

        const newFema = [];
        for (const f of femaFeatures) {
          const pid = f.id;
          if (propIdSetRef.current.has(pid)) continue;
          const [fLng, fLat] = f.geometry.coordinates;
          if (grid.has(`${Math.round(fLat / CELL)},${Math.round(fLng / CELL)}`)) continue;
          propIdSetRef.current.add(pid);
          newFema.push(f);
          grid.add(`${Math.round(fLat / CELL)},${Math.round(fLng / CELL)}`);
        }

        if (newFema.length > 0) {
          propFeaturesRef.current = [...propFeaturesRef.current, ...newFema];
          rebuildClusterIndex();
          if (canvasOverlayRef.current) canvasOverlayRef.current.requestDraw();
          cacheProperties(newFema);
        }

        for (const key of chunk.keys) {
          femaLoadedTilesRef.current.add(key);
        }
        cacheTileKeys(chunk.keys);
      } catch (err) {
        if (err.name === 'AbortError' || err.name === 'CanceledError') break;
        console.warn('FEMA chunk fetch failed:', err.message);
      }
    }

    if (!femaAbort.signal.aborted) {
      setFemaLoading(false);
    }
  }, []);

  // Property click handler — enriches with storm data from swath layers
  function handlePropertyClick(latLng, feature) {
    const p = { ...(feature.properties || {}) };
    const propertyId = feature.id || p.id;
    const pos = latLng;

    // Check storm containment
    const dl = dataLayersRef.current;
    const layerMeta = {
      hail:         { label: 'Hail',    color: '#dcb428' },
      wind:         { label: 'Wind',    color: '#6c5ce7' },
      tornado:      { label: 'Tornado', color: '#ff2d55' },
      thunderstorm: { label: 'Severe Thunderstorm', color: '#ff9500' },
      drift:        { label: 'Hail (Drift Corrected)', color: '#00e5ff' },
    };
    let nearestSpcDist = Infinity;
    let nearestSpcData = null;

    for (const sKey of ['hail', 'wind', 'tornado', 'thunderstorm', 'drift']) {
      if (!layersRef.current[sKey]) continue;
      const sLayer = dl[sKey];
      let found = false;
      sLayer.forEach((sFeat) => {
        const geom = sFeat.getGeometry();
        if (!geom) return;

        const gType = geom.getType();
        if (gType === 'Polygon' || gType === 'GeometryCollection') {
          if (found) return;
          // Collect all polygon rings — Polygon has one, GeometryCollection (MultiPolygon) has many
          const polysToCheck = [];
          if (gType === 'Polygon') {
            polysToCheck.push(new google.maps.Polygon({ paths: geom.getAt(0).getArray() }));
          } else {
            geom.getArray().forEach((subGeom) => {
              if (subGeom.getType() === 'Polygon') {
                polysToCheck.push(new google.maps.Polygon({ paths: subGeom.getAt(0).getArray() }));
              }
            });
          }
          const inside = polysToCheck.some(poly => google.maps.geometry.poly.containsLocation(pos, poly));
          if (inside) {
            if (!p.storm_event_id) p.storm_event_id = sFeat.getProperty('storm_event_id');
            const hail = sFeat.getProperty('hail_size_max_in');
            const wind = sFeat.getProperty('wind_speed_max_mph');
            if (hail && !p.storm_hail_size) p.storm_hail_size = hail;
            if (wind && !p.storm_wind_speed) p.storm_wind_speed = wind;
            if (!p._swathType) {
              p._swathType = layerMeta[sKey].label;
              p._swathColor = layerMeta[sKey].color;
            }
            const rawData = sFeat.getProperty('raw_data');
            if (rawData?.headline && !p._stormHeadline) p._stormHeadline = rawData.headline;
            if (rawData?.severity && !p._stormSeverity) p._stormSeverity = rawData.severity;
            if (rawData?.areaDesc && !p._stormArea) p._stormArea = rawData.areaDesc;
            if (rawData?.certainty && !p._stormCertainty) p._stormCertainty = rawData.certainty;
            if (rawData?.speed && !p.storm_wind_speed) p.storm_wind_speed = rawData.speed !== 'UNK' ? rawData.speed : null;
            if (rawData?.maxWindGust && !p.storm_wind_speed) {
              const parsed = parseFloat(rawData.maxWindGust.replace(/[^0-9.]/g, ' ').trim().split(/\s+/).pop());
              if (!isNaN(parsed)) p.storm_wind_speed = parsed;
            }
            if (rawData?.maxHailSize && !p.storm_hail_size) p.storm_hail_size = parseFloat(rawData.maxHailSize) || null;
            if (rawData?.remarks && !p._stormRemarks) p._stormRemarks = rawData.remarks;
            const eventStart = sFeat.getProperty('event_start');
            if (eventStart && !p.storm_date) p.storm_date = eventStart;
            found = true;
          }
        } else if (geom.getType() === 'Point') {
          const ptLatLng = geom.get();
          const dist = google.maps.geometry.spherical.computeDistanceBetween(pos, ptLatLng);
          if (dist < 30000 && dist < nearestSpcDist) {
            nearestSpcDist = dist;
            nearestSpcData = { sKey, hail: sFeat.getProperty('hail_size_max_in'), wind: sFeat.getProperty('wind_speed_max_mph'), rawData: sFeat.getProperty('raw_data'), stormEventId: sFeat.getProperty('storm_event_id'), eventStart: sFeat.getProperty('event_start') };
          }
        }
      });
    }

    if (nearestSpcData) {
      const { sKey, hail, wind, rawData, stormEventId, eventStart } = nearestSpcData;
      if (stormEventId && !p.storm_event_id) p.storm_event_id = stormEventId;
      if (eventStart && !p.storm_date) p.storm_date = eventStart;
      if (hail && !p.storm_hail_size) p.storm_hail_size = hail;
      if (wind && !p.storm_wind_speed) p.storm_wind_speed = wind;
      if (rawData?.speed && !p.storm_wind_speed) p.storm_wind_speed = rawData.speed !== 'UNK' ? rawData.speed : null;
      if (rawData?.size && !p.storm_hail_size) p.storm_hail_size = rawData.size;
      if (!p._swathType) {
        p._swathType = layerMeta[sKey]?.label;
        p._swathColor = layerMeta[sKey]?.color;
      }
    }

    // If inside a merged swath but no real storm_event_id, find the actual storm event
    if (!p.storm_event_id) {
      for (const sf of stormFeaturesRef.current) {
        if (!sf.geometry?.coordinates) continue;
        const ring = sf.geometry.coordinates[0];
        if (!ring) continue;
        const poly = new google.maps.Polygon({ paths: ring.map(c => ({ lat: c[1], lng: c[0] })) });
        if (google.maps.geometry.poly.containsLocation(pos, poly)) {
          p.storm_event_id = sf.id || sf.properties?.storm_event_id;
          if (!p.storm_date && sf.properties?.event_start) p.storm_date = sf.properties.event_start;
          if (!p.storm_hail_size && sf.properties?.hail_size_max_in) p.storm_hail_size = sf.properties.hail_size_max_in;
          if (!p.storm_wind_speed && sf.properties?.wind_speed_max_mph) p.storm_wind_speed = sf.properties.wind_speed_max_mph;
          if (!p._swathType) {
            const rawType = sf.properties?.raw_data?.type || '';
            if (rawType === 'hail' || sf.properties?.hail_size_max_in) {
              p._swathType = 'Hail'; p._swathColor = '#dcb428';
            } else if (rawType === 'tornado') {
              p._swathType = 'Tornado'; p._swathColor = '#ff2d55';
            } else if (rawType === 'severe_thunderstorm') {
              p._swathType = 'Severe Thunderstorm'; p._swathColor = '#ff9500';
            } else {
              p._swathType = 'Wind'; p._swathColor = '#6c5ce7';
            }
          }
          break;
        }
      }
    }

    sessionStorage.setItem('stormMapPopup', JSON.stringify({
      lngLat: [pos.lng(), pos.lat()],
      properties: p,
      propertyId,
    }));

    // Center map on property, offset upward so InfoWindow appears in middle of viewport
    const map = mapRef.current;
    if (map) {
      const proj = map.getProjection();
      if (proj) {
        const point = proj.fromLatLngToPoint(pos);
        // Shift down by ~25% of viewport so the popup (which opens above the pin) is centered
        const zoom = map.getZoom();
        const offsetY = 180 / Math.pow(2, zoom); // scale offset by zoom
        const shifted = new google.maps.Point(point.x, point.y + offsetY);
        const newCenter = proj.fromPointToLatLng(shifted);
        map.panTo(newCenter);
      }
      // Open popup after pan animation completes
      google.maps.event.addListenerOnce(map, 'idle', () => {
        showPropertyPopupRef.current?.(map, pos, p, propertyId);
      });
    }
  }

  function updatePropertyLabels(map, features) {
    for (const lbl of propLabelsRef.current) lbl.map = null;
    propLabelsRef.current = [];

    const zoom = map.getZoom();
    if (zoom < 15 || !layersRef.current.properties) return;

    const gm = window.google;
    // Only label visible features (limit to 200 for performance)
    const bounds = map.getBounds();
    let count = 0;
    for (const f of features) {
      if (count >= 200) break;
      if (!f.geometry?.coordinates) continue;
      const [lng, lat] = f.geometry.coordinates;
      if (bounds && !bounds.contains({ lat, lng })) continue;
      const addr = f.properties?.address_line1 || '';
      if (!addr) continue;

      const label = document.createElement('div');
      label.style.cssText = 'color:#ccc;font-size:11px;text-shadow:0 0 4px rgba(0,0,0,0.8);white-space:nowrap;pointer-events:none;';
      label.textContent = addr;

      try {
        const marker = new gm.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat, lng },
          content: label,
          zIndex: 1,
        });
        propLabelsRef.current.push(marker);
        count++;
      } catch {
        // AdvancedMarkerElement may not be available without mapId
      }
    }
  }

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const urlLat = parseFloat(searchParams.get('lat'));
    const urlLng = parseFloat(searchParams.get('lng'));
    const urlZoom = parseFloat(searchParams.get('zoom'));

    let center = { lat: 30.27, lng: -97.74 };
    let zoom = 7;
    if (urlLat && urlLng) {
      center = { lat: urlLat, lng: urlLng };
      zoom = urlZoom || 11;
    } else {
      try {
        const saved = JSON.parse(sessionStorage.getItem('stormMapViewport'));
        if (saved) { center = { lat: saved.lat, lng: saved.lng }; zoom = saved.zoom; }
      } catch {}
    }

    loadGoogleMaps().then((maps) => {
      const map = new maps.Map(mapContainer.current, {
        center,
        zoom,
        mapTypeId: zoom >= 8 ? 'hybrid' : 'roadmap',
        gestureHandling: 'greedy',
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        restriction: {
          latLngBounds: { north: 37.5, south: 25.0, west: -108.0, east: -92.5 },
          strictBounds: false,
        },
        styles: [
          { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#000000' }, { weight: 3 }, { visibility: 'on' }] },
        ],
      });
      mapRef.current = map;

      // Switch to satellite only when zoomed in enough to see houses
      let mapTypeTimer = null;
      map.addListener('idle', () => {
        clearTimeout(mapTypeTimer);
        mapTypeTimer = setTimeout(() => {
          const z = map.getZoom();
          const currentType = map.getMapTypeId();
          if (z >= 8 && currentType !== 'hybrid') {
            map.setMapTypeId('hybrid');
          } else if (z < 8 && currentType !== 'roadmap') {
            map.setMapTypeId('roadmap');
          }
        }, 150);
      });

      // Auto-dismiss "Do you own this website?" error modal
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            // Google's error modal contains a dismissButton class or specific text
            const dismiss = node.querySelector?.('.dismissButton');
            if (dismiss) { dismiss.click(); continue; }
            // Also check if node itself is the overlay with the error text
            if (node.textContent?.includes('own this website')) {
              node.style.display = 'none';
            }
          }
        }
      });
      observer.observe(mapContainer.current, { childList: true, subtree: true });
      observerRef.current = observer;

      const info = new maps.InfoWindow({
        pixelOffset: new maps.Size(0, -8),
        disableAutoPan: false,
      });
      // After auto-pan completes, check if popup is still clipped by the top bar and pan more if needed
      info.addListener('domready', () => {
        setTimeout(() => {
          const topBar = document.querySelector('.map-top-bar');
          const iwBox = document.querySelector('.gm-style-iw');
          if (!iwBox || !mapRef.current) return;
          const topBarBottom = topBar ? topBar.getBoundingClientRect().bottom : 80;
          const iwTop = iwBox.getBoundingClientRect().top;
          const padding = 20;
          const overlap = topBarBottom + padding - iwTop;
          if (overlap > 0) {
            mapRef.current.panBy(0, -overlap);
          }
        }, 350);
      });
      infoRef.current = info;

      // Create data layers for each storm type
      const dl = {};
      for (const key of ['hail', 'wind', 'tornado', 'thunderstorm', 'drift']) {
        const layer = new maps.Data();
        const c = COLORS[key];
        layer.setStyle((feature) => {
          const geomType = feature.getGeometry()?.getType();
          // Wind flow lines
          if (feature.getProperty('_windFlow')) {
            return {
              strokeColor: '#ffffff',
              strokeWeight: 1.2,
              strokeOpacity: 0.5,
              clickable: false,
            };
          }
          if (geomType === 'Point') {
            const hailSize = feature.getProperty('hail_size_max_in');
            const pointColor = (key === 'hail' && hailSize) ? hailSeverityColor(hailSize).fill : c.fill;
            return {
              icon: {
                path: maps.SymbolPath.CIRCLE,
                scale: key === 'hail' || key === 'tornado' ? 8 : 6,
                fillColor: pointColor,
                fillOpacity: 0.7,
                strokeColor: '#fff',
                strokeWeight: 1,
              },
            };
          }
          // Hail severity graduation — merged contours colored by hail size
          if (key === 'hail') {
            const hailSize = feature.getProperty('hail_size_max_in');
            const sc = hailSeverityColor(hailSize);
            return {
              fillColor: sc.fill,
              fillOpacity: 0.35,
              strokeColor: sc.stroke,
              strokeWeight: 1.5,
              strokeOpacity: 0.6,
            };
          }
          const fillOpacity = key === 'tornado' ? 0.15 : key === 'drift' ? 0.08 : 0.10;
          return {
            fillColor: c.fill,
            fillOpacity,
            strokeColor: c.stroke,
            strokeWeight: key === 'tornado' ? 3 : key === 'drift' ? 1.5 : key === 'wind' ? 1.5 : 2.5,
            strokeOpacity: key === 'drift' ? 0.6 : 0.85,
          };
        });
        layer.setMap(layersRef.current[key] ? map : null);
        dl[key] = layer;

        // Click handler for storm features — check for property hit first
        layer.addListener('click', (event) => {
          const clickLatLng = event.latLng;
          const z = map.getZoom();

          // If properties layer is on, check if click is near a property dot
          if (layersRef.current.properties && z >= 8 && clusterIndexRef.current) {
            const hitRadius = z <= 10 ? 500 : z <= 13 ? 100 : z <= 15 ? 30 : 10;
            const degSpan = hitRadius / 111000;
            const bbox = [
              clickLatLng.lng() - degSpan, clickLatLng.lat() - degSpan,
              clickLatLng.lng() + degSpan, clickLatLng.lat() + degSpan,
            ];
            const nearby = clusterIndexRef.current.getClusters(bbox, Math.floor(z));
            let closest = null;
            let closestDist = hitRadius;
            for (const c of nearby) {
              if (c.properties.cluster) continue;
              const [lng, lat] = c.geometry.coordinates;
              const dist = maps.geometry.spherical.computeDistanceBetween(clickLatLng, new maps.LatLng(lat, lng));
              if (dist < closestDist) {
                closestDist = dist;
                closest = c;
              }
            }
            if (closest) {
              const [lng, lat] = closest.geometry.coordinates;
              handlePropertyClick(new maps.LatLng(lat, lng), closest);
              return; // Property popup takes priority
            }
          }

          let props = {};
          event.feature.forEachProperty((val, key) => { props[key] = val; });
          const pos = event.latLng;

          // For merged outlines, find the nearest individual storm for popup data
          if (props._merged) {
            let nearest = null;
            let nearestDist = Infinity;
            for (const sf of stormFeaturesRef.current) {
              if (!sf.geometry?.coordinates) continue;
              // Approximate centroid from first ring
              const ring = sf.geometry.type === 'Polygon' ? sf.geometry.coordinates[0] : sf.geometry.coordinates?.[0]?.[0];
              if (!ring || !ring.length) continue;
              let cLat = 0, cLng = 0;
              for (const [lng, lat] of ring) { cLat += lat; cLng += lng; }
              cLat /= ring.length; cLng /= ring.length;
              const dist = maps.geometry.spherical.computeDistanceBetween(pos, new maps.LatLng(cLat, cLng));
              if (dist < nearestDist) { nearestDist = dist; nearest = sf; }
            }
            if (nearest) props = { ...nearest.properties, storm_event_id: nearest.id };
          }

          const container = document.createElement('div');
          container.innerHTML = SwathPopup.renderHTML(props);

          // Fetch and display property count
          const countEl = container.querySelector('.swath-popup__count-value');
          const countRow = container.querySelector('.swath-popup__property-count');
          if (countRow && countEl) {
            const stormId = countRow.dataset.stormId;
            if (stormId) {
              getSwathPropertyCount(stormId).then(res => {
                const count = res.data?.count || 0;
                countEl.textContent = count.toLocaleString();
                countEl.style.opacity = '1';
              }).catch(() => {
                countEl.textContent = '—';
                countEl.style.opacity = '0.5';
              });
            }
          }

          info.setContent(container);
          info.setPosition(pos);
          info.open(map);
        });
      }

      dataLayersRef.current = dl;

      // Canvas OverlayView for properties — participates in map transform pipeline
      // so dots move smoothly with the map during zoom/pan animations
      class PropertyOverlay extends maps.OverlayView {
        constructor() {
          super();
          this.canvas = document.createElement('canvas');
          this.canvas.style.position = 'absolute';
          this.canvas.style.pointerEvents = 'none';
        }
        onAdd() {
          this.getPanes().overlayLayer.appendChild(this.canvas);
        }
        draw() {
          const projection = this.getProjection();
          if (!projection) return;
          const map = this.getMap();
          if (!map) return;

          const center = map.getCenter();
          if (!center) return;
          const centerPx = projection.fromLatLngToDivPixel(center);
          if (!centerPx) return;

          // Size canvas to cover viewport at any rotation/tilt
          const mapDiv = map.getDiv();
          const mapW = mapDiv.offsetWidth;
          const mapH = mapDiv.offsetHeight;
          const size = Math.ceil(Math.sqrt(mapW * mapW + mapH * mapH) * 1.5);
          const dpr = window.devicePixelRatio || 1;

          const left = centerPx.x - size / 2;
          const top = centerPx.y - size / 2;
          this.canvas.style.left = left + 'px';
          this.canvas.style.top = top + 'px';
          this.canvas.width = size * dpr;
          this.canvas.height = size * dpr;
          this.canvas.style.width = size + 'px';
          this.canvas.style.height = size + 'px';

          const ctx = this.canvas.getContext('2d');
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, size, size);

          if (!layersRef.current.properties) return;
          const index = clusterIndexRef.current;
          if (!index) return;
          if (map.getZoom() < 8) return;

          const z = Math.floor(map.getZoom());
          const bounds = map.getBounds();
          if (!bounds) return;
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();

          // Query cluster index for visible items at current zoom
          const clusters = index.getClusters([sw.lng(), sw.lat(), ne.lng(), ne.lat()], z);

          // Individual point style
          const ptRadius = z <= 10 ? 3 : z <= 13 ? 5 : z <= 15 ? 7 : 9;
          const alpha = z <= 10 ? 0.85 : z <= 13 ? 0.7 : 0.5;

          // Draw individual points — DB properties in teal, FEMA in orange
          ctx.lineWidth = z <= 10 ? 1 : 0.5;
          // Pass 1: DB properties (teal)
          ctx.fillStyle = `rgba(0, 212, 170, ${alpha})`;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
          ctx.beginPath();
          for (const c of clusters) {
            if (c.properties.cluster || c.properties.data_source === 'fema_nsi_live') continue;
            const [lng, lat] = c.geometry.coordinates;
            const pixel = projection.fromLatLngToDivPixel(new maps.LatLng(lat, lng));
            if (!pixel) continue;
            const x = pixel.x - left;
            const y = pixel.y - top;
            ctx.moveTo(x + ptRadius, y);
            ctx.arc(x, y, ptRadius, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.stroke();
          // Pass 2: FEMA live properties (orange)
          ctx.fillStyle = `rgba(168, 130, 255, ${alpha})`;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
          ctx.beginPath();
          for (const c of clusters) {
            if (c.properties.cluster || c.properties.data_source !== 'fema_nsi_live') continue;
            const [lng, lat] = c.geometry.coordinates;
            const pixel = projection.fromLatLngToDivPixel(new maps.LatLng(lat, lng));
            if (!pixel) continue;
            const x = pixel.x - left;
            const y = pixel.y - top;
            ctx.moveTo(x + ptRadius, y);
            ctx.arc(x, y, ptRadius, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.stroke();

          // Draw clusters as larger circles with count labels
          // Color based on dominant source: orange if majority FEMA, teal if majority DB
          for (const c of clusters) {
            if (!c.properties.cluster) continue;
            const count = c.properties.point_count;
            const [lng, lat] = c.geometry.coordinates;
            const pixel = projection.fromLatLngToDivPixel(new maps.LatLng(lat, lng));
            if (!pixel) continue;
            const x = pixel.x - left;
            const y = pixel.y - top;

            const r = Math.min(30, 12 + Math.log2(count) * 3);
            const femaRatio = (c.properties.femaCount || 0) / (c.properties.totalCount || 1);
            const isMostlyFema = femaRatio > 0.5;

            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = isMostlyFema
              ? `rgba(168, 130, 255, ${alpha * 0.85})`
              : `rgba(0, 212, 170, ${alpha * 0.85})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            const label = count >= 1000 ? (count / 1000).toFixed(count >= 10000 ? 0 : 1) + 'k' : String(count);
            ctx.fillStyle = '#fff';
            ctx.font = `${r < 16 ? 10 : 12}px -apple-system, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x, y);
          }
        }
        requestDraw() {
          if (this._rafId) cancelAnimationFrame(this._rafId);
          this._rafId = requestAnimationFrame(() => { this._rafId = null; this.draw(); });
        }
        onRemove() {
          this.canvas.remove();
        }
      }

      const propOverlay = new PropertyOverlay();
      propOverlay.setMap(map);
      canvasOverlayRef.current = propOverlay;

      // Click hit-test via map click (canvas has pointer-events:none)
      map.addListener('click', (e) => {
        if (!layersRef.current.properties) return;
        const z = Math.floor(map.getZoom());
        if (z < 8) return;
        const index = clusterIndexRef.current;
        if (!index) return;

        const clickLatLng = e.latLng;
        const hitRadius = z <= 10 ? 500 : z <= 13 ? 100 : z <= 15 ? 30 : 10;

        // Query a small bbox around click for nearby clusters/points
        const degSpan = hitRadius / 111000; // rough meters-to-degrees
        const bbox = [
          clickLatLng.lng() - degSpan, clickLatLng.lat() - degSpan,
          clickLatLng.lng() + degSpan, clickLatLng.lat() + degSpan,
        ];
        const nearby = index.getClusters(bbox, z);

        // Check for cluster click — zoom in
        for (const c of nearby) {
          if (c.properties.cluster) {
            const [lng, lat] = c.geometry.coordinates;
            const dist = maps.geometry.spherical.computeDistanceBetween(clickLatLng, new maps.LatLng(lat, lng));
            if (dist < hitRadius) {
              const expansionZoom = Math.min(index.getClusterExpansionZoom(c.id), 18);
              map.setZoom(expansionZoom);
              map.panTo({ lat, lng });
              return;
            }
          }
        }

        // Check for individual point click
        let closest = null;
        let closestDist = hitRadius;
        for (const c of nearby) {
          if (c.properties.cluster) continue;
          const [lng, lat] = c.geometry.coordinates;
          const dist = maps.geometry.spherical.computeDistanceBetween(clickLatLng, new maps.LatLng(lat, lng));
          if (dist < closestDist) {
            closestDist = dist;
            closest = c;
          }
        }
        if (closest) {
          const [lng, lat] = closest.geometry.coordinates;
          handlePropertyClick(new maps.LatLng(lat, lng), closest);
        }
      });

      // Pointer cursor when hovering over a property dot or cluster
      let _hoverRaf = null;
      map.addListener('mousemove', (e) => {
        if (_hoverRaf) return; // throttle to one check per frame
        _hoverRaf = requestAnimationFrame(() => {
          _hoverRaf = null;
          if (!layersRef.current.properties) return;
          const z = Math.floor(map.getZoom());
          if (z < 8) { map.setOptions({ draggableCursor: null }); return; }
          const index = clusterIndexRef.current;
          if (!index) { map.setOptions({ draggableCursor: null }); return; }
          const hitRadius = z <= 10 ? 500 : z <= 13 ? 100 : z <= 15 ? 30 : 10;
          const degSpan = hitRadius / 111000;
          const cursor = e.latLng;
          const bbox = [
            cursor.lng() - degSpan, cursor.lat() - degSpan,
            cursor.lng() + degSpan, cursor.lat() + degSpan,
          ];
          const nearby = index.getClusters(bbox, z);
          let hit = false;
          for (const c of nearby) {
            const [lng, lat] = c.geometry.coordinates;
            const dist = maps.geometry.spherical.computeDistanceBetween(cursor, new maps.LatLng(lat, lng));
            if (dist < hitRadius) { hit = true; break; }
          }
          map.setOptions({ draggableCursor: hit ? 'pointer' : null });
        });
      });

      // Refresh labels on zoom change
      map.addListener('zoom_changed', () => {
        updatePropertyLabels(map, propFeaturesRef.current);
      });

      // Save viewport + load properties on pan/zoom (storms stay loaded)
      map.addListener('idle', () => {
        const c = map.getCenter();
        sessionStorage.setItem('stormMapViewport', JSON.stringify({ lat: c.lat(), lng: c.lng(), zoom: map.getZoom() }));
        clearTimeout(swathDebounceRef.current);
        swathDebounceRef.current = setTimeout(() => loadSwathProperties(map), 500);
        // FEMA loading runs independently with its own debounce
        clearTimeout(femaDebounceRef.current);
        femaDebounceRef.current = setTimeout(() => loadFemaProperties(map), 600);
      });

      // Shared property popup function
      showPropertyPopupRef.current = showPropertyPopup;
      function showPropertyPopup(map, position, p, propertyId) {
        const isFema = p.data_source === 'fema_nsi_live';
        const value = p.assessed_value ? `$${Math.round(Number(p.assessed_value)).toLocaleString()}` : '';
        const owner = formatOwner(p.owner_first_name, p.owner_last_name);
        const stormDate = p.storm_date ? new Date(p.storm_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        // Build event type label: "Wind / Hail" if both, otherwise single type
        let eventTypeLabel = p._swathType || p.storm_type || 'Storm Event';
        if (p.storm_wind_speed && p.storm_hail_size) {
          eventTypeLabel = 'Wind / Hail';
        }
        const urlStormId = searchParams.get('stormId');
        const stormId = p.storm_event_id || urlStormId;
        const hasStorm = !!stormId;
        const posLat = typeof position.lat === 'function' ? position.lat() : position.lat;
        const posLng = typeof position.lng === 'function' ? position.lng() : position.lng;
        const html = `
          <div class="swath-popup">
            <div class="swath-popup__title" style="color:${isFema ? '#a882ff' : '#00d4aa'}">${isFema ? 'FEMA Property' : 'Affected Property'}</div>
            <div class="swath-popup__sv" style="width:100%;height:150px;border-radius:6px;margin-bottom:8px;overflow:hidden;background:#1a1a2e;display:none;"></div>
            <div class="swath-popup__row">
              <span class="swath-popup__label">Address</span>
              <span class="swath-popup__value swath-popup__address">${isFema && !p.address_line1 ? '<button class="resolve-addr-btn" style="background:none;border:1px solid rgba(168,130,255,0.4);color:#a882ff;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;font-weight:600;">Lookup Address</button>' : formatFullAddr(p.address_line1, p.city, p.state, p.zip)}</span>
            </div>
            ${owner ? `<div class="swath-popup__row"><span class="swath-popup__label">Owner <span style="color:#8a8a9a;font-size:9px;font-weight:400;">· Public records</span></span><span class="swath-popup__value">${owner}</span></div>` : ''}
            ${p.year_built ? `<div class="swath-popup__row"><span class="swath-popup__label">Year Built</span><span class="swath-popup__value">${p.year_built}</span></div>` : ''}
            ${value ? `<div class="swath-popup__row"><span class="swath-popup__label">${isFema ? 'Est. Structure Value' : 'Value'}</span><span class="swath-popup__value">${value}</span></div>` : ''}
            ${p.property_sqft ? `<div class="swath-popup__row"><span class="swath-popup__label">Building Sqft</span><span class="swath-popup__value">${Number(p.property_sqft).toLocaleString()}</span></div>` : ''}
            ${p.roof_type ? `<div class="swath-popup__row"><span class="swath-popup__label">Roof Type</span><span class="swath-popup__value">${p.roof_type}</span></div>` : ''}
            ${p.fema_bldg_type ? `<div class="swath-popup__row"><span class="swath-popup__label">Structure</span><span class="swath-popup__value">${femaLabel('bldg', p.fema_bldg_type)}</span></div>` : ''}
            ${p.fema_foundation_type ? `<div class="swath-popup__row"><span class="swath-popup__label">Foundation</span><span class="swath-popup__value">${femaLabel('found', p.fema_foundation_type)}</span></div>` : ''}
            ${!p.fema_bldg_type && !p.fema_foundation_type && !p.fema_num_stories ? `<div class="fema-auto-slot" data-property-id="${propertyId}" style="margin:4px 0;"><div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);padding:4px 0;"><div class="storm-map-loading__spinner" style="width:12px;height:12px;border-width:2px;"></div>Loading building details...</div></div>` : ''}
            ${p.county_parcel_id ? `<div class="swath-popup__row"><span class="swath-popup__label">Parcel ID</span><span class="swath-popup__value">${p.county_parcel_id}</span></div>` : ''}
            ${hasStorm ? `<div style="border-top:1px solid rgba(255,255,255,0.08);margin:6px 0;padding-top:6px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span class="swath-popup__title" style="color:${p._swathColor || '#dcb428'};font-size:12px;margin:0;">Weather Event</span>
                <span style="color:${p._swathColor || '#dcb428'};font-size:12px;font-weight:600;">${eventTypeLabel}</span>
              </div>
              ${stormDate ? `<div class="swath-popup__row"><span class="swath-popup__label">Date</span><span class="swath-popup__value">${stormDate}</span></div>` : ''}
              <div class="swath-popup__row"><span class="swath-popup__label">Hail Size</span><span class="swath-popup__value" style="color:${p.storm_hail_size ? (p._swathColor || '#dcb428') : 'var(--text-muted)'}">${p.storm_hail_size ? p.storm_hail_size + '"' : 'N/A'}</span></div>
              <div class="swath-popup__row"><span class="swath-popup__label">Wind Speed</span><span class="swath-popup__value" style="color:${p.storm_wind_speed ? (p._swathColor || '#6c5ce7') : 'var(--text-muted)'}">${p.storm_wind_speed ? p.storm_wind_speed + ' mph' : 'N/A'}</span></div>
              ${p._stormSeverity ? `<div class="swath-popup__row"><span class="swath-popup__label">Rating</span><span class="swath-popup__value" style="color:${severityColor(p._stormSeverity)}">${p._stormSeverity}</span></div>` : ''}
              ${p._stormCertainty ? `<div class="swath-popup__row"><span class="swath-popup__label">Certainty</span><span class="swath-popup__value">${p._stormCertainty}</span></div>` : ''}
              ${p._stormArea ? `<div class="swath-popup__row"><span class="swath-popup__label">Area</span><span class="swath-popup__value">${p._stormArea}</span></div>` : ''}
            </div>` : ''}
            <button class="add-to-pipeline-btn" data-property-id="${propertyId}" ${stormId ? `data-storm-id="${stormId}"` : ''} ${isFema ? 'data-fema="true"' : ''} data-lat="${posLat}" data-lng="${posLng}" style="
              width:100%;margin-top:8px;padding:8px 12px;
              background:#0ea5e9;color:#fff;border:none;border-radius:6px;
              font-size:13px;font-weight:600;cursor:pointer;
            ">Add to Pipeline</button>
          </div>
        `;
        const container = document.createElement('div');
        container.innerHTML = html;

        const btn = container.querySelector('.add-to-pipeline-btn');
        if (btn) {
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Adding...';
            try {
              let propId = btn.dataset.propertyId;

              // FEMA properties need address resolved first, then create in DB
              if (btn.dataset.fema) {
                if (!p.address_line1) {
                  btn.textContent = 'Lookup address first';
                  btn.style.background = '#ef4444';
                  setTimeout(() => { btn.textContent = 'Add to Pipeline'; btn.style.background = '#0ea5e9'; btn.disabled = false; }, 2000);
                  return;
                }

                btn.textContent = 'Creating property...';
                const lat = parseFloat(btn.dataset.lat);
                const lng = parseFloat(btn.dataset.lng);
                const res = await createProperty({
                  address_line1: p.address_line1,
                  city: p.city || '',
                  state: p.state || '',
                  zip: p.zip || '',
                  lat, lng,
                });
                propId = res.data?.id || res.data?.property?.id;
                if (!propId) throw new Error('Failed to create property');
                btn.textContent = 'Adding to pipeline...';
              }

              if (btn.dataset.stormId && !btn.dataset.fema) {
                await addPropertyToPipeline(btn.dataset.stormId, propId);
              } else {
                await createManualLead(propId, btn.dataset.fema ? 'fema_nsi' : 'storm_map');
              }
              btn.textContent = 'Added to Pipeline';
              btn.style.background = '#22c55e';
            } catch (err) {
              const msg = err.response?.data?.error || 'Failed to add';
              btn.textContent = msg;
              btn.style.background = '#ef4444';
              setTimeout(() => { btn.textContent = 'Add to Pipeline'; btn.style.background = '#0ea5e9'; btn.disabled = false; }, 2000);
            }
          });
        }

        // Auto-load FEMA data
        const femaSlot = container.querySelector('.fema-auto-slot');
        if (femaSlot) {
          (async () => {
            try {
              const res = await fetchFemaData(femaSlot.dataset.propertyId);
              const d = res.data;
              if (d.found) {
                let rows = '';
                if (d.fema_sqft && !p.property_sqft) rows += `<div class="swath-popup__row"><span class="swath-popup__label">Building Sqft</span><span class="swath-popup__value">${Number(d.fema_sqft).toLocaleString()}</span></div>`;
                if (d.fema_bldg_type) rows += `<div class="swath-popup__row"><span class="swath-popup__label">Structure</span><span class="swath-popup__value">${femaLabel('bldg', d.fema_bldg_type)}</span></div>`;
                if (d.fema_foundation_type) rows += `<div class="swath-popup__row"><span class="swath-popup__label">Foundation</span><span class="swath-popup__value">${femaLabel('found', d.fema_foundation_type)}</span></div>`;
                if (d.fema_ground_elevation) rows += `<div class="swath-popup__row"><span class="swath-popup__label">Elevation</span><span class="swath-popup__value">${Number(d.fema_ground_elevation).toLocaleString()} ft</span></div>`;
                femaSlot.innerHTML = rows || '';
              } else {
                femaSlot.innerHTML = '';
              }
              // Re-check overlap after popup resized from FEMA data
              setTimeout(() => {
                const topBar = document.querySelector('.map-top-bar');
                const iwBox = document.querySelector('.gm-style-iw');
                if (!iwBox || !mapRef.current) return;
                const topBarBottom = topBar ? topBar.getBoundingClientRect().bottom : 80;
                const iwTop = iwBox.getBoundingClientRect().top;
                if (topBarBottom + 20 - iwTop > 0) {
                  mapRef.current.panBy(0, -(topBarBottom + 20 - iwTop));
                }
              }, 100);
            } catch {
              femaSlot.innerHTML = '';
            }
          })();
        }

        // Reverse geocode FEMA properties — only on button click
        const resolveBtn = container.querySelector('.resolve-addr-btn');
        if (resolveBtn) {
          resolveBtn.addEventListener('click', () => {
            const addrEl = container.querySelector('.swath-popup__address');
            if (!addrEl) return;
            resolveBtn.disabled = true;
            resolveBtn.textContent = 'Resolving…';
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: { lat: posLat, lng: posLng } }, (results, status) => {
              if (status === 'OK' && results[0]) {
                const components = results[0].address_components || [];
                const get = (type) => components.find(c => c.types.includes(type))?.long_name || '';
                const streetNum = get('street_number');
                const route = get('route');
                const city = get('locality') || get('sublocality');
                const state = get('administrative_area_level_1');
                const zip = get('postal_code');
                const street = [streetNum, route].filter(Boolean).join(' ');
                addrEl.innerHTML = formatFullAddr(street, city, state, zip);
                // Cache the resolved address on the feature
                p.address_line1 = street;
                p.city = city;
                p.state = state;
                p.zip = zip;
              } else {
                addrEl.innerHTML = `<span style="color:var(--text-muted);">${posLat.toFixed(5)}, ${posLng.toFixed(5)}</span>`;
              }
            });
          });
        }

        info.setContent(container);
        info.setPosition(position);
        info.open(map);

        // Initialize Street View panorama inside the popup
        const svContainer = container.querySelector('.swath-popup__sv');
        if (svContainer) {
          const svService = new google.maps.StreetViewService();
          svService.getPanorama({ location: { lat: posLat, lng: posLng }, radius: 100 }, (data, status) => {
            if (status === 'OK') {
              svContainer.style.display = 'block';
              new google.maps.StreetViewPanorama(svContainer, {
                position: data.location.latLng,
                pov: { heading: google.maps.geometry.spherical.computeHeading(data.location.latLng, { lat: posLat, lng: posLng }), pitch: 5 },
                zoom: 1,
                disableDefaultUI: true,
                clickToGo: false,
                linksControl: false,
              });
            }
          });
        }

        info.addListener('closeclick', () => {
          sessionStorage.removeItem('stormMapPopup');
        });
      }

      // Initial data load — restore cache, then storms, then new properties
      maps.event.addListenerOnce(map, 'idle', async () => {
        // Restore cached properties from IndexedDB (survives page reloads)
        const [cachedFeatures, cachedTiles] = await Promise.all([
          loadCachedProperties(),
          loadCachedTileKeys(),
        ]);
        if (cachedFeatures.length > 0) {
          propFeaturesRef.current = cachedFeatures;
          for (const f of cachedFeatures) {
            const pid = f.id || f.properties?.id;
            if (pid) propIdSetRef.current.add(pid);
          }
          for (const key of cachedTiles) {
            if (key.startsWith('fema:')) {
              femaLoadedTilesRef.current.add(key);
            } else {
              loadedTilesRef.current.add(key);
            }
          }
          rebuildClusterIndex(true);
          if (canvasOverlayRef.current) canvasOverlayRef.current.requestDraw();
        }
        cacheRestoredRef.current = true;

        await loadStorms(map);
        loadSwathProperties(map);
        loadFemaProperties(map);

        // Restore saved popup from session
        try {
          const saved = JSON.parse(sessionStorage.getItem('stormMapPopup'));
          if (saved) {
            showPropertyPopup(map, { lat: saved.lngLat[1], lng: saved.lngLat[0] }, saved.properties, saved.propertyId);
          }
        } catch {}

        // Auto-open property popup if propertyId is in URL
        const urlPropertyId = searchParams.get('propertyId');
        if (urlPropertyId) {
          // Always fetch property directly to guarantee popup shows
          try {
            const res = await fetch(`/api/properties/${urlPropertyId}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (res.ok) {
              const data = await res.json();
              const props = data.properties || data;
              let pLat, pLng;
              if (data.geometry?.coordinates) {
                [pLng, pLat] = data.geometry.coordinates;
              } else {
                pLat = parseFloat(searchParams.get('lat'));
                pLng = parseFloat(searchParams.get('lng'));
              }
              if (pLat && pLng) {
                const urlStormId = searchParams.get('stormId');
                const feature = {
                  id: data.id || urlPropertyId,
                  properties: { ...props, ...(urlStormId && !props.storm_event_id ? { storm_event_id: urlStormId } : {}) },
                  geometry: { type: 'Point', coordinates: [pLng, pLat] },
                };
                // Small delay to let the map finish rendering tiles
                setTimeout(() => {
                  handlePropertyClick(new maps.LatLng(pLat, pLng), feature);
                }, 500);
              }
            }
          } catch {}
        }
      });
    });

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
      if (infoRef.current) infoRef.current.close();
      if (canvasOverlayRef.current) canvasOverlayRef.current.setMap(null);
      for (const lbl of propLabelsRef.current) lbl.map = null;
      propLabelsRef.current = [];
      if (swathAbortRef.current) swathAbortRef.current.abort();
      swathPropCacheRef.current.clear();
      swathLoadedRef.current.clear();
      propIdSetRef.current.clear();
      loadedTilesRef.current.clear();
      femaLoadedTilesRef.current.clear();
      mapRef.current = null;
    };
  }, []);

  // Reload storms and clear property cache when time filter changes
  useEffect(() => {
    if (mapRef.current) {
      if (swathAbortRef.current) swathAbortRef.current.abort();
      swathPropCacheRef.current.clear();
      swathLoadedRef.current.clear();
      propIdSetRef.current.clear();
      loadedTilesRef.current.clear();
      femaLoadedTilesRef.current.clear();
      clearPropertyCache();
      setSwathProgress(null);
      propFeaturesRef.current = [];
      clusterIndexRef.current = null;
      loadStorms(mapRef.current);
    }
  }, [timeRange, loadStorms]);

  // Toggle layer visibility
  useEffect(() => {
    const map = mapRef.current;
    const dl = dataLayersRef.current;
    if (!map || !dl.hail) return;

    for (const key of ['hail', 'wind', 'tornado', 'thunderstorm', 'drift']) {
      dl[key]?.setMap(layers[key] ? map : null);
    }
    // Canvas overlay for properties — show/hide + redraw
    if (canvasOverlayRef.current) {
      canvasOverlayRef.current.setMap(layers.properties ? map : null);
    }

    // Toggle labels
    if (!layers.properties) {
      for (const lbl of propLabelsRef.current) lbl.map = null;
    } else {
      for (const lbl of propLabelsRef.current) lbl.map = map;
    }

  }, [layers]);

  // Address search handler
  const handleAddressSelect = useCallback(async (addr) => {
    const map = mapRef.current;
    if (!map) return;

    map.panTo({ lat: addr.lat, lng: addr.lng });
    map.setZoom(18);

    // Drop a marker
    if (searchMarkerRef.current) searchMarkerRef.current.map = null;
    const google = window.google;
    try {
      searchMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: addr.lat, lng: addr.lng },
      });
    } catch {
      // Fallback if no mapId for AdvancedMarkerElement
      searchMarkerRef.current = new google.maps.Marker({
        map,
        position: { lat: addr.lat, lng: addr.lng },
      });
    }

    setSearchLoading(true);
    let property = null;
    let roofData = null;
    let created = false;
    let error = null;

    try {
      const { data } = await createProperty({
        address_line1: addr.address_line1,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        lat: addr.lat,
        lng: addr.lng,
      });
      property = data.property;
      created = data.created;

      // Refresh properties after creating one
      loadSwathProperties(map);
    } catch (err) {
      console.error('Address search error:', err);
      error = err.response?.data?.error || err.message;
    } finally {
      setSearchLoading(false);
    }

    // Always show popup
    const info = infoRef.current;
    if (!info) return;
    const p = { ...(property || {}), ...(roofData || {}), address_line1: addr.address_line1, city: addr.city };
    const value = p.assessed_value ? `$${Math.round(Number(p.assessed_value)).toLocaleString()}` : '';
    const owner = formatOwner(p.owner_first_name, p.owner_last_name);
    const html = `
      <div class="swath-popup">
        <div class="swath-popup__title" style="color:#0ea5e9">${error ? 'Search Result' : created ? 'New Property Added' : 'Existing Property'}</div>
        <div class="swath-popup__sv" style="width:100%;height:150px;border-radius:6px;margin-bottom:8px;overflow:hidden;background:#1a1a2e;display:none;"></div>
        <div class="swath-popup__row">
          <span class="swath-popup__label">Address</span>
          <span class="swath-popup__value">${formatFullAddr(addr.address_line1, addr.city, addr.state, addr.zip)}</span>
        </div>
        ${owner ? `<div class="swath-popup__row"><span class="swath-popup__label">Owner <span style="color:#8a8a9a;font-size:9px;font-weight:400;">· Public records</span></span><span class="swath-popup__value">${owner}</span></div>` : ''}
        ${value ? `<div class="swath-popup__row"><span class="swath-popup__label">Value</span><span class="swath-popup__value">${value}</span></div>` : ''}
        ${p.year_built ? `<div class="swath-popup__row"><span class="swath-popup__label">Year Built</span><span class="swath-popup__value">${p.year_built}</span></div>` : ''}
        ${p.property_sqft ? `<div class="swath-popup__row"><span class="swath-popup__label">Building Sqft</span><span class="swath-popup__value">${Number(p.property_sqft).toLocaleString()}</span></div>` : ''}
        ${p.roof_type ? `<div class="swath-popup__row"><span class="swath-popup__label">Roof Type</span><span class="swath-popup__value">${p.roof_type}</span></div>` : ''}
        ${p.roof_pitch_degrees ? `<div class="swath-popup__row"><span class="swath-popup__label">Pitch</span><span class="swath-popup__value">${p.roof_pitch_degrees}°</span></div>` : ''}
        ${p.fema_bldg_type ? `<div class="swath-popup__row"><span class="swath-popup__label">Structure</span><span class="swath-popup__value">${femaLabel('bldg', p.fema_bldg_type)}</span></div>` : ''}
        ${p.fema_foundation_type ? `<div class="swath-popup__row"><span class="swath-popup__label">Foundation</span><span class="swath-popup__value">${femaLabel('found', p.fema_foundation_type)}</span></div>` : ''}
        ${!p.fema_bldg_type && !p.fema_foundation_type && !p.fema_num_stories && property ? `<div class="fema-auto-slot" data-property-id="${property.id}" style="margin:4px 0;"><div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);padding:4px 0;"><div class="storm-map-loading__spinner" style="width:12px;height:12px;border-width:2px;"></div>Loading building details...</div></div>` : ''}
        ${error ? `<div class="swath-popup__row"><span class="swath-popup__value" style="color:#ef4444;font-size:12px">${error}</span></div>` : ''}
        ${property ? `<button class="add-to-pipeline-btn" data-property-id="${property.id}" style="
          width:100%;margin-top:8px;padding:8px 12px;
          background:#0ea5e9;color:#fff;border:none;border-radius:6px;
          font-size:13px;font-weight:600;cursor:pointer;
        ">Add to Pipeline</button>` : ''}
      </div>
    `;
    const container = document.createElement('div');
    container.innerHTML = html;

    const btn = container.querySelector('.add-to-pipeline-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Adding...';
        try {
          const res = await createManualLead(btn.dataset.propertyId);
          btn.textContent = res.data?.alreadyExists ? 'Already in Pipeline' : 'Added to Pipeline';
          btn.style.background = '#22c55e';
        } catch (err) {
          btn.textContent = err.response?.data?.error || 'Failed';
          btn.style.background = '#ef4444';
          setTimeout(() => { btn.textContent = 'Add to Pipeline'; btn.style.background = '#0ea5e9'; btn.disabled = false; }, 2000);
        }
      });
    }

    // Auto-load FEMA data (address search popup)
    const femaSlot2 = container.querySelector('.fema-auto-slot');
    if (femaSlot2) {
      (async () => {
        try {
          const res = await fetchFemaData(femaSlot2.dataset.propertyId);
          const d = res.data;
          if (d.found) {
            let rows = '';
            if (d.fema_sqft && !p.property_sqft) rows += `<div class="swath-popup__row"><span class="swath-popup__label">Building Sqft</span><span class="swath-popup__value">${Number(d.fema_sqft).toLocaleString()}</span></div>`;
            if (d.fema_bldg_type) rows += `<div class="swath-popup__row"><span class="swath-popup__label">Structure</span><span class="swath-popup__value">${femaLabel('bldg', d.fema_bldg_type)}</span></div>`;
            if (d.fema_foundation_type) rows += `<div class="swath-popup__row"><span class="swath-popup__label">Foundation</span><span class="swath-popup__value">${femaLabel('found', d.fema_foundation_type)}</span></div>`;
            if (d.fema_ground_elevation) rows += `<div class="swath-popup__row"><span class="swath-popup__label">Elevation</span><span class="swath-popup__value">${Number(d.fema_ground_elevation).toLocaleString()} ft</span></div>`;
            femaSlot2.innerHTML = rows || '';
          } else {
            femaSlot2.innerHTML = '';
          }
          // Re-check overlap after popup resized
          setTimeout(() => {
            const topBar = document.querySelector('.map-top-bar');
            const iwBox = document.querySelector('.gm-style-iw');
            if (!iwBox || !mapRef.current) return;
            const topBarBottom = topBar ? topBar.getBoundingClientRect().bottom : 80;
            const iwTop = iwBox.getBoundingClientRect().top;
            if (topBarBottom + 20 - iwTop > 0) {
              mapRef.current.panBy(0, -(topBarBottom + 20 - iwTop));
            }
          }, 100);
        } catch {
          femaSlot2.innerHTML = '';
        }
      })();
    }

    info.setContent(container);
    info.setPosition({ lat: addr.lat, lng: addr.lng });
    info.open(map);

    // Initialize Street View panorama inside the popup
    const svContainer2 = container.querySelector('.swath-popup__sv');
    if (svContainer2) {
      const google = window.google;
      const svService = new google.maps.StreetViewService();
      svService.getPanorama({ location: { lat: addr.lat, lng: addr.lng }, radius: 100 }, (data, status) => {
        if (status === 'OK') {
          svContainer2.style.display = 'block';
          new google.maps.StreetViewPanorama(svContainer2, {
            position: data.location.latLng,
            pov: { heading: google.maps.geometry.spherical.computeHeading(data.location.latLng, { lat: addr.lat, lng: addr.lng }), pitch: 5 },
            zoom: 1,
            disableDefaultUI: true,
            clickToGo: false,
            linksControl: false,
          });
        }
      });
    }

    info.addListener('closeclick', () => {
      if (searchMarkerRef.current) {
        if (searchMarkerRef.current.map !== undefined) searchMarkerRef.current.map = null;
        else searchMarkerRef.current.setMap(null);
        searchMarkerRef.current = null;
      }
    });
  }, [loadSwathProperties]);

  return (
    <div className="main-content storm-map-fullbleed" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="storm-map-container">
        <div className="map-top-bar">
          <TimeFilter timeRange={timeRange} onTimeRangeChange={setTimeRange} />
          <AddressSearch onSelect={handleAddressSelect} isLoading={searchLoading} />
        </div>
        <LayerPanel
          layers={layers}
          onLayersChange={setLayers}
          improvedOnly={improvedOnly}
          onImprovedOnlyChange={setImprovedOnly}
          showFema={showFema}
          onShowFemaChange={setShowFema}
        />
        <div className="storm-map-wrapper">
          <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
          {mapLoading && (
            <div className="storm-map-loading">
              <div className="storm-map-loading__spinner">
                <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
              </div>
              <span>Loading storms…</span>
            </div>
          )}
          <SwathPropertyProgress state={swathProgress} />
          {femaLoading && (
            <div className="fema-loading-bar glass">
              <span>Fetching FEMA property records<span className="loading-dots"><span>.</span><span>.</span><span>.</span></span></span>
            </div>
          )}
          <div className="map-legends">
            <div className="map-legend glass">
              <div className="map-legend__title">Hail Severity</div>
              <div className="map-legend__bar map-legend__bar--hail" />
              <div className="map-legend__labels">
                <span>0.5"</span><span>1"</span><span>1.5"</span><span>2"</span><span>3"</span><span>4"+</span>
              </div>
              <div className="map-legend__descs">
                <span>Penny</span><span>Quarter</span><span>Golf Ball</span><span>Baseball</span>
              </div>
            </div>
            <div className="map-legend glass">
              <div className="map-legend__title">Wind Speed</div>
              <div className="map-legend__bar map-legend__bar--wind" />
              <div className="map-legend__labels">
                <span>40</span><span>58</span><span>70</span><span>80</span><span>100</span><span>130+</span>
              </div>
              <div className="map-legend__descs">
                <span>Strong</span><span>Severe</span><span>Damaging</span><span>Destructive</span>
              </div>
            </div>
            <PropertyLegend />
          </div>
        </div>
      </div>
    </div>
  );
}
