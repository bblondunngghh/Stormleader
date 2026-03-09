import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { manualRoofEntry } from '../api/roofMeasurement';
import {
  polygonAreaSqFt, trueRoofArea, haversineDistanceFt as haversineFt,
  classifyEdges, snapToVertex, isNearFirstVertex, polygonCentroid,
} from '../utils/roofPolygonUtils';

if (!mapboxgl.accessToken) {
  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
}

const LINE_TYPES = [
  { key: 'ridge', label: 'Ridge', color: '#e67e22' },
  { key: 'eave', label: 'Eave', color: '#3498db' },
  { key: 'rake', label: 'Rake', color: '#2ecc71' },
  { key: 'valley', label: 'Valley', color: '#9b59b6' },
  { key: 'hip', label: 'Hip', color: '#f1c40f' },
  { key: 'flashing', label: 'Flashing', color: '#e74c3c' },
];

const TYPE_COLORS = Object.fromEntries(LINE_TYPES.map(t => [t.key, t.color]));

const PITCH_OPTIONS = [
  { label: 'Flat', deg: 0 },
  { label: '1/12', deg: 4.76 },
  { label: '2/12', deg: 9.46 },
  { label: '3/12', deg: 14.04 },
  { label: '4/12', deg: 18.43 },
  { label: '5/12', deg: 22.62 },
  { label: '6/12', deg: 26.57 },
  { label: '7/12', deg: 30.26 },
  { label: '8/12', deg: 33.69 },
  { label: '9/12', deg: 36.87 },
  { label: '10/12', deg: 39.81 },
  { label: '11/12', deg: 42.51 },
  { label: '12/12', deg: 45.0 },
];

const FACET_COLORS = ['#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#f1c40f', '#e74c3c', '#1abc9c', '#ff6b9d'];

function haversineDistanceFt(c1, c2) {
  return haversineFt(c1, c2);
}

/** Convert a solar segment (center + dims + azimuth) to polygon vertices [lng,lat][] */
function solarSegmentToVertices(seg) {
  if (!seg.center) return null;
  const { lat: cLat, lng: cLng } = seg.center;
  const halfW = (seg.width_m || 5) / 2;
  const halfD = (seg.depth_m || 5) / 2;
  const azRad = ((seg.azimuth || 0) * Math.PI) / 180;
  const offsetLatLng = (dxM, dyM) => {
    const latOff = dyM / 111320;
    const lngOff = dxM / (111320 * Math.cos((cLat * Math.PI) / 180));
    return [cLng + lngOff, cLat + latOff];
  };
  return [[-halfW, -halfD], [halfW, -halfD], [halfW, halfD], [-halfW, halfD]].map(([lx, ly]) => {
    const dx = lx * Math.cos(azRad) + ly * Math.sin(azRad);
    const dy = -lx * Math.sin(azRad) + ly * Math.cos(azRad);
    return offsetLatLng(dx, dy);
  });
}

let lineIdCounter = 0;
let facetIdCounter = 0;

export default function RoofDrawingTool({ propertyId, lat, lng, address, roofPitchDegrees, hasExistingData, existingEdges, solarSegments, roofOutline, onSave, onClose }) {
  // Mode: 'lines' or 'facets'
  const [drawMode, setDrawMode] = useState('facets');

  // Line mode state
  const [lines, setLines] = useState([]);
  const [activeType, setActiveType] = useState('ridge');
  const [drawingStart, setDrawingStart] = useState(null);

  // Facet mode state
  const [facets, setFacets] = useState([]);
  const [activeFacetVerts, setActiveFacetVerts] = useState([]);
  const [selectedFacetId, setSelectedFacetId] = useState(null);

  // Shared state
  const [pitchDeg, setPitchDeg] = useState(parseFloat(roofPitchDegrees) || 0);
  const [saving, setSaving] = useState(false);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const drawingStartRef = useRef(null);
  const activeTypeRef = useRef(activeType);
  const drawModeRef = useRef(drawMode);
  const activeFacetVertsRef = useRef([]);
  const facetsRef = useRef([]);

  // Pre-populate facets from Google Solar segments
  const [solarLoaded, setSolarLoaded] = useState(false);
  useEffect(() => {
    if (solarLoaded || !solarSegments?.length) return;
    const preloaded = solarSegments.map((seg, i) => {
      // dataLayers polygons have vertices directly
      let vertices = seg.polygon?.length > 0 ? [...seg.polygon] : solarSegmentToVertices(seg);
      if (!vertices || vertices.length < 3) return null;
      const id = `solar_${++facetIdCounter}`;
      return {
        id,
        vertices,
        pitchDeg: seg.pitch || parseFloat(roofPitchDegrees) || 0,
        color: FACET_COLORS[i % FACET_COLORS.length],
        fromSolar: true,
      };
    }).filter(Boolean);
    if (preloaded.length > 0) setFacets(preloaded);
    setSolarLoaded(true);
  }, [solarSegments, solarLoaded, roofPitchDegrees]);

  useEffect(() => { activeTypeRef.current = activeType; }, [activeType]);
  useEffect(() => { drawingStartRef.current = drawingStart; }, [drawingStart]);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { activeFacetVertsRef.current = activeFacetVerts; }, [activeFacetVerts]);
  useEffect(() => { facetsRef.current = facets; }, [facets]);

  // Line mode totals
  const lineTotals = {};
  LINE_TYPES.forEach(t => { lineTotals[t.key] = 0; });
  lines.forEach(l => { lineTotals[l.type] += l.lengthFt; });
  const totalEdgeFt = lines.reduce((s, l) => s + l.lengthFt, 0);

  let lineEstSqft = 0;
  if (lineTotals.eave > 0 && (lineTotals.rake > 0 || lineTotals.ridge > 0)) {
    const avgWidth = lineTotals.ridge > 0 ? (lineTotals.eave + lineTotals.ridge) / 2 : lineTotals.eave;
    const rakePerSide = lineTotals.rake > 0 ? lineTotals.rake / 2 : (lineTotals.eave / 4);
    lineEstSqft = Math.round(avgWidth * rakePerSide);
  }

  // Facet mode computed values
  const facetEdgeData = useMemo(() => {
    if (facets.length === 0) return { edges: [], totals: { ridge: 0, eave: 0, rake: 0, valley: 0, hip: 0, flashing: 0 } };
    return classifyEdges(facets);
  }, [facets]);

  const facetTotalArea = useMemo(() => {
    return facets.reduce((sum, f) => {
      const footprint = polygonAreaSqFt(f.vertices);
      return sum + trueRoofArea(footprint, f.pitchDeg);
    }, 0);
  }, [facets]);

  const facetTotalEdgeFt = useMemo(() => {
    return Object.values(facetEdgeData.totals).reduce((s, v) => s + v, 0);
  }, [facetEdgeData]);

  // Clear preview sources helper
  const clearPreview = useCallback((m) => {
    if (m?.getSource('preview-line')) m.getSource('preview-line').setData({ type: 'FeatureCollection', features: [] });
    if (m?.getSource('start-point')) m.getSource('start-point').setData({ type: 'FeatureCollection', features: [] });
    if (m?.getSource('facet-preview')) m.getSource('facet-preview').setData({ type: 'FeatureCollection', features: [] });
    if (m?.getSource('facet-vertices-preview')) m.getSource('facet-vertices-preview').setData({ type: 'FeatureCollection', features: [] });
  }, []);

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const m = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [lng, lat],
      zoom: 20,
      pitch: 0,
      bearing: 0,
    });
    mapRef.current = m;

    m.on('load', () => {
      // Solar segments overlay
      m.addSource('solar-segments', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'solar-segments-fill', type: 'fill', source: 'solar-segments', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.25 } });
      m.addLayer({ id: 'solar-segments-outline', type: 'line', source: 'solar-segments', paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.7, 'line-dasharray': [4, 2] } });
      m.addLayer({ id: 'solar-segments-labels', type: 'symbol', source: 'solar-segments', layout: { 'text-field': ['get', 'label'], 'text-size': 10, 'text-allow-overlap': true }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.5 } });

      // Roof outline
      m.addSource('roof-outline', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'roof-outline-layer', type: 'line', source: 'roof-outline', paint: { 'line-color': '#00ffcc', 'line-width': 2.5, 'line-opacity': 0.8 } });

      // Completed facets
      m.addSource('facet-polygons', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'facet-fill', type: 'fill', source: 'facet-polygons', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.3 } });
      m.addLayer({ id: 'facet-outline', type: 'line', source: 'facet-polygons', paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.9 } });
      m.addLayer({ id: 'facet-labels', type: 'symbol', source: 'facet-polygons', layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-allow-overlap': true }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.5 } });

      // Completed facet vertices (draggable)
      m.addSource('facet-verts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'facet-verts-layer', type: 'circle', source: 'facet-verts', paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' } });

      // Classified edge lines
      m.addSource('classified-edges', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'classified-edges-layer', type: 'line', source: 'classified-edges', paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.85 } });
      m.addLayer({ id: 'classified-edges-labels', type: 'symbol', source: 'classified-edges', layout: { 'text-field': ['get', 'label'], 'text-size': 10, 'text-offset': [0, -1], 'text-allow-overlap': true }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.5 } });

      // Active facet preview (polygon being drawn)
      m.addSource('facet-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'facet-preview-fill', type: 'fill', source: 'facet-preview', paint: { 'fill-color': '#00d4ff', 'fill-opacity': 0.15 } });
      m.addLayer({ id: 'facet-preview-line', type: 'line', source: 'facet-preview', paint: { 'line-color': '#00d4ff', 'line-width': 2, 'line-dasharray': [4, 2], 'line-opacity': 0.8 } });

      // Active facet vertices preview
      m.addSource('facet-vertices-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'facet-vertices-preview-layer', type: 'circle', source: 'facet-vertices-preview', paint: { 'circle-radius': ['get', 'radius'], 'circle-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });

      // Line mode sources
      m.addSource('roof-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'roof-lines-layer', type: 'line', source: 'roof-lines', paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.9 } });
      m.addLayer({ id: 'roof-lines-labels', type: 'symbol', source: 'roof-lines', layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, -1], 'text-allow-overlap': true }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.5 } });

      // Preview line (line mode) + label
      m.addSource('preview-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'preview-line-layer', type: 'line', source: 'preview-line', paint: { 'line-color': '#fff', 'line-width': 2, 'line-dasharray': [3, 3], 'line-opacity': 0.7 } });
      m.addLayer({ id: 'preview-label', type: 'symbol', source: 'preview-line', layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-offset': [0, -1.2], 'text-allow-overlap': true }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.5 } });

      // Start point
      m.addSource('start-point', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'start-point-layer', type: 'circle', source: 'start-point', paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#000' } });
    });

    // Click handler
    m.on('click', (e) => {
      const rawCoord = [e.lngLat.lng, e.lngLat.lat];

      if (drawModeRef.current === 'facets') {
        // Facet mode: build polygon vertex by vertex
        const verts = activeFacetVertsRef.current;
        const allFacets = facetsRef.current;

        // Snap to existing vertices
        const { snapped } = snapToVertex(rawCoord, allFacets, m, 10);

        // Check if closing the polygon (clicking near first vertex)
        if (verts.length >= 3 && isNearFirstVertex(rawCoord, verts[0], m, 14)) {
          // Close polygon → create facet
          const id = `facet_${++facetIdCounter}`;
          const color = FACET_COLORS[allFacets.length % FACET_COLORS.length];
          setFacets(prev => [...prev, { id, vertices: [...verts], pitchDeg: pitchDeg, color }]);
          setActiveFacetVerts([]);
          return;
        }

        // Also snap to active polygon's existing vertices (for adjacent facets being drawn)
        let coord = snapped;
        if (verts.length > 0) {
          // Check snap to own verts (except first, which is handled above)
          for (let i = 1; i < verts.length; i++) {
            const p1 = m.project(coord);
            const p2 = m.project(verts[i]);
            if (Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2) < 10) {
              coord = verts[i];
              break;
            }
          }
        }

        setActiveFacetVerts(prev => [...prev, coord]);
      } else {
        // Line mode: two-click line drawing
        const start = drawingStartRef.current;
        if (!start) {
          drawingStartRef.current = rawCoord;
          setDrawingStart(rawCoord);
          if (m.getSource('start-point')) {
            m.getSource('start-point').setData({
              type: 'FeatureCollection',
              features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: rawCoord }, properties: {} }],
            });
          }
        } else {
          const lengthFt = Math.round(haversineDistanceFt(start, rawCoord));
          const type = activeTypeRef.current;
          const id = `line_${++lineIdCounter}`;
          setLines(prev => [...prev, { id, type, coords: [start, rawCoord], lengthFt }]);
          drawingStartRef.current = null;
          setDrawingStart(null);
          if (m.getSource('preview-line')) m.getSource('preview-line').setData({ type: 'FeatureCollection', features: [] });
          if (m.getSource('start-point')) m.getSource('start-point').setData({ type: 'FeatureCollection', features: [] });
        }
      }
    });

    // Mousemove handler
    m.on('mousemove', (e) => {
      const coord = [e.lngLat.lng, e.lngLat.lat];

      if (drawModeRef.current === 'facets') {
        const verts = activeFacetVertsRef.current;
        if (verts.length === 0 || !m.getSource('facet-preview')) return;

        // Check if near first vertex for close indicator
        const nearFirst = verts.length >= 3 && isNearFirstVertex(coord, verts[0], m, 14);

        // Show preview polygon
        const previewVerts = [...verts, nearFirst ? verts[0] : coord];
        if (previewVerts.length >= 3) {
          const closed = [...previewVerts, previewVerts[0]];
          m.getSource('facet-preview').setData({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [closed] }, properties: {} }],
          });
        } else {
          m.getSource('facet-preview').setData({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: previewVerts }, properties: {} }],
          });
        }

        // Show vertex dots with first vertex highlighted
        const vertFeatures = verts.map((v, i) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: v },
          properties: { color: i === 0 ? '#00ff88' : '#00d4ff', radius: i === 0 ? 7 : 5 },
        }));
        m.getSource('facet-vertices-preview').setData({ type: 'FeatureCollection', features: vertFeatures });

        // Show edge length for last segment
        const lastVert = verts[verts.length - 1];
        const dist = Math.round(haversineDistanceFt(lastVert, coord));
        m.getSource('preview-line').setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [lastVert, coord] },
            properties: { label: `${dist} ft` },
          }],
        });

        // Change cursor when near first vertex
        m.getCanvas().style.cursor = nearFirst ? 'pointer' : 'crosshair';
      } else {
        const start = drawingStartRef.current;
        if (!start || !m.getSource('preview-line')) return;
        const dist = Math.round(haversineDistanceFt(start, coord));
        m.getSource('preview-line').setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [start, coord] },
            properties: { label: `${dist} ft` },
          }],
        });
      }
    });

    m.getCanvas().style.cursor = 'crosshair';
    return () => { m.remove(); mapRef.current = null; };
  }, [lat, lng]);

  // Sync lines to map (line mode)
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.getSource('roof-lines')) return;
    const features = lines.map(l => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: l.coords },
      properties: {
        color: TYPE_COLORS[l.type] || '#fff',
        label: `${LINE_TYPES.find(t => t.key === l.type)?.label || l.type} ${l.lengthFt}ft`,
      },
    }));
    m.getSource('roof-lines').setData({ type: 'FeatureCollection', features });
  }, [lines]);

  // Sync facets to map (facet mode)
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.getSource('facet-polygons')) return;

    // Facet polygons
    const polyFeatures = facets.map(f => {
      const closed = [...f.vertices, f.vertices[0]];
      const footprint = Math.round(polygonAreaSqFt(f.vertices));
      const trueArea = Math.round(trueRoofArea(footprint, f.pitchDeg));
      const pitchLabel = PITCH_OPTIONS.find(p => Math.abs(p.deg - f.pitchDeg) < 0.5)?.label || `${f.pitchDeg.toFixed(1)}°`;
      const centroid = polygonCentroid(f.vertices);
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [closed] },
        properties: {
          color: f.id === selectedFacetId ? '#fff' : f.color,
          label: `${trueArea} sqft (${pitchLabel})`,
          centroid,
        },
      };
    });
    m.getSource('facet-polygons').setData({ type: 'FeatureCollection', features: polyFeatures });

    // Facet vertices
    const vertFeatures = facets.flatMap(f =>
      f.vertices.map(v => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: v },
        properties: { color: f.color },
      }))
    );
    m.getSource('facet-verts').setData({ type: 'FeatureCollection', features: vertFeatures });

    // Classified edges
    const edgeFeatures = facetEdgeData.edges.map(edge => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [edge.v1, edge.v2] },
      properties: {
        color: TYPE_COLORS[edge.type] || '#fff',
        label: `${LINE_TYPES.find(t => t.key === edge.type)?.label || edge.type} ${Math.round(edge.lengthFt)}ft`,
      },
    }));
    if (m.getSource('classified-edges')) {
      m.getSource('classified-edges').setData({ type: 'FeatureCollection', features: edgeFeatures });
    }
  }, [facets, facetEdgeData, selectedFacetId]);

  // Solar segments are now pre-loaded as editable facets — no separate overlay needed

  // Sync roof outline
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.getSource('roof-outline') || !roofOutline?.length) return;
    m.getSource('roof-outline').setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [roofOutline] }, properties: {} }],
    });
  }, [roofOutline]);

  // Escape key to cancel active drawing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (drawModeRef.current === 'facets' && activeFacetVertsRef.current.length > 0) {
          setActiveFacetVerts([]);
          clearPreview(mapRef.current);
        } else if (drawModeRef.current === 'lines' && drawingStartRef.current) {
          setDrawingStart(null);
          drawingStartRef.current = null;
          clearPreview(mapRef.current);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearPreview]);

  const handleUndo = () => {
    if (drawMode === 'facets') {
      if (activeFacetVerts.length > 0) {
        setActiveFacetVerts(prev => prev.slice(0, -1));
        if (activeFacetVerts.length <= 1) clearPreview(mapRef.current);
      } else {
        setFacets(prev => prev.slice(0, -1));
      }
    } else {
      if (drawingStart) {
        setDrawingStart(null);
        drawingStartRef.current = null;
        clearPreview(mapRef.current);
      } else {
        setLines(prev => prev.slice(0, -1));
      }
    }
  };

  const handleClear = () => {
    if (drawMode === 'facets') {
      setFacets([]);
      setActiveFacetVerts([]);
      setSelectedFacetId(null);
    } else {
      setLines([]);
      setDrawingStart(null);
      drawingStartRef.current = null;
    }
    clearPreview(mapRef.current);
  };

  // Switch modes: clear preview state
  const handleModeSwitch = (mode) => {
    setDrawMode(mode);
    setDrawingStart(null);
    drawingStartRef.current = null;
    setActiveFacetVerts([]);
    clearPreview(mapRef.current);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (drawMode === 'facets') {
        const totals = facetEdgeData.totals;
        const totalArea = Math.round(facetTotalArea);
        // Weighted average pitch
        const weightedPitch = facets.length > 0
          ? facets.reduce((s, f) => s + f.pitchDeg * polygonAreaSqFt(f.vertices), 0) / facets.reduce((s, f) => s + polygonAreaSqFt(f.vertices), 0)
          : pitchDeg;

        await manualRoofEntry(propertyId, {
          roof_sqft: totalArea || undefined,
          roof_pitch_degrees: Math.round(weightedPitch * 10) / 10 || undefined,
          roof_segments: facets.length || undefined,
          roof_ridge_ft: Math.round(totals.ridge) || undefined,
          roof_valley_ft: Math.round(totals.valley) || undefined,
          roof_eave_ft: Math.round(totals.eave) || undefined,
          roof_rake_ft: Math.round(totals.rake) || undefined,
          roof_hip_ft: Math.round(totals.hip) || undefined,
          roof_drip_edge_ft: Math.round(totals.eave + totals.rake) || undefined,
          roof_flashing_ft: Math.round(totals.flashing) || undefined,
          source_type: 'drawing',
          additive: hasExistingData || false,
        });
      } else {
        await manualRoofEntry(propertyId, {
          roof_sqft: lineEstSqft || undefined,
          roof_pitch_degrees: pitchDeg || undefined,
          roof_segments: new Set(lines.filter(l => l.type === 'ridge').map(l => l.id)).size + 1 || undefined,
          roof_ridge_ft: Math.round(lineTotals.ridge) || undefined,
          roof_valley_ft: Math.round(lineTotals.valley) || undefined,
          roof_eave_ft: Math.round(lineTotals.eave) || undefined,
          roof_rake_ft: Math.round(lineTotals.rake) || undefined,
          roof_hip_ft: Math.round(lineTotals.hip) || undefined,
          roof_drip_edge_ft: Math.round(lineTotals.eave + lineTotals.rake) || undefined,
          roof_flashing_ft: Math.round(lineTotals.flashing) || undefined,
          source_type: 'drawing',
          additive: hasExistingData || false,
        });
      }
      onSave?.();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save measurements');
    } finally {
      setSaving(false);
    }
  };

  const hasData = drawMode === 'facets' ? facets.length > 0 : lines.length > 0;
  const isDrawing = drawMode === 'facets' ? activeFacetVerts.length > 0 : !!drawingStart;

  // Pitch selector for selected facet
  const handleFacetPitchChange = (facetId, deg) => {
    setFacets(prev => prev.map(f => f.id === facetId ? { ...f, pitchDeg: deg } : f));
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', height: '100vh', width: '100vw', background: 'oklch(0.08 0.02 260 / 0.92)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px',
          background: 'oklch(0.14 0.02 260)', borderBottom: '1px solid oklch(0.25 0.02 260)',
          flexWrap: 'wrap',
        }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid oklch(0.30 0.02 260)', marginRight: 8 }}>
            {[{ key: 'facets', label: 'Trace Facets' }, { key: 'lines', label: 'Draw Lines' }].map(mode => (
              <button key={mode.key} onClick={() => handleModeSwitch(mode.key)}
                style={{
                  padding: '5px 12px', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: drawMode === mode.key ? 'var(--accent-blue)' : 'oklch(0.18 0.02 260)',
                  color: drawMode === mode.key ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}>
                {mode.label}
              </button>
            ))}
          </div>

          {/* Line type selector (only in line mode) */}
          {drawMode === 'lines' && LINE_TYPES.map(t => (
            <button key={t.key} onClick={() => setActiveType(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                borderRadius: 6, border: '1px solid',
                borderColor: activeType === t.key ? t.color : 'oklch(0.30 0.02 260)',
                background: activeType === t.key ? `${t.color}22` : 'oklch(0.18 0.02 260)',
                color: activeType === t.key ? t.color : 'var(--text-secondary)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, display: 'inline-block', flexShrink: 0 }} />
              {t.label}
            </button>
          ))}

          <div style={{ width: 1, height: 24, background: 'oklch(0.30 0.02 260)', margin: '0 4px' }} />
          <button onClick={handleUndo} disabled={!hasData && !isDrawing}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid oklch(0.30 0.02 260)', background: 'oklch(0.18 0.02 260)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: !hasData && !isDrawing ? 0.4 : 1 }}>
            Undo
          </button>
          <button onClick={handleClear} disabled={!hasData}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid oklch(0.30 0.02 260)', background: 'oklch(0.18 0.02 260)', color: 'var(--accent-red)', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: !hasData ? 0.4 : 1 }}>
            Clear All
          </button>
        </div>

        {/* Drawing hint */}
        <div style={{
          position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
          background: 'oklch(0.12 0.02 260 / 0.9)', color: '#fff', padding: '6px 14px',
          borderRadius: 20, fontSize: 11, fontWeight: 500, pointerEvents: 'none',
          border: '1px solid oklch(0.30 0.02 260)',
        }}>
          {drawMode === 'facets'
            ? activeFacetVerts.length === 0
              ? 'Click roof corners to trace a facet — Esc to cancel'
              : activeFacetVerts.length < 3
                ? `${activeFacetVerts.length} points placed — need at least 3 to close`
                : 'Click the green dot to close the facet — or keep adding points'
            : drawingStart
              ? `Click to complete ${LINE_TYPES.find(t => t.key === activeType)?.label} line — or click Undo to cancel`
              : `Click on the roof to start drawing a ${LINE_TYPES.find(t => t.key === activeType)?.label} line`
          }
        </div>

        <div ref={mapContainerRef} style={{ flex: 1, minHeight: 0, width: '100%' }} />
      </div>

      {/* Summary panel */}
      <div style={{
        width: 300, background: 'oklch(0.14 0.02 260)', borderLeft: '1px solid oklch(0.25 0.02 260)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid oklch(0.25 0.02 260)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Roof Measurements</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{address}</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {/* Existing Google Solar data */}
          {hasExistingData && existingEdges && (
            <div style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, background: 'oklch(0.20 0.03 250 / 0.3)', border: '1px solid oklch(0.30 0.03 250 / 0.4)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                Google Solar (existing)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: 11 }}>
                {existingEdges.ridge > 0 && <span style={{ color: 'var(--text-secondary)' }}>Ridge: {existingEdges.ridge}ft</span>}
                {existingEdges.eave > 0 && <span style={{ color: 'var(--text-secondary)' }}>Eave: {existingEdges.eave}ft</span>}
                {existingEdges.rake > 0 && <span style={{ color: 'var(--text-secondary)' }}>Rake: {existingEdges.rake}ft</span>}
                {existingEdges.valley > 0 && <span style={{ color: 'var(--text-secondary)' }}>Valley: {existingEdges.valley}ft</span>}
                {existingEdges.hip > 0 && <span style={{ color: 'var(--text-secondary)' }}>Hip: {existingEdges.hip}ft</span>}
                {existingEdges.flashing > 0 && <span style={{ color: 'var(--text-secondary)' }}>Flashing: {existingEdges.flashing}ft</span>}
              </div>
            </div>
          )}

          {drawMode === 'facets' ? (
            /* ===== FACET MODE PANEL ===== */
            <>
              {/* Facet list */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Facets ({facets.length})
              </div>
              {facets.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 12 }}>
                  Trace roof facets by clicking corners on the map
                </div>
              ) : (
                facets.map((f, i) => {
                  const footprint = Math.round(polygonAreaSqFt(f.vertices));
                  const trueArea = Math.round(trueRoofArea(footprint, f.pitchDeg));
                  const isSelected = f.id === selectedFacetId;
                  const pitchLabel = PITCH_OPTIONS.find(p => Math.abs(p.deg - f.pitchDeg) < 0.5)?.label || `${f.pitchDeg.toFixed(1)}°`;
                  return (
                    <div key={f.id} style={{
                      marginBottom: 8, padding: '8px 10px', borderRadius: 8,
                      background: isSelected ? 'oklch(0.20 0.03 250 / 0.3)' : 'oklch(0.18 0.02 260)',
                      border: `1px solid ${isSelected ? f.color : 'oklch(0.25 0.02 260)'}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedFacetId(isSelected ? null : f.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: f.color, display: 'inline-block' }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Facet {i + 1}{f.fromSolar ? ' (Solar)' : ''}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)' }}>{trueArea} sqft</span>
                          <button onClick={(e) => { e.stopPropagation(); setFacets(prev => prev.filter(x => x.id !== f.id)); if (isSelected) setSelectedFacetId(null); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)', fontSize: 10 }} title="Remove facet">
                            ✕
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                        Footprint: {footprint} sqft | Pitch: {pitchLabel} | {f.vertices.length} vertices
                      </div>

                      {/* Per-facet pitch selector when selected */}
                      {isSelected && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid oklch(0.25 0.02 260)' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Pitch for this facet:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {PITCH_OPTIONS.map(p => {
                              const isActive = Math.abs(f.pitchDeg - p.deg) < 0.5;
                              return (
                                <button key={p.label} onClick={(e) => { e.stopPropagation(); handleFacetPitchChange(f.id, p.deg); }}
                                  style={{
                                    padding: '3px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.15s',
                                    border: `1px solid ${isActive ? 'var(--accent-blue)' : 'oklch(0.30 0.02 260)'}`,
                                    background: isActive ? 'oklch(0.72 0.19 250 / 0.15)' : 'oklch(0.18 0.02 260)',
                                    color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                  }}>
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Default pitch for new facets */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Default Pitch (new facets)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {PITCH_OPTIONS.map(p => {
                    const isActive = Math.abs(pitchDeg - p.deg) < 0.5;
                    return (
                      <button key={p.label} onClick={() => setPitchDeg(p.deg)}
                        style={{
                          padding: '4px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.15s',
                          border: `1px solid ${isActive ? 'var(--accent-blue)' : 'oklch(0.30 0.02 260)'}`,
                          background: isActive ? 'oklch(0.72 0.19 250 / 0.15)' : 'oklch(0.18 0.02 260)',
                          color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        }}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto-classified edge totals */}
              {facets.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 16, marginBottom: 8 }}>
                    Auto-Classified Edges
                  </div>
                  {LINE_TYPES.filter(t => t.key !== 'flashing').map(t => (
                    <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid oklch(0.20 0.02 260)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, display: 'inline-block' }} />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.label}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: facetEdgeData.totals[t.key] > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {Math.round(facetEdgeData.totals[t.key])} ft
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid oklch(0.20 0.02 260)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1abc9c', display: 'inline-block' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Drip Edge</span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>(eave+rake)</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: (facetEdgeData.totals.eave + facetEdgeData.totals.rake) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {Math.round(facetEdgeData.totals.eave + facetEdgeData.totals.rake)} ft
                    </span>
                  </div>
                </>
              )}

              {/* Totals */}
              {facets.length > 0 && (
                <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 8, background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(0.25 0.02 260)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Total Roof Area</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-green)' }}>{Math.round(facetTotalArea).toLocaleString()} sq ft</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{Math.ceil(facetTotalArea / 100)} squares</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid oklch(0.25 0.02 260)' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Edge Length</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(facetTotalEdgeFt)} ft</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ===== LINE MODE PANEL ===== */
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                {hasExistingData ? 'Drawing (adding)' : 'Edge Lengths'}
              </div>
              {LINE_TYPES.map(t => (
                <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid oklch(0.20 0.02 260)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, display: 'inline-block' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: lineTotals[t.key] > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {Math.round(lineTotals[t.key])} ft
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid oklch(0.20 0.02 260)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1abc9c', display: 'inline-block' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Drip Edge</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>(eave+rake)</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: (lineTotals.eave + lineTotals.rake) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {Math.round(lineTotals.eave + lineTotals.rake)} ft
                </span>
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 16, marginBottom: 8 }}>Lines ({lines.length})</div>
              {lines.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No lines drawn yet</div>
              ) : (
                lines.map(l => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: TYPE_COLORS[l.type] }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{LINE_TYPES.find(t => t.key === l.type)?.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{l.lengthFt} ft</span>
                      <button onClick={() => setLines(prev => prev.filter(x => x.id !== l.id))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)', fontSize: 10, lineHeight: 1 }} title="Remove line">
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Pitch selector */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Roof Pitch</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {PITCH_OPTIONS.map(p => {
                    const isActive = Math.abs(pitchDeg - p.deg) < 0.5;
                    return (
                      <button key={p.label} onClick={() => setPitchDeg(p.deg)}
                        style={{
                          padding: '4px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.15s',
                          border: `1px solid ${isActive ? 'var(--accent-blue)' : 'oklch(0.30 0.02 260)'}`,
                          background: isActive ? 'oklch(0.72 0.19 250 / 0.15)' : 'oklch(0.18 0.02 260)',
                          color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        }}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  {pitchDeg > 0 ? `${pitchDeg.toFixed(1)}°` : 'Flat (0°)'}
                </div>
              </div>

              {lineEstSqft > 0 && (
                <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 8, background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(0.25 0.02 260)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Estimated Area</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-green)' }}>{lineEstSqft.toLocaleString()} sq ft</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{Math.ceil(lineEstSqft / 100)} squares</div>
                </div>
              )}

              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(0.25 0.02 260)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Edge Length</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(totalEdgeFt)} ft</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid oklch(0.25 0.02 260)', display: 'flex', gap: 8 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid oklch(0.30 0.02 260)', background: 'oklch(0.18 0.02 260)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !hasData}
            style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: !hasData ? 'oklch(0.25 0.02 260)' : 'var(--accent-blue)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: !hasData ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Save Measurements'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
