import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { loadGoogleMaps } from '../lib/googleMaps';
import { getSwaths, getAffectedProperties, getMapProperties, createProperty } from '../api/storms';
import { addPropertyToPipeline, createManualLead } from '../api/crm';
import { TimeFilter, LayerPanel } from './MapControls';
import AddressSearch from './AddressSearch';
import SwathPopup from './SwathPopup';

// Clean address strings from messy data (trailing commas, extra spaces)
function cleanAddr(str) {
  if (!str) return '';
  return str.replace(/[\s,]+$/, '').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
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

export default function StormMap() {
  const [searchParams] = useSearchParams();
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const infoRef = useRef(null);
  const observerRef = useRef(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [layers, setLayers] = useState({ hail: true, wind: true, tornado: true, drift: true, properties: true });
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const [improvedOnly, setImprovedOnly] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [propLoading, setPropLoading] = useState(false);
  const searchMarkerRef = useRef(null);
  const dataLayersRef = useRef({});
  const stormFeaturesRef = useRef([]); // individual storm features for click lookups
  const propLabelsRef = useRef([]);
  const propFeaturesRef = useRef([]);
  const propCacheRef = useRef(new Map()); // id -> GeoJSON feature
  const propBboxRef = useRef(null); // { west, south, east, north, zoom } of fetched area
  const showPropertyPopupRef = useRef(null);

  // Load storms once for all of Texas (only ~389, stays on map permanently)
  const stormsLoadedRef = useRef(false);
  const loadStorms = useCallback(async (map) => {
    if (!map) return;
    const txViewport = { west: -106.65, south: 25.84, east: -93.51, north: 36.50 };
    setMapLoading(true);

    try {
      const res = await getSwaths({ timeRange, ...txViewport });
      const geojson = res.data || { type: 'FeatureCollection', features: [] };
      const buckets = { hail: [], wind: [], tornado: [], drift: [] };
      const individualFeatures = [];

      for (const f of geojson.features) {
        // Wind flow lines and arrows go to wind bucket
        if (f.properties?._windArrow || f.properties?._windFlow) {
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
        const hasHail = f.properties?.hail_size_max_in;
        const hasWind = f.properties?.wind_speed_max_mph;
        // Points always render individually; polygons only if no merged outlines
        if (geomType === 'Point' || geomType === 'Polygon' || geomType === 'MultiPolygon') {
          if (rawType === 'hail' || (hasHail && !hasWind)) {
            buckets.hail.push(f);
            if (f.properties?.drift_geometry && (geomType === 'Polygon' || geomType === 'MultiPolygon')) {
              buckets.drift.push({ ...f, id: `drift_${f.id}`, geometry: f.properties.drift_geometry });
            }
          } else if (rawType === 'tornado') {
            buckets.tornado.push(f);
          } else {
            buckets.wind.push(f);
          }
        }
      }

      // If merged outlines exist, use them instead of individual polygons
      const hasMerged = geojson.features.some(f => f.properties?._merged);
      if (hasMerged) {
        for (const key of ['hail', 'wind', 'tornado', 'drift']) {
          buckets[key] = buckets[key].filter(f => {
            const gt = f.geometry?.type;
            return f.properties?._merged || f.properties?._windArrow || f.properties?._windFlow || gt === 'Point';
          });
        }
      }

      const dl = dataLayersRef.current;
      for (const key of ['hail', 'wind', 'tornado', 'drift']) {
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

  // Load properties for the current viewport (debounced on pan/zoom)
  // Uses client-side cache so panning back doesn't re-fetch
  const propLoadingRef = useRef(false);
  const canvasOverlayRef = useRef(null);

  const loadProperties = useCallback(async (map, forceClear) => {
    if (!map || propLoadingRef.current) return;
    const zoom = map.getZoom();

    // Too zoomed out — hide properties
    if (zoom < 8) {
      propFeaturesRef.current = [];
      if (canvasOverlayRef.current) canvasOverlayRef.current.requestDraw();
      for (const lbl of propLabelsRef.current) lbl.map = null;
      propLabelsRef.current = [];
      return;
    }

    const bounds = map.getBounds();
    if (!bounds) return;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const viewport = { west: sw.lng(), south: sw.lat(), east: ne.lng(), north: ne.lat() };

    // Skip fetch if current viewport is fully inside the area we already fetched
    // AND we haven't zoomed in significantly (which means we want denser data)
    const cached = propBboxRef.current;
    const zoomedInMore = cached && zoom >= cached.zoom + 2;
    if (!forceClear && !zoomedInMore && cached &&
        viewport.west >= cached.west && viewport.south >= cached.south &&
        viewport.east <= cached.east && viewport.north <= cached.north) {
      return;
    }

    // If zooming in significantly, clear cache so we get fresh dense data for this area
    if (zoomedInMore) {
      propCacheRef.current.clear();
      propBboxRef.current = null;
    }

    propLoadingRef.current = true;
    setPropLoading(true);
    try {
      // Fetch with a 20% buffer so small pans don't trigger new fetches
      const latBuffer = (viewport.north - viewport.south) * 0.2;
      const lngBuffer = (viewport.east - viewport.west) * 0.2;
      const buffered = {
        west: viewport.west - lngBuffer,
        south: viewport.south - latBuffer,
        east: viewport.east + lngBuffer,
        north: viewport.north + latBuffer,
      };

      const fetches = [getAffectedProperties({ timeRange, ...buffered })];
      if (zoom >= 12 && improvedOnly) {
        fetches.push(getMapProperties({ ...buffered, improvedOnly }));
      }
      const results = await Promise.allSettled(fetches);

      // Merge into cache
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        for (const f of (result.value.data?.features || [])) {
          const fid = f.id || f.properties?.id;
          if (fid && !propCacheRef.current.has(fid)) {
            propCacheRef.current.set(fid, f);
          }
        }
      }

      // Expand cached bbox and track zoom level
      const prevCached = propBboxRef.current;
      if (prevCached && !zoomedInMore) {
        propBboxRef.current = {
          west: Math.min(prevCached.west, buffered.west),
          south: Math.min(prevCached.south, buffered.south),
          east: Math.max(prevCached.east, buffered.east),
          north: Math.max(prevCached.north, buffered.north),
          zoom,
        };
      } else {
        propBboxRef.current = { ...buffered, zoom };
      }

      propFeaturesRef.current = Array.from(propCacheRef.current.values());

      // Trigger canvas overlay redraw
      if (canvasOverlayRef.current) canvasOverlayRef.current.requestDraw();

      updatePropertyLabels(map, propFeaturesRef.current);
    } finally {
      propLoadingRef.current = false;
      setPropLoading(false);
    }
  }, [timeRange, improvedOnly]);

  // Property click handler — enriches with storm data from swath layers
  function handlePropertyClick(latLng, feature) {
    const p = { ...(feature.properties || {}) };
    const propertyId = feature.id || p.id;
    const pos = latLng;

    // Check storm containment
    const dl = dataLayersRef.current;
    const layerMeta = {
      hail:    { label: 'Hail',    color: '#dcb428' },
      wind:    { label: 'Wind',    color: '#6c5ce7' },
      tornado: { label: 'Tornado', color: '#ff2d55' },
      drift:   { label: 'Hail (Drift Corrected)', color: '#00e5ff' },
    };
    let nearestSpcDist = Infinity;
    let nearestSpcData = null;

    for (const sKey of ['hail', 'wind', 'tornado', 'drift']) {
      if (!layersRef.current[sKey]) continue;
      const sLayer = dl[sKey];
      let found = false;
      sLayer.forEach((sFeat) => {
        const geom = sFeat.getGeometry();
        if (!geom) return;

        if (geom.getType() === 'Polygon') {
          if (found) return;
          const path = geom.getAt(0);
          const poly = new google.maps.Polygon({ paths: path.getArray() });
          if (google.maps.geometry.poly.containsLocation(pos, poly)) {
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
            nearestSpcData = { sKey, hail: sFeat.getProperty('hail_size_max_in'), wind: sFeat.getProperty('wind_speed_max_mph'), rawData: sFeat.getProperty('raw_data') };
          }
        }
      });
    }

    if (nearestSpcData) {
      const { hail, wind, rawData } = nearestSpcData;
      if (hail && !p.storm_hail_size) p.storm_hail_size = hail;
      if (wind && !p.storm_wind_speed) p.storm_wind_speed = wind;
      if (rawData?.speed && !p.storm_wind_speed) p.storm_wind_speed = rawData.speed !== 'UNK' ? rawData.speed : null;
      if (rawData?.size && !p.storm_hail_size) p.storm_hail_size = rawData.size;
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
        const offsetY = 120 / Math.pow(2, zoom); // scale offset by zoom
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

      const info = new maps.InfoWindow();
      infoRef.current = info;

      // Create data layers for each storm type
      const dl = {};
      for (const key of ['hail', 'wind', 'tornado', 'drift']) {
        const layer = new maps.Data();
        const c = COLORS[key];
        layer.setStyle((feature) => {
          const geomType = feature.getGeometry()?.getType();
          // Wind flow lines
          if (feature.getProperty('_windFlow')) {
            return {
              strokeColor: '#6c5ce7',
              strokeWeight: 1,
              strokeOpacity: 0.3,
              clickable: false,
            };
          }
          if (geomType === 'Point') {
            // Wind direction arrows along flow lines
            if (feature.getProperty('_windArrow')) {
              const azimuth = feature.getProperty('azimuth') || 0;
              return {
                icon: {
                  path: 'M 0,-6 L 4,3 L 0,0.5 L -4,3 Z',
                  scale: 2.2,
                  fillColor: '#6c5ce7',
                  fillOpacity: 0.45,
                  strokeColor: '#6c5ce7',
                  strokeWeight: 0,
                  rotation: azimuth,
                  anchor: new maps.Point(0, 0),
                },
                clickable: false,
              };
            }
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
            strokeWeight: key === 'tornado' ? 3 : key === 'drift' ? 1.5 : 2.5,
            strokeOpacity: key === 'drift' ? 0.6 : 0.85,
          };
        });
        layer.setMap(map);
        dl[key] = layer;

        // Click handler for storm features — check for property hit first
        layer.addListener('click', (event) => {
          const clickLatLng = event.latLng;
          const z = map.getZoom();

          // If properties layer is on, check if click is near a property dot
          if (layersRef.current.properties && z >= 8) {
            const hitRadius = z <= 10 ? 500 : z <= 13 ? 100 : z <= 15 ? 30 : 10;
            let closest = null;
            let closestDist = hitRadius;
            for (const f of propFeaturesRef.current) {
              if (!f.geometry?.coordinates) continue;
              const [lng, lat] = f.geometry.coordinates;
              const fLatLng = new maps.LatLng(lat, lng);
              const dist = maps.geometry.spherical.computeDistanceBetween(clickLatLng, fLatLng);
              if (dist < closestDist) {
                closestDist = dist;
                closest = f;
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
          const features = propFeaturesRef.current;
          if (features.length === 0) return;

          const z = map.getZoom();
          const radius = z <= 8 ? 2 : z <= 10 ? 3 : z <= 13 ? 5 : z <= 15 ? 7 : 9;
          const alpha = z <= 10 ? 0.85 : z <= 13 ? 0.7 : 0.5;

          ctx.fillStyle = `rgba(0, 212, 170, ${alpha})`;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
          ctx.lineWidth = z <= 10 ? 1 : 0.5;

          ctx.beginPath();
          for (const f of features) {
            if (!f.geometry?.coordinates) continue;
            const [lng, lat] = f.geometry.coordinates;
            const pixel = projection.fromLatLngToDivPixel(new maps.LatLng(lat, lng));
            if (!pixel) continue;
            const x = pixel.x - left;
            const y = pixel.y - top;
            if (x < -radius || x > size + radius || y < -radius || y > size + radius) continue;
            ctx.moveTo(x + radius, y);
            ctx.arc(x, y, radius, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.stroke();
        }
        requestDraw() {
          this.draw();
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
        const z = map.getZoom();
        if (z < 8) return;

        const clickLatLng = e.latLng;
        const hitRadius = z <= 10 ? 500 : z <= 13 ? 100 : z <= 15 ? 30 : 10; // meters
        let closest = null;
        let closestDist = hitRadius;

        for (const f of propFeaturesRef.current) {
          if (!f.geometry?.coordinates) continue;
          const [lng, lat] = f.geometry.coordinates;
          const fLatLng = new maps.LatLng(lat, lng);
          const dist = maps.geometry.spherical.computeDistanceBetween(clickLatLng, fLatLng);
          if (dist < closestDist) {
            closestDist = dist;
            closest = f;
          }
        }
        if (closest) {
          const [lng, lat] = closest.geometry.coordinates;
          handlePropertyClick(new maps.LatLng(lat, lng), closest);
        }
      });

      // Pointer cursor when hovering over a property dot
      map.addListener('mousemove', (e) => {
        if (!layersRef.current.properties) return;
        const z = map.getZoom();
        if (z < 8) { map.setOptions({ draggableCursor: null }); return; }
        const hitRadius = z <= 10 ? 500 : z <= 13 ? 100 : z <= 15 ? 30 : 10;
        const cursor = e.latLng;
        let hit = false;
        for (const f of propFeaturesRef.current) {
          if (!f.geometry?.coordinates) continue;
          const [lng, lat] = f.geometry.coordinates;
          const dist = maps.geometry.spherical.computeDistanceBetween(cursor, new maps.LatLng(lat, lng));
          if (dist < hitRadius) { hit = true; break; }
        }
        map.setOptions({ draggableCursor: hit ? 'pointer' : null });
      });

      // Refresh labels on zoom change
      map.addListener('zoom_changed', () => {
        updatePropertyLabels(map, propFeaturesRef.current);
      });

      // Save viewport + reload properties on pan/zoom (storms stay loaded)
      let propTimeout;
      map.addListener('idle', () => {
        const c = map.getCenter();
        sessionStorage.setItem('stormMapViewport', JSON.stringify({ lat: c.lat(), lng: c.lng(), zoom: map.getZoom() }));
        clearTimeout(propTimeout);
        propTimeout = setTimeout(() => loadProperties(map), 800);
      });

      // Shared property popup function
      showPropertyPopupRef.current = showPropertyPopup;
      function showPropertyPopup(map, position, p, propertyId) {
        const value = p.assessed_value ? `$${Number(p.assessed_value).toLocaleString()}` : '';
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
            <div class="swath-popup__title" style="color:#00d4aa">Affected Property</div>
            <div class="swath-popup__sv" style="width:100%;height:150px;border-radius:6px;margin-bottom:8px;overflow:hidden;background:#1a1a2e;display:none;"></div>
            <div class="swath-popup__row">
              <span class="swath-popup__label">Address</span>
              <span class="swath-popup__value">${titleCase(cleanAddr(p.address_line1)) || 'N/A'}${p.city?.trim() ? ', ' + titleCase(p.city.trim()) : ''}${p.state?.trim() ? ', ' + p.state.trim() : ''}${p.zip?.trim() && p.zip.trim() !== '0' ? ' ' + p.zip.trim() : ''}</span>
            </div>
            ${owner ? `<div class="swath-popup__row"><span class="swath-popup__label">Owner</span><span class="swath-popup__value">${owner}</span></div>
            <div style="color:#8a8a9a;font-size:10px;line-height:1.3;margin:-2px 0 4px;padding-left:2px;">Public records — subject to change after skip tracing</div>` : ''}
            ${p.year_built ? `<div class="swath-popup__row"><span class="swath-popup__label">Year Built</span><span class="swath-popup__value">${p.year_built}</span></div>` : ''}
            ${value ? `<div class="swath-popup__row"><span class="swath-popup__label">Value</span><span class="swath-popup__value">${value}</span></div>` : ''}
            ${p.roof_type ? `<div class="swath-popup__row"><span class="swath-popup__label">Roof</span><span class="swath-popup__value">${p.roof_type}${p.roof_sqft ? ' / ' + p.roof_sqft + ' sqft' : ''}</span></div>` : ''}
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
            ${hasStorm ? `<button class="add-to-pipeline-btn" data-property-id="${propertyId}" data-storm-id="${stormId}" style="
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
              await addPropertyToPipeline(btn.dataset.stormId, btn.dataset.propertyId);
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

      // Initial data load — storms once, then properties for viewport
      maps.event.addListenerOnce(map, 'idle', () => {
        loadStorms(map).then(() => {
          loadProperties(map);
        }).then(() => {
          try {
            const saved = JSON.parse(sessionStorage.getItem('stormMapPopup'));
            if (saved) {
              showPropertyPopup(map, { lat: saved.lngLat[1], lng: saved.lngLat[0] }, saved.properties, saved.propertyId);
            }
          } catch {}
        });
      });
    });

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
      if (infoRef.current) infoRef.current.close();
      if (canvasOverlayRef.current) canvasOverlayRef.current.setMap(null);
      for (const lbl of propLabelsRef.current) lbl.map = null;
      propLabelsRef.current = [];
      propCacheRef.current.clear();
      propBboxRef.current = null;
      mapRef.current = null;
    };
  }, []);

  // Reload storms and clear property cache when time filter changes
  useEffect(() => {
    if (mapRef.current) {
      // Clear property cache so new time range fetches fresh data
      propCacheRef.current.clear();
      propBboxRef.current = null;
      loadStorms(mapRef.current);
      loadProperties(mapRef.current, true);
    }
  }, [timeRange, loadStorms, loadProperties]);

  // Toggle layer visibility
  useEffect(() => {
    const map = mapRef.current;
    const dl = dataLayersRef.current;
    if (!map || !dl.hail) return;

    for (const key of ['hail', 'wind', 'tornado', 'drift']) {
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
      loadProperties(map);
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
    const value = p.assessed_value ? `$${Number(p.assessed_value).toLocaleString()}` : '';
    const owner = formatOwner(p.owner_first_name, p.owner_last_name);
    const html = `
      <div class="swath-popup">
        <div class="swath-popup__title" style="color:#0ea5e9">${error ? 'Search Result' : created ? 'New Property Added' : 'Existing Property'}</div>
        <div class="swath-popup__sv" style="width:100%;height:150px;border-radius:6px;margin-bottom:8px;overflow:hidden;background:#1a1a2e;display:none;"></div>
        <div class="swath-popup__row">
          <span class="swath-popup__label">Address</span>
          <span class="swath-popup__value">${cleanAddr(addr.address_line1)}${addr.city?.trim() ? ', ' + addr.city.trim() : ''}${addr.state?.trim() ? ', ' + addr.state.trim() : ''}${addr.zip?.trim() ? ' ' + addr.zip.trim() : ''}</span>
        </div>
        ${owner ? `<div class="swath-popup__row"><span class="swath-popup__label">Owner</span><span class="swath-popup__value">${owner}</span></div>
        <div style="color:#8a8a9a;font-size:10px;line-height:1.3;margin:-2px 0 4px;padding-left:2px;">Public records — subject to change after skip tracing</div>` : ''}
        ${value ? `<div class="swath-popup__row"><span class="swath-popup__label">Assessed Value</span><span class="swath-popup__value">${value}</span></div>` : ''}
        ${p.year_built ? `<div class="swath-popup__row"><span class="swath-popup__label">Year Built</span><span class="swath-popup__value">${p.year_built}</span></div>` : ''}
        ${p.roof_sqft ? `<div class="swath-popup__row"><span class="swath-popup__label">Roof</span><span class="swath-popup__value">${p.roof_sqft} sqft / ${p.roof_segments || '?'} segments</span></div>` : ''}
        ${p.roof_pitch_degrees ? `<div class="swath-popup__row"><span class="swath-popup__label">Pitch</span><span class="swath-popup__value">${p.roof_pitch_degrees}</span></div>` : ''}
        ${!p.roof_sqft && !roofData && !error ? `<div class="swath-popup__row"><span class="swath-popup__value" style="color:#f59e0b;font-size:12px">No Google Solar data available for this location</span></div>` : ''}
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
  }, [loadProperties]);

  return (
    <div className="main-content" style={{ padding: 0, overflow: 'hidden' }}>
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
        />
        <div className="storm-map-wrapper">
          <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
          {(mapLoading || propLoading) && (
            <div className="storm-map-loading">
              <div className="storm-map-loading__spinner">
                <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
              </div>
              <span>{mapLoading ? 'Loading storms…' : 'Loading properties…'}</span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
