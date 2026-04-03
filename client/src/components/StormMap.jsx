import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Supercluster from 'supercluster';
import { loadGoogleMaps } from '../lib/googleMaps';
import { cacheProperties, loadCachedProperties, cacheTileKeys, loadCachedTileKeys, clearPropertyCache } from '../lib/propertyCache';
import { getSwaths, getPropertiesInSwath, getSwathPropertyCount, createProperty, fetchFemaData, getFemaLiveProperties, getStormHistory, getHailHeatmap } from '../api/storms';
import { addPropertyToPipeline, createManualLead, createCanvassPin } from '../api/crm';
import client from '../api/client';
import { TimeFilter, LayerPanel } from './MapControls';
import AddressSearch from './AddressSearch';
import SwathPopup from './SwathPopup';

import { SignalIcon, BoltIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline';

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

// Ray-casting point-in-polygon test — returns true if [lng, lat] is inside a polygon ring
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Check if a point falls inside ANY loaded storm swath polygon
function pointInsideAnySwath(lng, lat, stormFeatures) {
  for (const f of stormFeatures) {
    if (!f.geometry?.coordinates) continue;
    const type = f.geometry.type;
    if (type === 'Polygon') {
      if (pointInRing(lng, lat, f.geometry.coordinates[0])) return true;
    } else if (type === 'MultiPolygon') {
      for (const poly of f.geometry.coordinates) {
        if (pointInRing(lng, lat, poly[0])) return true;
      }
    }
  }
  return false;
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
  extreme: 'oklch(0.62 0.26 15)',
  severe: 'oklch(0.68 0.20 45)',
  moderate: 'oklch(0.78 0.17 85)',
  minor: 'oklch(0.75 0.18 170)',
  unknown: 'oklch(0.55 0 0)',
};
function severityColor(rating) {
  if (!rating) return 'oklch(0.55 0 0)';
  return SEVERITY_COLORS[rating.toLowerCase()] || 'oklch(0.55 0 0)';
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

// Wind severity color by speed (mph) — 5-step scale from blue to deep purple
function windSeverityColor(speedMph) {
  const spd = Number(speedMph) || 0;
  if (spd < 58)  return { fill: '#7c8cf5', stroke: '#5a6ad0' };   // light blue — sub-severe
  if (spd < 70)  return { fill: '#6c5ce7', stroke: '#4a3ab8' };   // indigo — severe threshold
  if (spd < 85)  return { fill: '#8b3fd4', stroke: '#6a2faa' };   // purple
  if (spd < 100) return { fill: '#a52ec0', stroke: '#7e228f' };   // magenta
  return { fill: '#d41872', stroke: '#a3135a' };                   // hot pink — extreme
}

// Tornado severity color by EF scale
function tornadoSeverityColor(feature) {
  const raw = feature.getProperty('raw_data');
  const ef = raw?.tor_f_scale || raw?.ef_rating || '';
  if (ef.includes('5')) return { fill: '#990000', stroke: '#660000' };   // EF5 — dark red
  if (ef.includes('4')) return { fill: '#cc0000', stroke: '#990000' };   // EF4
  if (ef.includes('3')) return { fill: '#ff2d55', stroke: '#cc1a3e' };   // EF3
  if (ef.includes('2')) return { fill: '#ff5e3a', stroke: '#cc4a2e' };   // EF2
  if (ef.includes('1')) return { fill: '#ff8c42', stroke: '#cc7035' };   // EF1
  if (ef.includes('0')) return { fill: '#ffb347', stroke: '#cc8f39' };   // EF0
  return { fill: '#ff2d55', stroke: '#b3001e' };                        // default — red
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
        <span><span className="map-legend__dot" style={{ background: 'oklch(0.75 0.18 170)' }} />County Records</span>
        <span><span className="map-legend__dot" style={{ background: 'oklch(0.70 0.18 300)' }} />FEMA Records</span>
      </div>
      {showInfo && (
        <div className="map-legend__info-panel">
          <p><strong style={{ color: 'oklch(0.75 0.18 170)' }}>County Records</strong> come from county appraisal districts and include owner names, addresses, parcel IDs, and assessed values. These support skip tracing and direct outreach.</p>
          <p><strong style={{ color: 'oklch(0.70 0.18 300)' }}>FEMA Records</strong> come from the National Structure Inventory and provide building characteristics (year built, square footage, replacement value, structure type). They cover areas where county data hasn't been imported but don't include owner information.</p>
        </div>
      )}
    </div>
  );
}

export default function StormMap() {
  const [searchParams] = useSearchParams();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768); useEffect(() => { const mq = window.matchMedia('(max-width: 768px)'); const h = (e) => setIsMobile(e.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, []);
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
  const [showCounty, setShowCounty] = useState(() => {
    try {
      const saved = sessionStorage.getItem('stormMapShowCounty');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return true;
  });
  const showCountyRef = useRef(showCounty);
  showCountyRef.current = showCounty;
  const [showFema, setShowFema] = useState(() => {
    try {
      const saved = sessionStorage.getItem('stormMapShowFema');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return true;
  });
  const showFemaRef = useRef(showFema);
  showFemaRef.current = showFema;
  const [swathOpacity, setSwathOpacity] = useState(0.35);
  const swathOpacityRef = useRef(swathOpacity);
  swathOpacityRef.current = swathOpacity;
  // Persist layer/filter selections in sessionStorage (survives navigation, cleared on new session)
  useEffect(() => { sessionStorage.setItem('stormMapLayers', JSON.stringify(layers)); }, [layers]);
  useEffect(() => { sessionStorage.setItem('stormMapImprovedOnly', JSON.stringify(improvedOnly)); }, [improvedOnly]);
  useEffect(() => { sessionStorage.setItem('stormMapShowCounty', JSON.stringify(showCounty)); }, [showCounty]);
  useEffect(() => { sessionStorage.setItem('stormMapShowFema', JSON.stringify(showFema)); }, [showFema]);

  // Re-style swaths when transparency slider changes
  useEffect(() => {
    const dl = dataLayersRef.current;
    if (!dl) return;
    for (const key of ['hail', 'wind', 'tornado', 'thunderstorm', 'drift']) {
      const layer = dl[key];
      if (layer) layer.setStyle(layer.getStyle()); // force restyle via existing style function
    }
  }, [swathOpacity]);


  // Toggle Honey Holes — aggregated hail frequency circles via Google Maps
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing circles
    for (const c of heatmapCirclesRef.current) c.setMap(null);
    heatmapCirclesRef.current = [];

    if (!layers.honeyHoles) {
      clearTimeout(heatmapDebounceRef.current);
      return;
    }

    const loadHoneyHoles = async () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      let points;
      try {
        const { data } = await getHailHeatmap(sw.lng(), sw.lat(), ne.lng(), ne.lat());
        points = data.points || [];
      } catch { return; }

      // Clear old circles
      for (const c of heatmapCirclesRef.current) c.setMap(null);
      heatmapCirclesRef.current = [];

      if (!points.length) return;

      // Aggregate points into grid cells based on zoom level
      const zoom = map.getZoom();
      const cellSize = zoom >= 14 ? 0.005 : zoom >= 12 ? 0.02 : zoom >= 10 ? 0.05 : 0.1;
      const grid = new Map();
      for (const p of points) {
        const key = `${Math.round(p.lat / cellSize)}:${Math.round(p.lng / cellSize)}`;
        const cell = grid.get(key);
        if (cell) {
          cell.count++;
          cell.maxSize = Math.max(cell.maxSize, p.weight || 0.5);
          cell.totalSize += p.weight || 0.5;
        } else {
          grid.set(key, {
            lat: Math.round(p.lat / cellSize) * cellSize,
            lng: Math.round(p.lng / cellSize) * cellSize,
            count: 1,
            maxSize: p.weight || 0.5,
            totalSize: p.weight || 0.5,
          });
        }
      }

      // Render aggregated circles
      const maxCount = Math.max(...[...grid.values()].map(c => c.count), 1);
      for (const cell of grid.values()) {
        const intensity = cell.count / maxCount;
        const sc = hailSeverityColor(cell.maxSize);
        const radiusMeters = zoom >= 14 ? 200 : zoom >= 12 ? 500 : zoom >= 10 ? 1500 : 4000;

        const circle = new google.maps.Circle({
          center: { lat: cell.lat, lng: cell.lng },
          radius: radiusMeters * (0.5 + intensity * 0.5),
          fillColor: sc.fill,
          fillOpacity: 0.15 + intensity * 0.25,
          strokeColor: sc.stroke,
          strokeWeight: 0,
          clickable: false,
          map,
          zIndex: 1,
        });
        heatmapCirclesRef.current.push(circle);
      }
    };

    loadHoneyHoles();

    const idleListener = map.addListener('idle', () => {
      clearTimeout(heatmapDebounceRef.current);
      heatmapDebounceRef.current = setTimeout(loadHoneyHoles, 2000);
    });

    return () => {
      google.maps.event.removeListener(idleListener);
      clearTimeout(heatmapDebounceRef.current);
      for (const c of heatmapCirclesRef.current) c.setMap(null);
      heatmapCirclesRef.current = [];
    };
  }, [layers.honeyHoles]);

  // Rebuild cluster index when Houses Only, County, or FEMA filter changes
  useEffect(() => {
    if (propFeaturesRef.current.length > 0) {
      rebuildClusterIndex(true);
      if (canvasOverlayRef.current) canvasOverlayRef.current.requestDraw();
    }
  }, [improvedOnly, showFema, showCounty]);

  const [searchLoading, setSearchLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const searchMarkerRef = useRef(null);
  const dataLayersRef = useRef({});
  const stormFeaturesRef = useRef([]); // individual storm features for click lookups
  const propLabelsRef = useRef([]);
  const propFeaturesRef = useRef([]);
  const clusterIndexRef = useRef(null);
  const showPropertyPopupRef = useRef(null);
  const heatmapCirclesRef = useRef([]); // Google Maps Circle objects for honey holes
  const heatmapDebounceRef = useRef(null);
  const swathPropCacheRef = useRef(new Map()); // stormEventId -> Feature[]
  const swathLoadedRef = useRef(new Set()); // fully loaded swath IDs
  const swathAbortRef = useRef(null); // AbortController for current loading session
  const cacheRestoredRef = useRef(false); // gate property loading until cache is restored
  const femaLoadedTilesRef = useRef(new Set()); // track FEMA-loaded tiles separately
  const femaAbortRef = useRef(null); // separate abort controller for FEMA fetches
  const swathDebounceRef = useRef(null); // debounce timer
  const femaDebounceRef = useRef(null); // separate debounce for FEMA loading
  const femaCountRef = useRef(0); // track FEMA point count without filtering array
  const [swathProgress, setSwathProgress] = useState(null); // progress bar state
  const [femaLoading, setFemaLoading] = useState(false);
  const femaLoadingCountRef = useRef(0);
  const [currentZoom, setCurrentZoom] = useState(null);

  // Load storms once for all of Texas (only ~389, stays on map permanently)
  const stormsLoadedRef = useRef(false);
  const initialLoadDoneRef = useRef(false); // skip timeRange effect on first mount
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
        if (!mapRef.current) break; // component unmounted, stop
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
        // Yield to main thread between layer types so UI stays responsive
        await new Promise(r => setTimeout(r, 0));
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
      const showCounty = showCountyRef.current;
      const needsFilter = improvedOnly || !showFema || !showCounty;
      let features = propFeaturesRef.current;
      if (needsFilter) {
        features = features.filter(f => {
          const isFema = f.properties?.data_source === 'fema_nsi_live';
          if (!showFema && isFema) return false;
          if (!showCounty && !isFema) return false;
          if (showCounty && improvedOnly && !isFema && !f.properties?.year_built) return false;
          return true;
        });
      }
      const index = new Supercluster({
        radius: 300, maxZoom: 16, minPoints: 3,
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
    // Don't load if properties layer is toggled off
    if (!layersRef.current.properties) return;
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
            // Push in-place to avoid O(n) spread on every batch
            for (const nf of newFeatures) propFeaturesRef.current.push(nf);
            totalNew += newFeatures.length;
            rebuildClusterIndex(); // debounced — coalesces rapid calls
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
  // Pre-compute swath bounding boxes once and cache them — stores { bbox, feature } pairs
  // so bbox[i] always corresponds to the correct feature (no alignment bugs from skipping)
  const swathBboxCacheRef = useRef({ version: 0, entries: [] });
  function getSwathEntries() {
    const features = stormFeaturesRef.current;
    if (swathBboxCacheRef.current.version === features.length) return swathBboxCacheRef.current.entries;
    const entries = [];
    for (const f of features) {
      if (!f.geometry?.coordinates) continue;
      const coords = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.flat(2) : f.geometry.coordinates.flat(1);
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const [lng, lat] of coords) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
      entries.push({ bbox: [minLng, minLat, maxLng, maxLat], feature: f });
    }
    swathBboxCacheRef.current = { version: features.length, entries };
    return entries;
  }

  // Check if the viewport actually intersects any storm swath polygon (not just bbox)
  function viewportHasSwaths(viewBbox) {
    const [vw, vs, ve, vn] = viewBbox;
    const entries = getSwathEntries();
    for (const { bbox: [minLng, minLat, maxLng, maxLat], feature } of entries) {
      if (maxLat < vs || minLat > vn || maxLng < vw || minLng > ve) continue;
      // Bbox overlap found — do a quick point-in-polygon check with viewport center + edges
      const midLng = (vw + ve) / 2, midLat = (vs + vn) / 2;
      const testPoints = [[midLng, midLat], [vw, vs], [ve, vs], [vw, vn], [ve, vn],
        [midLng, vs], [midLng, vn], [vw, midLat], [ve, midLat]];
      for (const [tLng, tLat] of testPoints) {
        if (pointInsideAnySwath(tLng, tLat, [feature])) return true;
      }
      // Also check if any swath vertex falls inside viewport
      const rings = feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates[0]]
        : feature.geometry.coordinates.map(p => p[0]);
      for (const ring of rings) {
        for (const [lng, lat] of ring) {
          if (lng >= vw && lng <= ve && lat >= vs && lat <= vn) return true;
        }
      }
    }
    return false;
  }

  function chunkOverlapsSwath(chunkBbox) {
    const [cw, cs, ce, cn] = chunkBbox;
    const entries = getSwathEntries();
    for (const { bbox: [minLng, minLat, maxLng, maxLat], feature: f } of entries) {
      if (maxLat < cs || minLat > cn || maxLng < cw || minLng > ce) continue;
      // Bbox overlaps — check if any sample point actually falls inside the polygon
      // Test 9 points: center + 4 corners + 4 edge midpoints for better coverage
      const midLng = (cw + ce) / 2, midLat = (cs + cn) / 2;
      const testPoints = [[midLng, midLat], [cw, cs], [ce, cs], [cw, cn], [ce, cn],
        [midLng, cs], [midLng, cn], [cw, midLat], [ce, midLat]];
      if (!f?.geometry?.coordinates) continue;
      for (const [tLng, tLat] of testPoints) {
        if (f.geometry.type === 'Polygon') {
          if (pointInRing(tLng, tLat, f.geometry.coordinates[0])) return true;
        } else if (f.geometry.type === 'MultiPolygon') {
          for (const poly of f.geometry.coordinates) {
            if (pointInRing(tLng, tLat, poly[0])) return true;
          }
        }
      }
      // Also check if any swath vertex falls inside this chunk
      const rings = f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates[0]]
        : f.geometry.coordinates.map(p => p[0]);
      for (const ring of rings) {
        for (const [lng, lat] of ring) {
          if (lng >= cw && lng <= ce && lat >= cs && lat <= cn) return true;
        }
      }
    }
    return false;
  }

  // Load FEMA properties using the same tile-based approach as county properties.
  // Splits the viewport into small FEMA_TILE_SIZE tiles, checks each tile against
  // storm swath polygons (chunkOverlapsSwath), and only queries the FEMA NSI API
  // for tiles that actually overlap a swath. This prevents loading properties across
  // the entire bounding box of elongated storm swaths.
  const FEMA_TILE_SIZE = 0.05; // same as county property tile size

  function getFemaTileKeys(viewBbox) {
    const [w, s, e, n] = viewBbox;
    const keys = [];
    const minX = Math.floor(w / FEMA_TILE_SIZE);
    const maxX = Math.floor(e / FEMA_TILE_SIZE);
    const minY = Math.floor(s / FEMA_TILE_SIZE);
    const maxY = Math.floor(n / FEMA_TILE_SIZE);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const tileW = x * FEMA_TILE_SIZE;
        const tileS = y * FEMA_TILE_SIZE;
        const tileE = (x + 1) * FEMA_TILE_SIZE;
        const tileN = (y + 1) * FEMA_TILE_SIZE;
        keys.push({ key: `fema:${x}:${y}`, bbox: [tileW, tileS, tileE, tileN] });
      }
    }
    return keys;
  }

  const loadFemaProperties = useCallback(async (map) => {
    if (!map || !cacheRestoredRef.current) return;
    if (!layersRef.current.properties || !showFemaRef.current) return;
    const zoom = map.getZoom();
    // Skip if no storm swaths loaded at all
    if (stormFeaturesRef.current.length === 0) return;

    const bounds = map.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const viewBbox = [sw.lng(), sw.lat(), ne.lng(), ne.lat()];

    // FEMA data stays in memory for the session — no viewport purge.
    // The 50k cap prevents unbounded growth; data persists as you pan around.
    const FEMA_CAP = 100000;
    if (femaCountRef.current >= FEMA_CAP) { setFemaLoading(false); return; }

    // Early exit: don't fetch FEMA data unless the viewport actually intersects storm swath polygons
    if (!viewportHasSwaths(viewBbox)) { setFemaLoading(false); return; }

    // Build list of tiles in the viewport that haven't been loaded yet
    // AND that overlap a storm swath polygon (not just bounding box)
    const allTiles = getFemaTileKeys(viewBbox);
    const unloadedTiles = allTiles.filter(t =>
      !femaLoadedTilesRef.current.has(t.key) && chunkOverlapsSwath(t.bbox)
    );

    if (unloadedTiles.length === 0) { setFemaLoading(false); return; }

    // Abort previous FEMA session
    if (femaAbortRef.current) femaAbortRef.current.abort();
    const femaAbort = new AbortController();
    femaAbortRef.current = femaAbort;

    setFemaLoading(true);

    // Build spatial grid once for dedup against existing DB properties
    const CELL = 0.0003;
    const grid = new Set();
    for (const existing of propFeaturesRef.current) {
      if (!existing.geometry?.coordinates) continue;
      const [eLng, eLat] = existing.geometry.coordinates;
      grid.add(`${Math.round(eLat / CELL)},${Math.round(eLng / CELL)}`);
    }

    // Fetch FEMA data tile-by-tile with incremental rendering.
    // Rebuild clusters every few tiles so dots appear progressively
    // and yield to the main thread to keep touch/pan responsive.
    let batchNew = [];
    const FLUSH_EVERY = 3;
    let tilesSinceFlush = 0;

    const flushedTileKeys = [];
    const flushBatch = () => {
      if (batchNew.length === 0) return;
      for (const nf of batchNew) propFeaturesRef.current.push(nf);
      femaCountRef.current += batchNew.length;
      rebuildClusterIndex(true);
      if (canvasOverlayRef.current) canvasOverlayRef.current.requestDraw();
      // Cache to IndexedDB in background
      cacheProperties(batchNew);
      batchNew = [];
    };

    for (const tile of unloadedTiles) {
      if (femaAbort.signal.aborted) break;
      if (femaCountRef.current + batchNew.length >= FEMA_CAP) break;

      try {
        const [tw, ts, te, tn] = tile.bbox;
        const femaRes = await getFemaLiveProperties({
          west: tw, south: ts, east: te, north: tn,
          signal: femaAbort.signal,
        });
        const rawFeatures = femaRes.data?.features || [];

        // Filter to only points actually inside a storm swath polygon (not just bbox)
        const femaFeatures = rawFeatures.filter(f => {
          const [fLng, fLat] = f.geometry?.coordinates || [];
          return fLng != null && fLat != null && pointInsideAnySwath(fLng, fLat, stormFeaturesRef.current);
        });

        for (const f of femaFeatures) {
          if (femaCountRef.current + batchNew.length >= FEMA_CAP) break;
          const pid = f.id;
          if (propIdSetRef.current.has(pid)) continue;
          const [fLng, fLat] = f.geometry.coordinates;
          if (grid.has(`${Math.round(fLat / CELL)},${Math.round(fLng / CELL)}`)) continue;
          propIdSetRef.current.add(pid);
          batchNew.push(f);
          grid.add(`${Math.round(fLat / CELL)},${Math.round(fLng / CELL)}`);
        }

        femaLoadedTilesRef.current.add(tile.key);
        flushedTileKeys.push(tile.key);

        // Flush every few tiles — dots appear progressively, main thread stays responsive
        tilesSinceFlush++;
        if (tilesSinceFlush >= FLUSH_EVERY) {
          flushBatch();
          tilesSinceFlush = 0;
          // Yield to main thread so touch/pan events can process
          await new Promise(r => setTimeout(r, 0));
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.name === 'CanceledError') break;
        console.warn('FEMA tile fetch failed:', err.message);
      }
    }

    // Flush any remaining
    flushBatch();
    // Cache tile keys to IndexedDB so restored FEMA features don't re-fetch
    if (flushedTileKeys.length > 0) cacheTileKeys(flushedTileKeys);

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
      hail:         { label: 'Hail',    color: 'oklch(0.78 0.17 85)' },
      wind:         { label: 'Wind',    color: 'oklch(0.70 0.18 330)' },
      tornado:      { label: 'Tornado', color: 'oklch(0.62 0.26 15)' },
      thunderstorm: { label: 'Severe Thunderstorm', color: 'oklch(0.72 0.17 65)' },
      drift:        { label: 'Hail (Drift Corrected)', color: 'oklch(0.78 0.12 200)' },
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
          const filterFiniteLatLngs = (arr) => arr.filter(ll => Number.isFinite(ll.lat()) && Number.isFinite(ll.lng()));
          const polysToCheck = [];
          if (gType === 'Polygon') {
            const paths = filterFiniteLatLngs(geom.getAt(0).getArray());
            if (paths.length >= 3) polysToCheck.push(new google.maps.Polygon({ paths }));
          } else {
            geom.getArray().forEach((subGeom) => {
              if (subGeom.getType() === 'Polygon') {
                const paths = filterFiniteLatLngs(subGeom.getAt(0).getArray());
                if (paths.length >= 3) polysToCheck.push(new google.maps.Polygon({ paths }));
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
        const validPaths = ring
          .filter(c => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
          .map(c => ({ lat: c[1], lng: c[0] }));
        if (validPaths.length < 3) continue;
        const poly = new google.maps.Polygon({ paths: validPaths });
        if (google.maps.geometry.poly.containsLocation(pos, poly)) {
          p.storm_event_id = sf.id || sf.properties?.storm_event_id;
          if (!p.storm_date && sf.properties?.event_start) p.storm_date = sf.properties.event_start;
          if (!p.storm_hail_size && sf.properties?.hail_size_max_in) p.storm_hail_size = sf.properties.hail_size_max_in;
          if (!p.storm_wind_speed && sf.properties?.wind_speed_max_mph) p.storm_wind_speed = sf.properties.wind_speed_max_mph;
          if (!p._swathType) {
            const rawType = sf.properties?.raw_data?.type || '';
            if (rawType === 'hail' || sf.properties?.hail_size_max_in) {
              p._swathType = 'Hail'; p._swathColor = 'oklch(0.78 0.17 85)';
            } else if (rawType === 'tornado') {
              p._swathType = 'Tornado'; p._swathColor = 'oklch(0.62 0.26 15)';
            } else if (rawType === 'severe_thunderstorm') {
              p._swathType = 'Severe Thunderstorm'; p._swathColor = 'oklch(0.72 0.17 65)';
            } else {
              p._swathType = 'Wind'; p._swathColor = 'oklch(0.70 0.18 330)';
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
      label.style.cssText = 'color:oklch(0.82 0 0);font-size:11px;text-shadow:0 0 4px oklch(0 0 0 / 0.8);white-space:nowrap;pointer-events:none;';
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
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi.sports_complex', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi.place_of_worship', stylers: [{ visibility: 'off' }] },
          { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'on' }] },
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
              fillOpacity: swathOpacityRef.current,
              strokeColor: sc.stroke,
              strokeWeight: 1.5,
              strokeOpacity: Math.min(swathOpacityRef.current + 0.25, 1),
            };
          }
          // Wind severity graduation — colored by wind speed (mph)
          if (key === 'wind') {
            const windSpeed = feature.getProperty('wind_speed_max_mph');
            const sc = windSeverityColor(windSpeed);
            return {
              fillColor: sc.fill,
              fillOpacity: swathOpacityRef.current * 0.29,
              strokeColor: sc.stroke,
              strokeWeight: 1.5,
              strokeOpacity: 0.85,
            };
          }
          // Tornado severity graduation — colored by EF scale
          if (key === 'tornado') {
            const sc = tornadoSeverityColor(feature);
            return {
              fillColor: sc.fill,
              fillOpacity: swathOpacityRef.current * 0.43,
              strokeColor: sc.stroke,
              strokeWeight: 3,
              strokeOpacity: 0.85,
            };
          }
          const fillOpacity = key === 'drift' ? swathOpacityRef.current * 0.23 : swathOpacityRef.current * 0.29;
          return {
            fillColor: c.fill,
            fillOpacity,
            strokeColor: c.stroke,
            strokeWeight: key === 'drift' ? 1.5 : 2.5,
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

      // Refresh labels on zoom change + track zoom level
      map.addListener('zoom_changed', () => {
        updatePropertyLabels(map, propFeaturesRef.current);
        setCurrentZoom(Math.floor(map.getZoom()));
      });
      setCurrentZoom(Math.floor(map.getZoom()));

      // Save viewport + load properties on pan/zoom (storms stay loaded)
      map.addListener('idle', () => {
        const c = map.getCenter();
        sessionStorage.setItem('stormMapViewport', JSON.stringify({ lat: c.lat(), lng: c.lng(), zoom: map.getZoom() }));
        clearTimeout(swathDebounceRef.current);
        swathDebounceRef.current = setTimeout(() => loadSwathProperties(map), 500);
        // FEMA loading — show indicator immediately if there are likely unloaded tiles
        clearTimeout(femaDebounceRef.current);
        if (showFemaRef.current && layersRef.current.properties && stormFeaturesRef.current.length > 0) {
          const bounds = map.getBounds();
          if (bounds) {
            const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
            const vb = [sw.lng(), sw.lat(), ne.lng(), ne.lat()];
            const tiles = getFemaTileKeys(vb);
            const hasUnloaded = tiles.some(t => !femaLoadedTilesRef.current.has(t.key));
            if (hasUnloaded) setFemaLoading(true);
          }
        }
        femaDebounceRef.current = setTimeout(() => loadFemaProperties(map), 800);
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
            <div class="swath-popup__title" style="color:${isFema ? 'oklch(0.70 0.18 300)' : 'oklch(0.75 0.18 170)'}">${isFema ? 'FEMA Property' : 'County Property'}</div>
            <div class="swath-popup__sv" style="width:100%;height:150px;border-radius:6px;margin-bottom:8px;overflow:hidden;background:oklch(0.12 0.02 260);display:none;"></div>
            <div class="swath-popup__row">
              <span class="swath-popup__label">Address</span>
              <span class="swath-popup__value swath-popup__address">${isFema && !p.address_line1 ? '<button class="resolve-addr-btn" style="background:none;border:1px solid oklch(0.70 0.18 300 / 0.4);color:oklch(0.70 0.18 300);border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;font-weight:600;">Enter Address #</button>' : formatFullAddr(p.address_line1, p.city, p.state, p.zip)}</span>
            </div>
            ${owner ? `<div class="swath-popup__row"><span class="swath-popup__label">Owner <span style="color:oklch(0.60 0.01 260);font-size:9px;font-weight:400;">· Public records</span></span><span class="swath-popup__value">${owner}</span></div>` : ''}
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
                <span class="swath-popup__title" style="color:${p._swathColor || 'oklch(0.78 0.17 85)'};font-size:12px;margin:0;">Weather Event</span>
                <span style="color:${p._swathColor || 'oklch(0.78 0.17 85)'};font-size:12px;font-weight:600;">${eventTypeLabel}</span>
              </div>
              ${stormDate ? `<div class="swath-popup__row"><span class="swath-popup__label">Date</span><span class="swath-popup__value">${stormDate}</span></div>` : ''}
              <div class="swath-popup__row"><span class="swath-popup__label">Hail Size</span><span class="swath-popup__value" style="color:${p.storm_hail_size ? (p._swathColor || 'oklch(0.78 0.17 85)') : 'var(--text-muted)'}">${p.storm_hail_size ? p.storm_hail_size + '"' : 'N/A'}</span></div>
              <div class="swath-popup__row"><span class="swath-popup__label">Wind Speed</span><span class="swath-popup__value" style="color:${p.storm_wind_speed ? (p._swathColor || 'oklch(0.70 0.18 330)') : 'var(--text-muted)'}">${p.storm_wind_speed ? p.storm_wind_speed + ' mph' : 'N/A'}</span></div>
              ${p._stormSeverity ? `<div class="swath-popup__row"><span class="swath-popup__label">Rating</span><span class="swath-popup__value" style="color:${severityColor(p._stormSeverity)}">${p._stormSeverity}</span></div>` : ''}
              ${p._stormCertainty ? `<div class="swath-popup__row"><span class="swath-popup__label">Certainty</span><span class="swath-popup__value">${p._stormCertainty}</span></div>` : ''}
              ${p._stormArea ? `<div class="swath-popup__row"><span class="swath-popup__label">Area</span><span class="swath-popup__value">${p._stormArea}</span></div>` : ''}
            </div>` : ''}
            <div class="storm-history-slot" data-lat="${posLat}" data-lng="${posLng}" style="border-top:1px solid oklch(1 0 0 / 0.08);margin:6px 0;padding-top:6px;">
              <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);padding:4px 0;">
                <div class="storm-map-loading__spinner" style="width:12px;height:12px;border-width:2px;"></div>Loading hail risk score…
              </div>
            </div>
            <button class="add-to-pipeline-btn" data-property-id="${propertyId}" ${stormId ? `data-storm-id="${stormId}"` : ''} ${isFema ? 'data-fema="true"' : ''} data-lat="${posLat}" data-lng="${posLng}" style="
              width:100%;margin-top:8px;padding:8px 12px;
              background:oklch(0.65 0.18 230);color:oklch(1 0 0);border:none;border-radius:6px;
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
                  btn.style.background = 'oklch(0.58 0.22 25)';
                  setTimeout(() => { btn.textContent = 'Add to Pipeline'; btn.style.background = 'oklch(0.65 0.18 230)'; btn.disabled = false; }, 2000);
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
              btn.style.background = 'oklch(0.72 0.19 150)';
            } catch (err) {
              const msg = err.response?.data?.error || 'Failed to add';
              btn.textContent = msg;
              btn.style.background = 'oklch(0.58 0.22 25)';
              setTimeout(() => { btn.textContent = 'Add to Pipeline'; btn.style.background = 'oklch(0.65 0.18 230)'; btn.disabled = false; }, 2000);
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

        // Reverse geocode FEMA properties — get street/city/state/zip, let roofer type house number
        const resolveBtn = container.querySelector('.resolve-addr-btn');
        if (resolveBtn) {
          resolveBtn.addEventListener('click', async () => {
            const addrEl = container.querySelector('.swath-popup__address');
            if (!addrEl) return;
            resolveBtn.disabled = true;
            resolveBtn.textContent = 'Looking up street…';
            try {
              const { data } = await client.get('/properties/reverse-geocode', { params: { lat: posLat, lng: posLng } });
              if (data.matched) {
                // Extract street name without house number
                const streetName = (data.address || '').replace(/^\d+\s*/, '').trim();
                const cityLine = [data.city, data.state, data.zip].filter(Boolean).join(', ');

                addrEl.innerHTML = `
                  <div style="display:flex;flex-direction:column;gap:4px;">
                    <div style="display:flex;align-items:center;gap:4px;">
                      <input class="fema-house-num" type="text" placeholder="#" style="
                        width:52px;padding:3px 6px;font-size:12px;font-weight:700;
                        background:oklch(0.15 0.02 260);color:oklch(0.95 0 0);
                        border:1.5px solid oklch(0.70 0.18 300);border-radius:4px;
                        outline:none;text-align:center;
                      " />
                      <span style="font-size:12px;color:var(--text-primary);">${titleCase(streetName)}</span>
                    </div>
                    <span style="font-size:11px;color:var(--text-secondary);">${cityLine}</span>
                    <span style="font-size:9px;color:oklch(0.70 0.18 300);">↑ Type the house # from the map</span>
                  </div>
                `;

                // Focus the input and pan map down so address number label is visible below the popup
                const numInput = addrEl.querySelector('.fema-house-num');
                if (numInput) {
                  setTimeout(() => {
                    numInput.focus();
                    // Pan map up so the property (and its number label) is visible below the InfoWindow
                    if (mapRef.current) mapRef.current.panBy(0, -80);
                  }, 150);

                  // When they type and press Enter or blur, save the full address
                  const saveAddress = () => {
                    const num = numInput.value.trim();
                    if (num) {
                      const fullStreet = `${num} ${titleCase(streetName)}`;
                      p.address_line1 = fullStreet;
                      p.city = data.city || '';
                      p.state = data.state || '';
                      p.zip = data.zip || '';
                      addrEl.innerHTML = formatFullAddr(fullStreet, data.city, data.state, data.zip);
                    }
                  };
                  numInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveAddress(); });
                  numInput.addEventListener('blur', saveAddress);
                }
              } else {
                addrEl.innerHTML = `<span style="color:var(--text-muted);">${posLat.toFixed(5)}, ${posLng.toFixed(5)}</span>`;
              }
            } catch {
              addrEl.innerHTML = `<span style="color:var(--text-muted);">${posLat.toFixed(5)}, ${posLng.toFixed(5)}</span>`;
            }
          });
        }

        // Auto-load storm history from NOAA SWDI
        const historySlot = container.querySelector('.storm-history-slot');
        if (historySlot) {
          (async () => {
            try {
              const hLat = parseFloat(historySlot.dataset.lat);
              const hLng = parseFloat(historySlot.dataset.lng);
              const res = await getStormHistory(hLat, hLng, { radius: 5, years: 10 });
              const s = res.data?.summary;
              if (!s || s.totalEvents === 0) {
                historySlot.innerHTML = `
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span class="swath-popup__title" style="color:oklch(0.75 0.15 170);font-size:12px;margin:0;">Hail Risk Score</span>
                    <span style="color:oklch(0.72 0.19 150);font-size:11px;font-weight:600;">Low Risk</span>
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);">No hail events detected within 5 miles in the last 10 years.</div>`;
                return;
              }
              const riskColors = { low: 'oklch(0.72 0.19 150)', moderate: 'oklch(0.78 0.17 85)', high: 'oklch(0.70 0.20 40)', extreme: 'oklch(0.65 0.25 25)' };
              const riskColor = riskColors[s.riskLevel] || riskColors.moderate;
              // Build year-by-year mini bar chart
              const years = Object.keys(s.byYear).sort();
              const maxCount = Math.max(...Object.values(s.byYear), 1);
              let barHtml = '';
              if (years.length > 0) {
                barHtml = '<div style="display:flex;align-items:flex-end;gap:2px;height:32px;margin-top:6px;">';
                // Show last 10 years, fill gaps with 0
                const endYear = new Date().getFullYear();
                for (let y = endYear - 9; y <= endYear; y++) {
                  const count = s.byYear[y] || 0;
                  const pct = Math.max((count / maxCount) * 100, count > 0 ? 8 : 2);
                  const barColor = count === 0 ? 'oklch(0.30 0.01 260)' : riskColor;
                  barHtml += `<div title="${y}: ${count} events" style="flex:1;height:${pct}%;background:${barColor};border-radius:2px 2px 0 0;min-height:2px;transition:height 0.3s;"></div>`;
                }
                barHtml += '</div>';
                barHtml += '<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text-muted);margin-top:2px;">';
                barHtml += `<span>${endYear - 9}</span><span>${endYear}</span>`;
                barHtml += '</div>';
              }
              historySlot.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <span class="swath-popup__title" style="color:${riskColor};font-size:12px;margin:0;">Hail Risk Score</span>
                  <span style="color:${riskColor};font-size:11px;font-weight:700;text-transform:uppercase;">${s.riskLevel} Risk</span>
                </div>
                <div class="swath-popup__row"><span class="swath-popup__label">Hail Events</span><span class="swath-popup__value" style="color:${riskColor}">${s.hailCount}</span></div>
                <div class="swath-popup__row"><span class="swath-popup__label">Tornado Events</span><span class="swath-popup__value">${s.tornadoCount}</span></div>
                ${s.maxHailSizeInches ? `<div class="swath-popup__row"><span class="swath-popup__label">Max Hail Size</span><span class="swath-popup__value" style="color:${riskColor}">${s.maxHailSizeInches}"</span></div>` : ''}
                <div class="swath-popup__row"><span class="swath-popup__label">Avg/Year</span><span class="swath-popup__value">${s.averageEventsPerYear}</span></div>
                ${barHtml}`;
            } catch {
              historySlot.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">Hail risk score unavailable</div>';
            }
          })();
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
        // Separate DB and FEMA features from cache
        const dbFeatures = [];
        const cachedFema = [];
        for (const f of cachedFeatures) {
          if (f.properties?.data_source === 'fema_nsi_live') {
            cachedFema.push(f);
          } else {
            dbFeatures.push(f);
          }
        }

        // Restore DB properties (they don't need swath context)
        if (dbFeatures.length > 0) {
          propFeaturesRef.current = dbFeatures;
          for (const f of dbFeatures) {
            const pid = f.id || f.properties?.id;
            if (pid) propIdSetRef.current.add(pid);
          }
          for (const key of cachedTiles) {
            if (key.startsWith('fema:')) continue; // FEMA tiles restored after swaths load
            loadedTilesRef.current.add(key);
          }
          // Yield before heavy cluster rebuild so map renders first
          await new Promise(r => setTimeout(r, 0));
          rebuildClusterIndex(true);
          if (canvasOverlayRef.current) canvasOverlayRef.current.requestDraw();
        }
        cacheRestoredRef.current = true;

        await loadStorms(map);

        // Now that swaths are loaded, restore cached FEMA features that fall inside swaths.
        // Process in chunks to avoid blocking the main thread (Chrome "page unresponsive").
        if (cachedFema.length > 0 && stormFeaturesRef.current.length > 0) {
          const CHUNK = 500;
          let restoredCount = 0;
          for (let i = 0; i < cachedFema.length; i += CHUNK) {
            const chunk = cachedFema.slice(i, i + CHUNK);
            for (const f of chunk) {
              const [fLng, fLat] = f.geometry?.coordinates || [];
              if (fLng == null || fLat == null) continue;
              if (!pointInsideAnySwath(fLng, fLat, stormFeaturesRef.current)) continue;
              const pid = f.id || f.properties?.id;
              if (pid && !propIdSetRef.current.has(pid)) {
                propIdSetRef.current.add(pid);
                propFeaturesRef.current.push(f);
                femaCountRef.current++;
                restoredCount++;
              }
            }
            // Yield to main thread between chunks so UI stays responsive
            if (i + CHUNK < cachedFema.length) await new Promise(r => setTimeout(r, 0));
          }
          // Restore FEMA tile keys so tiles aren't re-fetched
          for (const key of cachedTiles) {
            if (key.startsWith('fema:')) femaLoadedTilesRef.current.add(key);
          }
          if (restoredCount > 0) {
            rebuildClusterIndex(true);
            if (canvasOverlayRef.current) canvasOverlayRef.current.requestDraw();
          }
        }

        loadSwathProperties(map);
        // FEMA loading is triggered by the map's idle listener (2s debounce).
        // Don't call it explicitly here — doing so races with the idle debounce,
        // which aborts the in-progress fetch and restarts. Let the idle handler
        // that already fired during loadStorms settle and trigger FEMA naturally.
        // Force-trigger the idle handler's FEMA debounce now that swaths are loaded:
        clearTimeout(femaDebounceRef.current);
        femaDebounceRef.current = setTimeout(() => loadFemaProperties(map), 2000);
        initialLoadDoneRef.current = true;

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
      if (femaAbortRef.current) femaAbortRef.current.abort();
      clearTimeout(swathDebounceRef.current);
      clearTimeout(femaDebounceRef.current);
      clearTimeout(rebuildTimerRef.current);
      // Free large data structures
      propFeaturesRef.current = [];
      stormFeaturesRef.current = [];
      clusterIndexRef.current = null;
      swathPropCacheRef.current.clear();
      swathLoadedRef.current.clear();
      propIdSetRef.current.clear();
      loadedTilesRef.current.clear();
      femaLoadedTilesRef.current.clear();
      femaCountRef.current = 0;
      mapRef.current = null;
    };
  }, []);

  // Reload storms and clear property cache when time filter changes.
  // Uses a ref to track the previous timeRange so it only fires on actual changes,
  // not on initial mount (the idle-based init flow handles the first load).
  const prevTimeRangeRef = useRef(timeRange);
  useEffect(() => {
    if (prevTimeRangeRef.current === timeRange) return; // skip initial mount
    prevTimeRangeRef.current = timeRange;
    if (mapRef.current) {
      if (swathAbortRef.current) swathAbortRef.current.abort();
      if (femaAbortRef.current) femaAbortRef.current.abort();
      swathPropCacheRef.current.clear();
      swathLoadedRef.current.clear();
      propIdSetRef.current.clear();
      loadedTilesRef.current.clear();
      femaLoadedTilesRef.current.clear();
      femaCountRef.current = 0;
      clearPropertyCache();
      setSwathProgress(null);
      propFeaturesRef.current = [];
      clusterIndexRef.current = null;
      loadStorms(mapRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

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

    // Toggle labels and abort loads when properties unchecked
    if (!layers.properties) {
      for (const lbl of propLabelsRef.current) lbl.map = null;
      // Abort any in-progress property loading
      if (swathAbortRef.current) swathAbortRef.current.abort();
      if (femaAbortRef.current) femaAbortRef.current.abort();
      setSwathProgress(null);
      setFemaLoading(false);
    } else {
      for (const lbl of propLabelsRef.current) lbl.map = map;
      // Resume loading when toggled back on
      if (map) {
        loadSwathProperties(map);
        loadFemaProperties(map);
      }
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
        <div class="swath-popup__title" style="color:oklch(0.65 0.18 230)">${error ? 'Search Result' : created ? 'New Property Added' : 'Existing Property'}</div>
        <div class="swath-popup__sv" style="width:100%;height:150px;border-radius:6px;margin-bottom:8px;overflow:hidden;background:oklch(0.12 0.02 260);display:none;"></div>
        <div class="swath-popup__row">
          <span class="swath-popup__label">Address</span>
          <span class="swath-popup__value">${formatFullAddr(addr.address_line1, addr.city, addr.state, addr.zip)}</span>
        </div>
        ${owner ? `<div class="swath-popup__row"><span class="swath-popup__label">Owner <span style="color:oklch(0.60 0.01 260);font-size:9px;font-weight:400;">· Public records</span></span><span class="swath-popup__value">${owner}</span></div>` : ''}
        ${value ? `<div class="swath-popup__row"><span class="swath-popup__label">Value</span><span class="swath-popup__value">${value}</span></div>` : ''}
        ${p.year_built ? `<div class="swath-popup__row"><span class="swath-popup__label">Year Built</span><span class="swath-popup__value">${p.year_built}</span></div>` : ''}
        ${p.property_sqft ? `<div class="swath-popup__row"><span class="swath-popup__label">Building Sqft</span><span class="swath-popup__value">${Number(p.property_sqft).toLocaleString()}</span></div>` : ''}
        ${p.roof_type ? `<div class="swath-popup__row"><span class="swath-popup__label">Roof Type</span><span class="swath-popup__value">${p.roof_type}</span></div>` : ''}
        ${p.roof_pitch_degrees ? `<div class="swath-popup__row"><span class="swath-popup__label">Pitch</span><span class="swath-popup__value">${p.roof_pitch_degrees}°</span></div>` : ''}
        ${p.fema_bldg_type ? `<div class="swath-popup__row"><span class="swath-popup__label">Structure</span><span class="swath-popup__value">${femaLabel('bldg', p.fema_bldg_type)}</span></div>` : ''}
        ${p.fema_foundation_type ? `<div class="swath-popup__row"><span class="swath-popup__label">Foundation</span><span class="swath-popup__value">${femaLabel('found', p.fema_foundation_type)}</span></div>` : ''}
        ${!p.fema_bldg_type && !p.fema_foundation_type && !p.fema_num_stories && property ? `<div class="fema-auto-slot" data-property-id="${property.id}" style="margin:4px 0;"><div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted);padding:4px 0;"><div class="storm-map-loading__spinner" style="width:12px;height:12px;border-width:2px;"></div>Loading building details...</div></div>` : ''}
        ${error ? `<div class="swath-popup__row"><span class="swath-popup__value" style="color:oklch(0.58 0.22 25);font-size:12px">${error}</span></div>` : ''}
        ${property ? `<button class="add-to-pipeline-btn" data-property-id="${property.id}" style="
          width:100%;margin-top:8px;padding:8px 12px;
          background:oklch(0.65 0.18 230);color:oklch(1 0 0);border:none;border-radius:6px;
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
          btn.style.background = 'oklch(0.72 0.19 150)';
        } catch (err) {
          btn.textContent = err.response?.data?.error || 'Failed';
          btn.style.background = 'oklch(0.58 0.22 25)';
          setTimeout(() => { btn.textContent = 'Add to Pipeline'; btn.style.background = 'oklch(0.65 0.18 230)'; btn.disabled = false; }, 2000);
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

  /* ── Mobile: derive storm feed data from loaded properties ── */
  const mobileStormFeed = useMemo(() => {
    if (!isMobile) return [];
    const features = propFeaturesRef.current;
    // Take the most recent / interesting properties for the feed
    return features.slice(0, 50).map((f, i) => {
      const p = f.properties || {};
      const owner = formatOwner(p.owner_first_name, p.owner_last_name);
      const street = p.address_line1 ? titleCase(cleanAddr(p.address_line1)) : 'Unknown Address';
      const city = p.city ? titleCase(p.city) : '';
      const state = p.state?.toUpperCase() || '';
      const location = [city, state].filter(Boolean).join(', ');
      const hailSize = p.hail_size_in || p.hail_size_max_in;
      const windSpeed = p.wind_speed_mph || p.wind_speed_max_mph;
      const distance = p.distance_miles;
      const isFema = p.data_source === 'fema_nsi_live';
      // Determine severity for left bar color
      let severity = 'primary'; // cyan
      if (windSpeed && windSpeed >= 70) severity = 'error'; // red
      else if (hailSize && hailSize >= 1.5) severity = 'secondary'; // amber
      return { id: p.id || i, owner, street, location, hailSize, windSpeed, distance, isFema, severity };
    });
  }, [isMobile, propFeaturesRef.current?.length]);

  // Active storm cell info for the floating glass panel
  const activeStormInfo = useMemo(() => {
    if (!isMobile) return null;
    const storms = stormFeaturesRef.current;
    if (!storms.length) return { name: 'NO ACTIVE CELLS', desc: 'No storm data in view.', active: false };
    // Pick the most recent/significant storm
    const s = storms[0];
    const sp = s.properties || {};
    const hail = sp.hail_size_max_in ? `Hail: ${sp.hail_size_max_in}"` : '';
    const wind = sp.wind_speed_max_mph ? `Wind: ${sp.wind_speed_max_mph}mph` : '';
    const name = sp.event_name || sp.wfo || sp.storm_event_id || 'STORM CELL';
    const desc = [hail, wind].filter(Boolean).join('. ') || 'Storm detected in area.';
    return { name: `ACTIVE CELL: ${String(name).toUpperCase()}`, desc, active: true };
  }, [isMobile, stormFeaturesRef.current?.length]);

  const totalPropertyCount = propFeaturesRef.current.length;
  const impactZoneCount = useMemo(() => {
    if (!isMobile) return 0;
    return propFeaturesRef.current.filter(f => {
      const p = f.properties || {};
      return p.hail_size_in || p.wind_speed_mph || p.hail_size_max_in || p.wind_speed_max_mph;
    }).length;
  }, [isMobile, propFeaturesRef.current?.length]);

  /* ── Mobile layout ────────────────────────────────────────── */
  if (isMobile) {
    const mobileStyles = {
      wrapper: {
        display: 'flex', flexDirection: 'column', width: '100%',
        background: 'var(--bg-deep)', minHeight: '100vh', paddingBottom: 88,
      },
      mapSection: {
        position: 'relative', width: '100%', height: '442px', flexShrink: 0, overflow: 'hidden',
      },
      mapGradientOverlay: {
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to top right, oklch(0.10 0.02 260 / 0.4), transparent)',
        zIndex: 2,
      },
      floatingPanel: {
        position: 'absolute', top: '16px', left: '16px', zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '280px',
      },
      glassCard: {
        backdropFilter: 'blur(20px)', background: 'oklch(0.10 0.02 260 / 0.7)',
        padding: '16px', borderRadius: '12px', borderLeft: '2px solid var(--accent-cyan)',
        boxShadow: '0 4px 20px oklch(0 0 0 / 0.3)',
      },
      pulseContainer: {
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
      },
      pulseDot: {
        width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-cyan)',
        boxShadow: '0 0 8px var(--accent-cyan)', position: 'relative', flexShrink: 0,
      },
      radarLabel: {
        fontFamily: 'inherit', fontSize: '10px', letterSpacing: '0.1em',
        textTransform: 'uppercase', fontWeight: 700, color: 'oklch(0.90 0.06 200)',
      },
      cellHeading: {
        fontFamily: 'inherit', fontSize: '18px', fontWeight: 700,
        lineHeight: 1.2, color: 'var(--text-primary)',
      },
      cellDesc: {
        fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'inherit', marginTop: '4px',
      },
      layerButtons: {
        display: 'flex', gap: '8px',
      },
      layerBtnBase: {
        backdropFilter: 'blur(12px)', background: 'oklch(0.18 0.02 260 / 0.8)',
        padding: '8px 12px', borderRadius: '8px', border: 'none',
        borderBottom: '1px solid oklch(0.60 0.01 200 / 0.3)',
        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
        color: 'var(--text-primary)',
      },
      layerBtnActive: {
        background: 'var(--accent-cyan)', color: 'oklch(0.25 0.06 200)',
        padding: '8px 12px', borderRadius: '8px', border: 'none',
        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
      },
      layerBtnLabel: {
        fontFamily: 'inherit', fontSize: '10px',
        textTransform: 'uppercase', fontWeight: 700,
      },
      aside: {
        background: 'oklch(0.10 0.02 260)', borderTop: '1px solid oklch(0.35 0.02 260 / 0.1)',
        padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
        zIndex: 10,
      },
      feedHeader: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      },
      feedTitle: {
        fontFamily: 'inherit', fontSize: '20px', fontWeight: 700,
        letterSpacing: '-0.02em', color: 'var(--text-primary)',
      },
      statsGrid: {
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
      },
      statCard: {
        background: 'var(--bg-surface)', padding: '16px', borderRadius: '12px',
        borderBottom: '1px solid oklch(0.35 0.02 180 / 0.1)',
      },
      statLabel: {
        fontFamily: 'inherit', fontSize: '10px', color: 'var(--text-muted)',
        textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px',
      },
      statValue: {
        fontFamily: 'inherit', fontSize: '24px', fontWeight: 700,
      },
      feedScroll: {
        display: 'flex', flexDirection: 'column', gap: '12px',
      },
      feedCard: {
        background: 'oklch(0.16 0.02 260)', padding: '16px', borderRadius: '12px',
        position: 'relative', overflow: 'hidden',
      },
      feedCardBar: (color) => ({
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
        background: color === 'error' ? 'var(--accent-red)' : color === 'secondary' ? 'var(--accent-amber)' : 'var(--accent-cyan)',
      }),
      feedCardHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px',
      },
      feedCardName: {
        fontFamily: 'inherit', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)',
      },
      feedCardAddr: {
        fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px',
      },
      feedCardTags: {
        display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap',
      },
      tag: (color) => ({
        background: 'oklch(0.10 0.02 260)', padding: '4px 8px', borderRadius: '4px',
        fontSize: '10px', fontFamily: 'inherit', fontWeight: 700,
        color: color || 'var(--text-muted)',
        border: color ? `1px solid ${color}33` : 'none',
      }),
      canvassingBtn: {
        marginTop: 'auto', width: '100%', padding: '16px',
        background: 'linear-gradient(to right, oklch(0.78 0.12 200), oklch(0.80 0.12 200))',
        color: 'oklch(0.25 0.06 200)', border: 'none', borderRadius: '12px',
        fontFamily: 'inherit', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '14px',
        boxShadow: '0 4px 20px oklch(0.82 0.15 200 / 0.2)', cursor: 'pointer',
      },
    };

    const severityColors = { primary: 'var(--accent-cyan)', secondary: 'var(--accent-amber)', error: 'var(--accent-red)' };

    return (
      <div style={{ padding: 0, overflow: 'auto', gridRow: '2 / -1' }}>
        <div style={mobileStyles.wrapper}>
          {/* ── Map Section ── */}
          <div style={mobileStyles.mapSection}>
            <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
            <div style={mobileStyles.mapGradientOverlay} />

            {/* Loading overlay */}
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

            {/* Zoom level indicator */}
            {currentZoom != null && (
              <div style={{
                position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                background: 'oklch(0.15 0 0 / 0.75)', backdropFilter: 'blur(8px)',
                color: currentZoom >= 14 ? 'oklch(0.85 0.15 150)' : 'oklch(0.7 0 0)',
                padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                fontFamily: 'monospace', pointerEvents: 'none', zIndex: 2,
              }}>
                Z{currentZoom}
              </div>
            )}

            {/* Floating Glass Panel */}
            <div style={mobileStyles.floatingPanel}>
              <div style={mobileStyles.glassCard}>
                <div style={mobileStyles.pulseContainer}>
                  <div style={mobileStyles.pulseDot} className="mobile-pulse-dot" />
                  <SignalIcon width={24} height={24} style={{ opacity: 0.9 }} />
                  <span style={mobileStyles.radarLabel}>Live Radar Status</span>
                </div>
                <h2 style={mobileStyles.cellHeading}>
                  {activeStormInfo?.name || 'NO ACTIVE CELLS'}
                </h2>
                <p style={mobileStyles.cellDesc}>
                  {activeStormInfo?.desc || 'No storm data in view.'}
                </p>
              </div>

              {/* Layer Toggle Buttons */}
              <div style={mobileStyles.layerButtons}>
                <button
                  style={mobileStyles.layerBtnBase}
                  onClick={() => {
                    const map = mapRef.current;
                    if (map) {
                      const type = map.getMapTypeId();
                      map.setMapTypeId(type === 'terrain' ? 'roadmap' : 'terrain');
                    }
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'oklch(0.90 0.06 200)' }}>layers</span>
                  <span style={mobileStyles.layerBtnLabel}>Terrain</span>
                </button>
                <button
                  style={layers.hail ? mobileStyles.layerBtnActive : { ...mobileStyles.layerBtnBase, background: 'var(--accent-cyan)', color: 'oklch(0.25 0.06 200)' }}
                  onClick={() => setLayers(prev => ({ ...prev, hail: !prev.hail }))}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>storm</span>
                  <span style={mobileStyles.layerBtnLabel}>Show Hail Trace</span>
                </button>
              </div>
            </div>

            {/* Address search bar (positioned at bottom of map) */}
            <div style={{ position: 'absolute', bottom: '12px', left: '16px', right: '16px', zIndex: 10 }}>
              <AddressSearch onSelect={handleAddressSelect} isLoading={searchLoading} />
            </div>
          </div>

          {/* ── Storm Feed Panel ── */}
          <aside style={mobileStyles.aside}>
            <div style={mobileStyles.feedHeader}>
              <h3 style={mobileStyles.feedTitle}>STORM FEED</h3>
              <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '20px' }}>filter_list</span>
            </div>

            {/* Stats Grid */}
            <div style={mobileStyles.statsGrid}>
              <div style={mobileStyles.statCard}>
                <p style={mobileStyles.statLabel}>Total Leads</p>
                <p style={{ ...mobileStyles.statValue, color: 'var(--accent-cyan)' }}>{totalPropertyCount.toLocaleString()}</p>
              </div>
              <div style={mobileStyles.statCard}>
                <p style={mobileStyles.statLabel}>In Impact Zone</p>
                <p style={{ ...mobileStyles.statValue, color: 'var(--accent-amber)' }}>{impactZoneCount.toLocaleString()}</p>
              </div>
            </div>

            {/* Scrollable Lead Feed */}
            <div style={mobileStyles.feedScroll}>
              {mobileStormFeed.length === 0 && !mapLoading && (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '40px', display: 'block', marginBottom: '8px', opacity: 0.4 }}>
                    location_searching
                  </span>
                  Zoom into a storm area to load properties
                </div>
              )}
              {mobileStormFeed.map((item) => (
                <div key={item.id} style={mobileStyles.feedCard}>
                  <div style={mobileStyles.feedCardBar(item.severity)} />
                  <div style={mobileStyles.feedCardHeader}>
                    <div style={{ paddingLeft: '8px' }}>
                      <h4 style={mobileStyles.feedCardName}>
                        {item.owner || item.street}
                      </h4>
                      <p style={mobileStyles.feedCardAddr}>
                        {item.owner ? item.street : ''}{item.location ? (item.owner ? `, ${item.location}` : item.location) : ''}
                      </p>
                    </div>
                    <BoltIcon width={20} height={20} style={{ opacity: 0.9 }} />
                  </div>
                  <div style={mobileStyles.feedCardTags}>
                    {item.hailSize && (
                      <div style={mobileStyles.tag('var(--accent-cyan)')}>
                        {item.hailSize}" HAIL
                      </div>
                    )}
                    {item.distance != null && (
                      <div style={mobileStyles.tag(null)}>
                        {Number(item.distance).toFixed(1)} MILES
                      </div>
                    )}
                    {item.windSpeed && (
                      <div style={mobileStyles.tag('var(--accent-amber)')}>
                        WIND {item.windSpeed}MPH
                      </div>
                    )}
                    {item.severity === 'error' && (
                      <div style={mobileStyles.tag('var(--accent-red)')}>
                        EMERGENCY
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Generate Canvassing List Button */}
            <button
              style={mobileStyles.canvassingBtn}
              onClick={async () => {
                const features = propFeaturesRef.current;
                if (!features.length) return;
                const batch = features.slice(0, 50);
                let created = 0;
                for (const f of batch) {
                  const p = f.properties || {};
                  const [lng, lat] = f.geometry?.coordinates || [];
                  if (!lat || !lng) continue;
                  const street = p.address_line1 ? cleanAddr(p.address_line1) : '';
                  const city = p.city || '';
                  const state = p.state || '';
                  const addr = [street, city, state].filter(Boolean).join(', ');
                  try {
                    await createCanvassPin({ lat, lng, address: addr || null, outcome: null, notes: `Storm property — ${p.hail_size_max_in ? p.hail_size_max_in + '" hail' : ''} ${p.wind_speed_max_mph ? p.wind_speed_max_mph + 'mph wind' : ''}`.trim() });
                    created++;
                  } catch { /* skip duplicates */ }
                }
                alert(`${created} canvassing pins created from ${batch.length} properties. View them in Canvassing mode.`);
              }}
            >
              Generate Canvassing List ({Math.min(propFeaturesRef.current.length, 50)} properties)
            </button>
          </aside>

          {/* Hidden: keep TimeFilter and LayerPanel mounted for state */}
          <div style={{ display: 'none' }}>
            <TimeFilter timeRange={timeRange} onTimeRangeChange={setTimeRange} />
            <LayerPanel
              layers={layers}
              onLayersChange={setLayers}
              improvedOnly={improvedOnly}
              onImprovedOnlyChange={setImprovedOnly}
              showFema={showFema}
              onShowFemaChange={setShowFema}
              showCounty={showCounty}
              onShowCountyChange={setShowCounty}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ── Desktop layout (unchanged) ────────────────────────────── */
  return (
    <div className="main-content storm-map-fullbleed" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="storm-map-container">
        <div className="map-top-bar">
          <TimeFilter timeRange={timeRange} onTimeRangeChange={setTimeRange} />
          <AddressSearch onSelect={handleAddressSelect} isLoading={searchLoading} />
        </div>
        {/* Swath Transparency — directly below search bar, right-aligned */}
        <div className="map-transparency-bar glass" style={{
          position: 'absolute',
          display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px',
          borderRadius: 16, zIndex: 12, fontSize: 12, fontWeight: 600,
          color: 'var(--text-secondary)', whiteSpace: 'nowrap',
        }}>
          <span>Swath Transparency</span>
          <input
            type="range"
            min="0" max="100" value={Math.round((1 - swathOpacity) * 100)}
            onChange={(e) => setSwathOpacity(1 - parseInt(e.target.value) / 100)}
            style={{ width: 120, accentColor: 'oklch(0.70 0.18 230)', cursor: 'pointer' }}
          />
          <span style={{ minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round((1 - swathOpacity) * 100)}%</span>
        </div>
        <LayerPanel
          layers={layers}
          onLayersChange={setLayers}
          improvedOnly={improvedOnly}
          onImprovedOnlyChange={setImprovedOnly}
          showFema={showFema}
          onShowFemaChange={setShowFema}
          showCounty={showCounty}
          onShowCountyChange={setShowCounty}
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
          {/* Loading indicators — stacked below transparency slider, slide up when one finishes */}
          <div className="map-loading-stack">
            <SwathPropertyProgress state={swathProgress} />
            {femaLoading && (
              <div className="fema-loading-bar glass">
                <span>Fetching FEMA property records<span className="loading-dots"><span>.</span><span>.</span><span>.</span></span></span>
              </div>
            )}
          </div>

          {/* Zoom level indicator */}
          {currentZoom != null && (
            <div style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: 'oklch(0.15 0 0 / 0.75)', backdropFilter: 'blur(8px)',
              color: 'oklch(0.85 0.15 150)',
              padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              fontFamily: 'monospace', pointerEvents: 'none', zIndex: 2,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <MagnifyingGlassPlusIcon style={{ width: 14, height: 14 }} />
              {currentZoom}x
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
