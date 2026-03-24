import { useEffect, useRef, useState, useCallback } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';
import { getCanvassPins, createCanvassPin, updateCanvassPin, convertCanvassPin, getCanvassStats } from '../api/crm';
import useIsMobile from '../hooks/useIsMobile';
import { MapPinIcon, XMarkIcon, CheckIcon, MapIcon } from '@heroicons/react/24/outline';
import TerritoryManager from './TerritoryManager';

const OUTCOME_OPTIONS = [
  { key: 'not_home', label: 'Not Home', color: 'oklch(0.6 0 0)' },
  { key: 'interested', label: 'Interested', color: 'oklch(0.75 0.18 145)' },
  { key: 'not_interested', label: 'Not Interested', color: 'oklch(0.65 0.2 25)' },
  { key: 'scheduled', label: 'Scheduled', color: 'oklch(0.7 0.15 220)' },
  { key: 'follow_up', label: 'Follow Up', color: 'oklch(0.75 0.15 55)' },
  { key: 'already_customer', label: 'Already Customer', color: 'oklch(0.7 0.12 280)' },
];

const OUTCOME_COLORS = Object.fromEntries(OUTCOME_OPTIONS.map(o => [o.key, o.color]));

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Dark map styles for canvassing
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8899aa' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8899aa' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e1e3a' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export default function CanvassingMode() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const isMobile = useIsMobile();

  const [pins, setPins] = useState([]);
  const [stats, setStats] = useState({ total: 0, outcomes: [] });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState('create'); // 'create' | 'view'
  const [selectedPin, setSelectedPin] = useState(null);
  const [formData, setFormData] = useState({ lat: null, lng: null, address: '', outcome: null, notes: '' });
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [toast, setToast] = useState(null);
  const [showTerritories, setShowTerritories] = useState(false);
  const [mapsApi, setMapsApi] = useState(null);
  const territoryPolygonsRef = useRef([]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const { data } = await getCanvassStats(todayStr());
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  // Load pins for current viewport
  const loadPins = useCallback(async () => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const bbox = `${sw.lng()},${sw.lat()},${ne.lng()},${ne.lat()}`;
    try {
      const { data } = await getCanvassPins({ bbox, date: todayStr() });
      setPins(data);
    } catch { /* ignore */ }
  }, []);

  // Initialize map
  useEffect(() => {
    let map;
    loadGoogleMaps().then((maps) => {
      setMapsApi(maps);
      map = new maps.Map(mapContainer.current, {
        center: { lat: 32.7, lng: -97.3 },
        zoom: 15,
        mapTypeId: 'roadmap',
        gestureHandling: 'greedy',
        disableDefaultUI: true,
        zoomControl: !isMobile,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: DARK_MAP_STYLES,
      });
      mapRef.current = map;

      // Try to center on user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => { /* keep default center */ },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }

      map.addListener('idle', () => {
        loadPins();
      });

      loadStats();
    });

    return () => {
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Render markers when pins change
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    pins.forEach((pin) => {
      if (pin.lat == null || pin.lng == null) return;
      const color = OUTCOME_COLORS[pin.outcome] || 'oklch(0.6 0 0)';
      const marker = new window.google.maps.Marker({
        position: { lat: parseFloat(pin.lat), lng: parseFloat(pin.lng) },
        map: mapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: 'rgba(255,255,255,0.4)',
          strokeWeight: 2,
        },
        title: pin.outcome || 'Pin',
      });

      marker.addListener('click', () => {
        setSelectedPin(pin);
        setSheetMode('view');
        setSheetOpen(true);
      });

      markersRef.current.push(marker);
    });
  }, [pins]);

  // Drop pin flow
  const handleDropPin = useCallback(() => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setFormData({ lat: latitude, lng: longitude, address: '', outcome: null, notes: '' });
        setSheetMode('create');
        setSheetOpen(true);

        // Center map on pin
        if (mapRef.current) {
          mapRef.current.panTo({ lat: latitude, lng: longitude });
        }
      },
      (err) => {
        setGeoError(`GPS error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Save pin
  const handleSave = useCallback(async () => {
    if (!formData.outcome) return;
    setSaving(true);
    try {
      await createCanvassPin({
        lat: formData.lat,
        lng: formData.lng,
        outcome: formData.outcome,
        notes: formData.notes || '',
        address: formData.address || '',
      });
      setSheetOpen(false);
      setFormData({ lat: null, lng: null, address: '', outcome: null, notes: '' });
      loadPins();
      loadStats();
      showToast('Pin saved');
    } catch (err) {
      showToast('Failed to save pin');
    } finally {
      setSaving(false);
    }
  }, [formData, loadPins, loadStats]);

  // Convert to lead
  const handleConvert = useCallback(async () => {
    if (!selectedPin) return;
    setConverting(true);
    try {
      const { data } = await convertCanvassPin(selectedPin.id);
      setSheetOpen(false);
      setSelectedPin(null);
      loadPins();
      loadStats();
      showToast(`Lead created (ID: ${data.id.slice(0, 8)}...)`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to convert';
      showToast(msg);
    } finally {
      setConverting(false);
    }
  }, [selectedPin, loadPins, loadStats]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Stat counts
  const interestedCount = stats.outcomes?.find(o => o.outcome === 'interested')?.count || 0;
  const scheduledCount = stats.outcomes?.find(o => o.outcome === 'scheduled')?.count || 0;

  return (
    <div className="main-content" style={{ padding: 0, overflow: 'hidden', position: 'relative', height: '100%' }}>
      {/* Map */}
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

      {/* Stats bar */}
      <div className="glass" style={styles.statsBar}>
        <span style={styles.statItem}>
          <strong style={{ color: 'oklch(0.9 0 0)' }}>{stats.total}</strong> doors
        </span>
        <span style={styles.statDivider} />
        <span style={styles.statItem}>
          <strong style={{ color: 'oklch(0.75 0.18 145)' }}>{interestedCount}</strong> interested
        </span>
        <span style={styles.statDivider} />
        <span style={styles.statItem}>
          <strong style={{ color: 'oklch(0.7 0.15 220)' }}>{scheduledCount}</strong> scheduled
        </span>
      </div>

      {/* Territory toggle button */}
      <button
        onClick={() => setShowTerritories(s => !s)}
        title="Manage Territories"
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          width: 40, height: 40, borderRadius: 'var(--radius-sm)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: showTerritories ? 'oklch(0.55 0.2 250)' : 'oklch(0.2 0.02 260 / 0.8)',
          color: 'oklch(0.95 0 0)', backdropFilter: 'blur(12px)',
          boxShadow: '0 2px 8px oklch(0 0 0 / 0.3)', transition: 'background 0.15s',
        }}
      >
        <MapIcon style={{ width: 20, height: 20 }} />
      </button>

      {/* Territory Manager Panel */}
      {showTerritories && (
        <TerritoryManager
          mapRef={mapRef}
          mapsApi={mapsApi}
          onTerritoryPolygonsChange={(polys) => { territoryPolygonsRef.current = polys; }}
        />
      )}

      {/* GPS Error */}
      {geoError && (
        <div style={styles.geoError}>
          {geoError}
          <button onClick={() => setGeoError(null)} style={styles.geoErrorClose}>&times;</button>
        </div>
      )}

      {/* Drop Pin FAB */}
      {!sheetOpen && (
        <button onClick={handleDropPin} style={styles.fab} title="Drop Pin">
          <MapPinIcon width={28} height={28} />
          <span style={{ marginLeft: 8, fontWeight: 600 }}>Drop Pin</span>
        </button>
      )}

      {/* Bottom Sheet */}
      {sheetOpen && (
        <div className="glass" style={{
          ...styles.sheet,
          maxHeight: isMobile ? '70vh' : '50vh',
        }}>
          {/* Header */}
          <div style={styles.sheetHeader}>
            <h3 style={{ margin: 0, fontSize: 16, color: 'oklch(0.95 0 0)' }}>
              {sheetMode === 'create' ? 'New Pin' : (selectedPin?.outcome || 'Pin Details')}
            </h3>
            <button onClick={() => { setSheetOpen(false); setSelectedPin(null); }} style={styles.closeBtn}>
              <XMarkIcon width={20} height={20} />
            </button>
          </div>

          {sheetMode === 'create' ? (
            <div style={styles.sheetBody}>
              {/* Coordinates */}
              <div style={styles.coordRow}>
                <span style={styles.coordLabel}>GPS</span>
                <span style={styles.coordValue}>
                  {formData.lat?.toFixed(6)}, {formData.lng?.toFixed(6)}
                </span>
              </div>

              {/* Address */}
              <input
                type="text"
                placeholder="Address (optional)"
                value={formData.address}
                onChange={(e) => setFormData(f => ({ ...f, address: e.target.value }))}
                style={styles.input}
              />

              {/* Outcome quick-select */}
              <div style={styles.outcomeLabel}>Outcome</div>
              <div style={styles.outcomeGrid}>
                {OUTCOME_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setFormData(f => ({ ...f, outcome: opt.key }))}
                    style={{
                      ...styles.outcomeBtn,
                      background: formData.outcome === opt.key ? opt.color : 'oklch(0.2 0.01 260 / 0.6)',
                      borderColor: formData.outcome === opt.key ? opt.color : 'oklch(0.4 0 0 / 0.3)',
                      color: formData.outcome === opt.key ? 'oklch(0.1 0 0)' : 'oklch(0.8 0 0)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Notes */}
              <textarea
                placeholder="Notes (optional)"
                value={formData.notes}
                onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                style={styles.textarea}
                rows={2}
              />

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving || !formData.outcome}
                style={{
                  ...styles.saveBtn,
                  opacity: saving || !formData.outcome ? 0.5 : 1,
                }}
              >
                <CheckIcon width={18} height={18} />
                <span style={{ marginLeft: 6 }}>{saving ? 'Saving...' : 'Save Pin'}</span>
              </button>
            </div>
          ) : (
            <div style={styles.sheetBody}>
              {/* View existing pin */}
              {selectedPin && (
                <>
                  <div style={styles.coordRow}>
                    <span style={styles.coordLabel}>GPS</span>
                    <span style={styles.coordValue}>
                      {parseFloat(selectedPin.lat).toFixed(6)}, {parseFloat(selectedPin.lng).toFixed(6)}
                    </span>
                  </div>
                  {selectedPin.address && (
                    <div style={styles.coordRow}>
                      <span style={styles.coordLabel}>Address</span>
                      <span style={styles.coordValue}>{selectedPin.address}</span>
                    </div>
                  )}
                  <div style={styles.coordRow}>
                    <span style={styles.coordLabel}>Outcome</span>
                    <span style={{
                      ...styles.coordValue,
                      color: OUTCOME_COLORS[selectedPin.outcome] || 'oklch(0.8 0 0)',
                      fontWeight: 600,
                    }}>
                      {OUTCOME_OPTIONS.find(o => o.key === selectedPin.outcome)?.label || selectedPin.outcome}
                    </span>
                  </div>
                  {selectedPin.notes && (
                    <div style={styles.coordRow}>
                      <span style={styles.coordLabel}>Notes</span>
                      <span style={styles.coordValue}>{selectedPin.notes}</span>
                    </div>
                  )}
                  <div style={styles.coordRow}>
                    <span style={styles.coordLabel}>By</span>
                    <span style={styles.coordValue}>{selectedPin.user_name}</span>
                  </div>
                  <div style={styles.coordRow}>
                    <span style={styles.coordLabel}>Time</span>
                    <span style={styles.coordValue}>
                      {new Date(selectedPin.created_at).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Convert to lead button — for interested/scheduled pins without lead_id */}
                  {!selectedPin.lead_id && ['interested', 'scheduled'].includes(selectedPin.outcome) && (
                    <button
                      onClick={handleConvert}
                      disabled={converting}
                      style={{
                        ...styles.saveBtn,
                        background: 'oklch(0.7 0.15 220)',
                        opacity: converting ? 0.5 : 1,
                      }}
                    >
                      <span>{converting ? 'Converting...' : 'Convert to Lead'}</span>
                    </button>
                  )}
                  {selectedPin.lead_id && (
                    <div style={{
                      marginTop: 12,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'oklch(0.75 0.18 145 / 0.15)',
                      color: 'oklch(0.75 0.18 145)',
                      fontSize: 13,
                      textAlign: 'center',
                    }}>
                      Already converted to lead
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={styles.toast}>{toast}</div>
      )}
    </div>
  );
}

const styles = {
  statsBar: {
    position: 'absolute',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    padding: '8px 16px',
    borderRadius: 12,
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: 'oklch(0.75 0 0)',
  },
  statDivider: {
    width: 1,
    height: 16,
    background: 'oklch(0.4 0 0 / 0.4)',
    margin: '0 10px',
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    padding: '14px 24px',
    borderRadius: 999,
    border: 'none',
    background: 'oklch(0.55 0.2 250)',
    color: 'oklch(0.98 0 0)',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 20px oklch(0 0 0 / 0.5)',
    minHeight: 52,
    minWidth: 160,
    justifyContent: 'center',
    transition: 'background 0.15s, transform 0.1s',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    borderRadius: '16px 16px 0 0',
    padding: '16px 20px 24px',
    overflowY: 'auto',
  },
  sheetHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'oklch(0.7 0 0)',
    cursor: 'pointer',
    padding: 6,
    minWidth: 44,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  coordRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
  },
  coordLabel: {
    color: 'oklch(0.6 0 0)',
    minWidth: 56,
    flexShrink: 0,
  },
  coordValue: {
    color: 'oklch(0.85 0 0)',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid oklch(0.35 0 0 / 0.4)',
    background: 'oklch(0.15 0.01 260 / 0.6)',
    color: 'oklch(0.9 0 0)',
    fontSize: 14,
    outline: 'none',
    minHeight: 44,
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid oklch(0.35 0 0 / 0.4)',
    background: 'oklch(0.15 0.01 260 / 0.6)',
    color: 'oklch(0.9 0 0)',
    fontSize: 14,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    minHeight: 44,
    boxSizing: 'border-box',
  },
  outcomeLabel: {
    fontSize: 12,
    color: 'oklch(0.6 0 0)',
    fontWeight: 500,
    marginTop: 4,
  },
  outcomeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  outcomeBtn: {
    padding: '10px 8px',
    borderRadius: 8,
    border: '1px solid oklch(0.4 0 0 / 0.3)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    textAlign: 'center',
    minHeight: 44,
    transition: 'all 0.15s',
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 16px',
    borderRadius: 10,
    border: 'none',
    background: 'oklch(0.55 0.2 250)',
    color: 'oklch(0.98 0 0)',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 48,
    marginTop: 4,
    transition: 'opacity 0.15s',
  },
  geoError: {
    position: 'absolute',
    top: 60,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 15,
    background: 'oklch(0.35 0.15 25)',
    color: 'oklch(0.95 0 0)',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  geoErrorClose: {
    background: 'none',
    border: 'none',
    color: 'oklch(0.9 0 0)',
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
    minWidth: 44,
    minHeight: 44,
  },
  toast: {
    position: 'absolute',
    bottom: 90,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 25,
    background: 'oklch(0.25 0.02 260 / 0.9)',
    color: 'oklch(0.9 0 0)',
    padding: '10px 20px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 500,
    backdropFilter: 'blur(12px)',
    boxShadow: '0 4px 16px oklch(0 0 0 / 0.4)',
  },
};
