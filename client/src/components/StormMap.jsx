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
  const searchMarkerRef = useRef(null);
  const dataLayersRef = useRef({});
  const propLabelsRef = useRef([]);
  const propFeaturesRef = useRef([]);
  const showPropertyPopupRef = useRef(null);

  const loadData = useCallback(async (map) => {
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const viewport = { west: sw.lng(), south: sw.lat(), east: ne.lng(), north: ne.lat() };

    // Skip degenerate bbox (exact same point for all corners)
    if (ne.lng() === sw.lng() && ne.lat() === sw.lat()) {
      return;
    }

    const zoom = map.getZoom();

    // Skip heavy data loads at low zoom to prevent freezing
    if (zoom < 5) return;

    setMapLoading(true);
    const loadStart = Date.now();

    const fetches = [
      getSwaths({ timeRange, ...viewport }),
    ];
    if (zoom >= 6) {
      fetches.push(getAffectedProperties({ timeRange, ...viewport }));
    }
    if (zoom >= 10 && improvedOnly) {
      fetches.push(getMapProperties({ ...viewport, improvedOnly }));
    }
    const results = await Promise.allSettled(fetches);
    const swathRes = results[0];
    const affectedRes = zoom >= 6 ? results[1] : null;
    const allPropRes = zoom >= 10 && improvedOnly ? results[results.length - 1] : null;


    const dl = dataLayersRef.current;

    // Process storm swaths
    if (swathRes.status === 'fulfilled') {
      const geojson = swathRes.value.data || { type: 'FeatureCollection', features: [] };
      const buckets = { hail: [], wind: [], tornado: [], drift: [] };

      for (const f of geojson.features) {
        if (f.id && !f.properties?.storm_event_id) {
          f.properties = { ...f.properties, storm_event_id: f.id };
        }
        const rawType = f.properties?.raw_data?.type || '';
        const hasHail = f.properties?.hail_size_max_in;
        const hasWind = f.properties?.wind_speed_max_mph;
        if (rawType === 'hail') {
          buckets.hail.push(f);
          if (f.properties?.drift_geometry) {
            buckets.drift.push({ ...f, geometry: f.properties.drift_geometry });
          }
        } else if (rawType === 'tornado') {
          buckets.tornado.push(f);
        } else if (rawType === 'wind') {
          buckets.wind.push(f);
        } else if (hasHail && !hasWind) {
          // NWS alert with only hail data → hail bucket
          buckets.hail.push(f);
          if (f.properties?.drift_geometry) {
            buckets.drift.push({ ...f, geometry: f.properties.drift_geometry });
          }
        } else {
          // NWS alerts with wind data (or both) → wind bucket
          buckets.wind.push(f);
        }
      }

      for (const key of ['hail', 'wind', 'tornado', 'drift']) {
        const layer = dl[key];
        if (!layer) continue;
        // Clear existing features
        layer.forEach(feat => layer.remove(feat));
        // Add new ones
        if (buckets[key].length > 0) {
          try {
            layer.addGeoJson({ type: 'FeatureCollection', features: buckets[key] });
          } catch (e) {
            console.warn(`Failed to add ${key} GeoJSON:`, e);
          }
        }
      }
    }

    // Process properties
    const seenIds = new Set();
    const allFeatures = [];

    if (affectedRes?.status === 'fulfilled') {
      for (const f of (affectedRes.value.data?.features || [])) {
        if (!seenIds.has(f.id)) { seenIds.add(f.id); allFeatures.push(f); }
      }
    }
    if (allPropRes?.status === 'fulfilled') {
      for (const f of (allPropRes.value.data?.features || [])) {
        if (!seenIds.has(f.id)) { seenIds.add(f.id); allFeatures.push(f); }
      }
    }

    // Cap properties to prevent performance issues (Circle objects are lightweight)
    const MAX_PROPERTIES = 1500;
    const cappedFeatures = allFeatures.length > MAX_PROPERTIES ? allFeatures.slice(0, MAX_PROPERTIES) : allFeatures;

    propFeaturesRef.current = cappedFeatures;
    updatePropertyMarkersRef.current(map, cappedFeatures);
    // Keep loading visible for at least 400ms so it doesn't just flash
    const elapsed = Date.now() - loadStart;
    if (elapsed < 400) {
      setTimeout(() => setMapLoading(false), 400 - elapsed);
    } else {
      setMapLoading(false);
    }
  }, [timeRange, improvedOnly]);

  // Manage property circle overlays (using google.maps.Circle for performance)
  const propCirclesRef = useRef([]);
  const updatePropertyMarkersRef = useRef(null);

  function updatePropertyMarkers(map, features) {
    // Clear old circles
    for (const c of propCirclesRef.current) c.setMap(null);
    propCirclesRef.current = [];

    if (!layersRef.current.properties) return;

    const zoom = map.getZoom();
    // Radius in meters — needs to be large enough to see at each zoom level
    const radius = zoom <= 7 ? 600 : zoom <= 10 ? 200 : zoom <= 13 ? 60 : zoom <= 15 ? 25 : 15;
    // More opaque when zoomed out (easier to spot), transparent when zoomed in
    const opacity = zoom <= 10 ? 0.85 : zoom <= 13 ? 0.6 : 0.35;
    const strokeW = zoom <= 10 ? 1.5 : zoom <= 13 ? 1 : 0.5;

    for (const f of features) {
      if (!f.geometry?.coordinates) continue;
      const [lng, lat] = f.geometry.coordinates;
      const circle = new google.maps.Circle({
        map,
        center: { lat, lng },
        radius,
        fillColor: COLORS.property,
        fillOpacity: opacity,
        strokeColor: 'rgba(255,255,255,0.5)',
        strokeWeight: strokeW,
        clickable: true,
        zIndex: 2,
      });

      // Store feature data on circle for click handler
      circle._featureData = f;
      circle._featureId = f.id || f.properties?.id;

      circle.addListener('click', () => {
        const p = { ...(f.properties || {}) };
        const propertyId = f.id || p.id;
        const pos = circle.getCenter();

        // Check storm containment — also detect which layer type the property is in
        const dl = dataLayersRef.current;
        const layerMeta = {
          hail:    { label: 'Hail',    color: '#dcb428' },
          wind:    { label: 'Wind',    color: '#6c5ce7' },
          tornado: { label: 'Tornado', color: '#ff2d55' },
          drift:   { label: 'Hail (Drift Corrected)', color: '#00e5ff' },
        };
        // Track nearest SPC point report per layer for wind speed / hail size
        let nearestSpcDist = Infinity;
        let nearestSpcData = null;

        for (const sKey of ['hail', 'wind', 'tornado', 'drift']) {
          if (!layersRef.current[sKey]) continue;
          const sLayer = dl[sKey];
          let found = false;
          sLayer.forEach((feat) => {
            const geom = feat.getGeometry();
            if (!geom) return;

            if (geom.getType() === 'Polygon') {
              if (found) return;
              const path = geom.getAt(0);
              const poly = new google.maps.Polygon({ paths: path.getArray() });
              if (google.maps.geometry.poly.containsLocation(pos, poly)) {
                if (!p.storm_event_id) p.storm_event_id = feat.getProperty('storm_event_id');
                const hail = feat.getProperty('hail_size_max_in');
                const wind = feat.getProperty('wind_speed_max_mph');
                if (hail && !p.storm_hail_size) p.storm_hail_size = hail;
                if (wind && !p.storm_wind_speed) p.storm_wind_speed = wind;
                if (!p._swathType) {
                  p._swathType = layerMeta[sKey].label;
                  p._swathColor = layerMeta[sKey].color;
                }
                // Pull extra info from the feature
                const rawData = feat.getProperty('raw_data');
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
                const eventStart = feat.getProperty('event_start');
                if (eventStart && !p.storm_date) p.storm_date = eventStart;
                found = true;
              }
            } else if (geom.getType() === 'Point') {
              // SPC point reports — find nearest one within 30km for wind speed / hail size
              const ptLatLng = geom.get();
              const dist = google.maps.geometry.spherical.computeDistanceBetween(pos, ptLatLng);
              if (dist < 30000 && dist < nearestSpcDist) {
                nearestSpcDist = dist;
                const hail = feat.getProperty('hail_size_max_in');
                const wind = feat.getProperty('wind_speed_max_mph');
                const rawData = feat.getProperty('raw_data');
                nearestSpcData = { sKey, hail, wind, rawData };
              }
            }
          });
        }

        // Apply nearest SPC point report data (wind speed / hail size)
        if (nearestSpcData) {
          const { sKey, hail, wind, rawData } = nearestSpcData;
          if (hail && !p.storm_hail_size) p.storm_hail_size = hail;
          if (wind && !p.storm_wind_speed) p.storm_wind_speed = wind;
          if (rawData?.speed && !p.storm_wind_speed) {
            p.storm_wind_speed = rawData.speed !== 'UNK' ? rawData.speed : null;
          }
          if (rawData?.size && !p.storm_hail_size) {
            p.storm_hail_size = rawData.size;
          }
        }

        sessionStorage.setItem('stormMapPopup', JSON.stringify({
          lngLat: [pos.lng(), pos.lat()],
          properties: p,
          propertyId,
        }));

        showPropertyPopupRef.current?.(mapRef.current, pos, p, propertyId);
      });

      propCirclesRef.current.push(circle);
    }

    updatePropertyLabels(map, features);
  }

  function updatePropertyLabels(map, features) {
    // Clear old labels
    for (const lbl of propLabelsRef.current) lbl.map = null;
    propLabelsRef.current = [];

    const zoom = map.getZoom();
    if (zoom < 13 || !layersRef.current.properties) return;

    const google = window.google;
    for (const f of features) {
      if (!f.geometry?.coordinates) continue;
      const [lng, lat] = f.geometry.coordinates;
      const addr = f.properties?.address_line1 || '';
      if (!addr) continue;

      const label = document.createElement('div');
      label.style.cssText = 'color:#ccc;font-size:11px;text-shadow:0 0 4px rgba(0,0,0,0.8);white-space:nowrap;pointer-events:none;';
      label.textContent = addr;

      try {
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat, lng },
          content: label,
          zIndex: 1,
        });
        propLabelsRef.current.push(marker);
      } catch {
        // AdvancedMarkerElement may not be available without mapId
      }
    }
  }

  // Keep ref current so loadData's useCallback always calls the latest version
  updatePropertyMarkersRef.current = updatePropertyMarkers;

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
        mapTypeId: 'hybrid',
        gestureHandling: 'greedy',
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapRef.current = map;

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
          if (geomType === 'Point') {
            return {
              icon: {
                path: maps.SymbolPath.CIRCLE,
                scale: key === 'hail' || key === 'tornado' ? 8 : 6,
                fillColor: c.fill,
                fillOpacity: 0.7,
                strokeColor: '#fff',
                strokeWeight: 1,
              },
            };
          }
          return {
            fillColor: c.fill,
            fillOpacity: key === 'tornado' ? 0.15 : key === 'drift' ? 0.08 : 0.12,
            strokeColor: c.stroke,
            strokeWeight: key === 'tornado' ? 3 : key === 'drift' ? 1.5 : 2.5,
            strokeOpacity: key === 'drift' ? 0.6 : 0.85,
          };
        });
        layer.setMap(map);
        dl[key] = layer;

        // Click handler for storm features
        layer.addListener('click', (event) => {
          const props = {};
          event.feature.forEachProperty((val, key) => { props[key] = val; });
          const pos = event.latLng;

          const container = document.createElement('div');
          container.innerHTML = SwathPopup.renderHTML(props);
          info.setContent(container);
          info.setPosition(pos);
          info.open(map);
        });
      }

      dataLayersRef.current = dl;

      // Update property circles on zoom change + clear data at low zoom
      let prevZoom = zoom;
      map.addListener('zoom_changed', () => {
        const z = map.getZoom();
        const radius = z <= 7 ? 600 : z <= 10 ? 200 : z <= 13 ? 60 : z <= 15 ? 25 : 15;
        const opacity = z <= 10 ? 0.85 : z <= 13 ? 0.6 : 0.35;
        const strokeW = z <= 10 ? 1.5 : z <= 13 ? 1 : 0.5;

        // Update circle radii and opacity
        for (const c of propCirclesRef.current) {
          c.setRadius(radius);
          c.setOptions({ fillOpacity: opacity, strokeWeight: strokeW });
        }
        updatePropertyLabels(map, propFeaturesRef.current);

        // Clear features when zooming out past thresholds to prevent sluggishness
        if (z < 6 && prevZoom >= 6) {
          for (const c of propCirclesRef.current) c.setMap(null);
          propCirclesRef.current = [];
          propFeaturesRef.current = [];
          for (const lbl of propLabelsRef.current) lbl.map = null;
          propLabelsRef.current = [];
        }
        if (z < 5 && prevZoom >= 5) {
          for (const key of ['hail', 'wind', 'tornado', 'drift']) {
            dl[key]?.forEach(f => dl[key].remove(f));
          }
        }
        prevZoom = z;
      });

      // Debounced idle handler (replaces moveend)
      let idleTimeout;
      map.addListener('idle', () => {
        clearTimeout(idleTimeout);
        const c = map.getCenter();
        sessionStorage.setItem('stormMapViewport', JSON.stringify({ lat: c.lat(), lng: c.lng(), zoom: map.getZoom() }));
        idleTimeout = setTimeout(() => loadData(map), 500);
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
            ${owner ? `<div class="swath-popup__row"><span class="swath-popup__label">Owner</span><span class="swath-popup__value">${owner}</span></div>` : ''}
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

      // Initial data load
      maps.event.addListenerOnce(map, 'idle', () => {
        loadData(map).then(() => {
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
      for (const c of propCirclesRef.current) c.setMap(null);
      propCirclesRef.current = [];
      for (const lbl of propLabelsRef.current) lbl.map = null;
      propLabelsRef.current = [];
      mapRef.current = null;
    };
  }, []);

  // Reload on timeRange / improvedOnly change
  useEffect(() => {
    if (mapRef.current) loadData(mapRef.current);
  }, [timeRange, improvedOnly, loadData]);

  // Toggle layer visibility
  useEffect(() => {
    const map = mapRef.current;
    const dl = dataLayersRef.current;
    if (!map || !dl.hail) return;

    for (const key of ['hail', 'wind', 'tornado', 'drift']) {
      dl[key]?.setMap(layers[key] ? map : null);
    }

    // Toggle property circles
    for (const c of propCirclesRef.current) {
      c.setMap(layers.properties ? map : null);
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

      // Roof measurement is manual — user clicks "Measure Roof" in lead detail
      loadData(map);
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
        ${owner ? `<div class="swath-popup__row"><span class="swath-popup__label">Owner</span><span class="swath-popup__value">${owner}</span></div>` : ''}
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
  }, [loadData]);

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
          {mapLoading && (
            <div className="storm-map-loading">
              <div className="storm-map-loading__spinner" />
              <span>Loading storm data…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
