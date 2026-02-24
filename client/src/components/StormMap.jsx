import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getSwaths } from '../api/storms';
import MapControls from './MapControls';
import SwathPopup from './SwathPopup';

// Token will come from environment or be set before map init
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

function getHailColor(size) {
  if (size >= 2.0) return 'rgba(220, 50, 50, 0.4)';
  if (size >= 1.5) return 'rgba(240, 140, 40, 0.4)';
  if (size >= 1.0) return 'rgba(220, 180, 40, 0.4)';
  return 'rgba(80, 180, 80, 0.4)';
}

export default function StormMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [layers, setLayers] = useState({ hail: true, warnings: false, spc: false });

  const loadSwaths = useCallback(async (map) => {
    if (!map) return;
    try {
      const bounds = map.getBounds();
      const { data } = await getSwaths({
        timeRange,
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      });

      const geojson = data || { type: 'FeatureCollection', features: [] };

      const source = map.getSource('swaths');
      if (source) {
        source.setData(geojson);
      }
    } catch {
      // API not available — swaths layer stays empty
    }
  }, [timeRange]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-97.74, 30.27],
      zoom: 9,
    });

    mapRef.current = map;

    map.on('load', () => {
      // Add empty swaths source
      map.addSource('swaths', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Fill layer color-coded by hail size
      map.addLayer({
        id: 'swaths-fill',
        type: 'fill',
        source: 'swaths',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'hail_size_max_in'], 0],
            0, 'rgba(80, 180, 80, 0.4)',
            1.0, 'rgba(220, 180, 40, 0.4)',
            1.5, 'rgba(240, 140, 40, 0.4)',
            2.0, 'rgba(220, 50, 50, 0.4)',
          ],
          'fill-opacity': 0.4,
        },
      });

      // Outline layer
      map.addLayer({
        id: 'swaths-outline',
        type: 'line',
        source: 'swaths',
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.3)',
          'line-width': 1,
        },
      });

      loadSwaths(map);
    });

    // Debounced moveend handler
    let moveTimeout;
    map.on('moveend', () => {
      clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => loadSwaths(map), 500);
    });

    // Click handler for swath popup
    map.on('click', 'swaths-fill', (e) => {
      if (!e.features?.length) return;

      const feature = e.features[0];
      const coords = e.lngLat;

      if (popupRef.current) popupRef.current.remove();

      const container = document.createElement('div');
      container.innerHTML = SwathPopup.renderHTML(feature.properties);

      popupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: '260px' })
        .setLngLat(coords)
        .setDOMContent(container)
        .addTo(map);
    });

    map.on('mouseenter', 'swaths-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'swaths-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    // Navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      clearTimeout(moveTimeout);
      if (popupRef.current) popupRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Reload swaths when timeRange changes
  useEffect(() => {
    if (mapRef.current?.isStyleLoaded()) {
      loadSwaths(mapRef.current);
    }
  }, [timeRange, loadSwaths]);

  // Toggle layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const visibility = layers.hail ? 'visible' : 'none';
    if (map.getLayer('swaths-fill')) map.setLayoutProperty('swaths-fill', 'visibility', visibility);
    if (map.getLayer('swaths-outline')) map.setLayoutProperty('swaths-outline', 'visibility', visibility);
  }, [layers.hail]);

  return (
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
  );
}
