import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getSwaths, getAffectedProperties, getMapProperties } from '../api/storms';
import MapControls from './MapControls';
import SwathPopup from './SwathPopup';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export default function StormMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [layers, setLayers] = useState({ hail: true, wind: true, tornado: true, drift: false, properties: true });

  const loadData = useCallback(async (map) => {
    if (!map) return;
    const bounds = map.getBounds();
    const viewport = {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    };

    // Load swaths + affected properties in storm zones + all properties at high zoom
    const zoom = map.getZoom();
    const fetches = [
      getSwaths({ timeRange, ...viewport }),
      getAffectedProperties({ timeRange, ...viewport }),
    ];
    // At zoom 8+, also load all properties in viewport so you can browse outside storm zones
    if (zoom >= 8) {
      fetches.push(getMapProperties(viewport));
    }
    const [swathRes, affectedRes, allPropRes] = await Promise.allSettled(fetches);

    // Process storm swaths
    if (swathRes.status === 'fulfilled') {
      const geojson = swathRes.value.data || { type: 'FeatureCollection', features: [] };
      const hailFeatures = [];
      const windFeatures = [];
      const tornadoFeatures = [];
      const driftFeatures = [];

      for (const f of geojson.features) {
        const rawType = f.properties?.raw_data?.type || '';
        if (rawType === 'hail' || f.properties?.hail_size_max_in) {
          hailFeatures.push(f);
          // Build drift-corrected feature if available
          if (f.properties?.drift_geometry) {
            driftFeatures.push({
              ...f,
              geometry: f.properties.drift_geometry,
            });
          }
        } else if (rawType === 'tornado') {
          tornadoFeatures.push(f);
        } else {
          windFeatures.push(f);
        }
      }

      const setSource = (id, features) => {
        const src = map.getSource(id);
        if (src) src.setData({ type: 'FeatureCollection', features });
      };

      setSource('hail-zones', hailFeatures);
      setSource('wind-zones', windFeatures);
      setSource('tornado-zones', tornadoFeatures);
      setSource('drift-zones', driftFeatures);
    }

    // Process properties — merge affected (from storm zones) with all (at high zoom)
    const propSrc = map.getSource('properties');
    if (propSrc) {
      const seenIds = new Set();
      const allFeatures = [];

      // Affected properties first (these have storm context info)
      if (affectedRes?.status === 'fulfilled') {
        const features = affectedRes.value.data?.features || [];
        for (const f of features) {
          if (!seenIds.has(f.id)) {
            seenIds.add(f.id);
            allFeatures.push(f);
          }
        }
      }

      // All viewport properties at high zoom (without storm context)
      if (allPropRes?.status === 'fulfilled') {
        const features = allPropRes.value.data?.features || [];
        for (const f of features) {
          if (!seenIds.has(f.id)) {
            seenIds.add(f.id);
            allFeatures.push(f);
          }
        }
      }

      propSrc.setData({ type: 'FeatureCollection', features: allFeatures });
    }
  }, [timeRange]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-97.74, 30.27],
      zoom: 7,
    });

    mapRef.current = map;

    map.on('load', () => {
      // --- HAIL DAMAGE ZONES ---
      map.addSource('hail-zones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'hail-fill',
        type: 'fill',
        source: 'hail-zones',
        paint: {
          'fill-color': '#dcb428',
          'fill-opacity': 0.35,
        },
      });
      map.addLayer({
        id: 'hail-outline',
        type: 'line',
        source: 'hail-zones',
        paint: {
          'line-color': '#dcb428',
          'line-width': 1.5,
          'line-opacity': 0.7,
        },
      });

      // --- WIND DAMAGE ZONES ---
      map.addSource('wind-zones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'wind-fill',
        type: 'fill',
        source: 'wind-zones',
        paint: {
          'fill-color': '#6c5ce7',
          'fill-opacity': 0.3,
        },
      });
      map.addLayer({
        id: 'wind-outline',
        type: 'line',
        source: 'wind-zones',
        paint: {
          'line-color': '#6c5ce7',
          'line-width': 1,
          'line-opacity': 0.6,
        },
      });

      // --- TORNADO DAMAGE ZONES ---
      map.addSource('tornado-zones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'tornado-fill',
        type: 'fill',
        source: 'tornado-zones',
        paint: {
          'fill-color': '#ff2d55',
          'fill-opacity': 0.4,
        },
      });
      map.addLayer({
        id: 'tornado-outline',
        type: 'line',
        source: 'tornado-zones',
        paint: {
          'line-color': '#ff2d55',
          'line-width': 2,
          'line-opacity': 0.8,
        },
      });

      // --- DRIFT-CORRECTED HAIL ZONES ---
      map.addSource('drift-zones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'drift-fill',
        type: 'fill',
        source: 'drift-zones',
        paint: {
          'fill-color': '#00e5ff',
          'fill-opacity': 0.3,
        },
        layout: { visibility: 'none' },
      });
      map.addLayer({
        id: 'drift-outline',
        type: 'line',
        source: 'drift-zones',
        paint: {
          'line-color': '#00e5ff',
          'line-width': 2,
          'line-dasharray': [4, 2],
          'line-opacity': 0.8,
        },
        layout: { visibility: 'none' },
      });

      // --- PROPERTIES OVERLAY ---
      map.addSource('properties', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'properties-circles',
        type: 'circle',
        source: 'properties',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            7, 2,
            10, 4,
            13, 7,
            16, 10,
          ],
          'circle-color': '#00d4aa',
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.5)',
        },
      });
      // Property labels at high zoom
      map.addLayer({
        id: 'properties-labels',
        type: 'symbol',
        source: 'properties',
        minzoom: 13,
        layout: {
          'text-field': ['get', 'address_line1'],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ccc',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1,
        },
      });

      loadData(map);
    });

    // Debounced moveend handler
    let moveTimeout;
    map.on('moveend', () => {
      clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => loadData(map), 500);
    });

    // Click handlers for storm zones
    const stormLayers = ['hail-fill', 'wind-fill', 'tornado-fill', 'drift-fill'];
    for (const layerId of stormLayers) {
      map.on('click', layerId, (e) => {
        if (!e.features?.length) return;
        const feature = e.features[0];
        if (popupRef.current) popupRef.current.remove();

        const container = document.createElement('div');
        container.innerHTML = SwathPopup.renderHTML(feature.properties);
        popupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: '280px' })
          .setLngLat(e.lngLat)
          .setDOMContent(container)
          .addTo(map);
      });
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    }

    // Click handler for properties
    map.on('click', 'properties-circles', (e) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties;
      if (popupRef.current) popupRef.current.remove();

      const value = p.assessed_value ? `$${Number(p.assessed_value).toLocaleString()}` : '';
      const owner = [p.owner_first_name, p.owner_last_name].filter(Boolean).join(' ');
      const stormInfo = p.storm_hail_size
        ? `${p.storm_hail_size}" hail`
        : p.storm_wind_speed
          ? `${p.storm_wind_speed} mph wind`
          : p.storm_type || '';
      const html = `
        <div class="swath-popup">
          <div class="swath-popup__title" style="color:#00d4aa">Affected Property</div>
          <div class="swath-popup__row">
            <span class="swath-popup__label">Address</span>
            <span class="swath-popup__value">${p.address_line1 || 'N/A'}${p.city ? ', ' + p.city : ''}</span>
          </div>
          ${owner ? `<div class="swath-popup__row">
            <span class="swath-popup__label">Owner</span>
            <span class="swath-popup__value">${owner}</span>
          </div>` : ''}
          ${stormInfo ? `<div class="swath-popup__row">
            <span class="swath-popup__label">Storm Exposure</span>
            <span class="swath-popup__value" style="color:#dcb428">${stormInfo}</span>
          </div>` : ''}
          ${p.year_built ? `<div class="swath-popup__row">
            <span class="swath-popup__label">Year Built</span>
            <span class="swath-popup__value">${p.year_built}</span>
          </div>` : ''}
          ${value ? `<div class="swath-popup__row">
            <span class="swath-popup__label">Value</span>
            <span class="swath-popup__value">${value}</span>
          </div>` : ''}
          ${p.roof_type ? `<div class="swath-popup__row">
            <span class="swath-popup__label">Roof</span>
            <span class="swath-popup__value">${p.roof_type}${p.roof_sqft ? ' / ' + p.roof_sqft + ' sqft' : ''}</span>
          </div>` : ''}
          ${p.county_parcel_id ? `<div class="swath-popup__row">
            <span class="swath-popup__label">Parcel ID</span>
            <span class="swath-popup__value">${p.county_parcel_id}</span>
          </div>` : ''}
        </div>
      `;
      const container = document.createElement('div');
      container.innerHTML = html;
      popupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: '280px' })
        .setLngLat(e.lngLat)
        .setDOMContent(container)
        .addTo(map);
    });
    map.on('mouseenter', 'properties-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'properties-circles', () => { map.getCanvas().style.cursor = ''; });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      clearTimeout(moveTimeout);
      if (popupRef.current) popupRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Reload when timeRange changes
  useEffect(() => {
    if (mapRef.current?.isStyleLoaded()) {
      loadData(mapRef.current);
    }
  }, [timeRange, loadData]);

  // Toggle layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const setVis = (id, visible) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    };

    setVis('hail-fill', layers.hail);
    setVis('hail-outline', layers.hail);
    setVis('wind-fill', layers.wind);
    setVis('wind-outline', layers.wind);
    setVis('tornado-fill', layers.tornado);
    setVis('tornado-outline', layers.tornado);
    setVis('drift-fill', layers.drift);
    setVis('drift-outline', layers.drift);
    setVis('properties-circles', layers.properties);
    setVis('properties-labels', layers.properties);
  }, [layers]);

  return (
    <div className="main-content" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="storm-map-container">
        <MapControls
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          layers={layers}
          onLayersChange={setLayers}
        />
        <div className="storm-map-wrapper">
          <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
        </div>
      </div>
    </div>
  );
}
