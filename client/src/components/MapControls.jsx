import { useState, useRef, useEffect } from 'react';

const timeRanges = [
  { id: '12h', label: '12 Hours' },
  { id: '24h', label: '24 Hours' },
  { id: '3d', label: '3 Days' },
  { id: '7d', label: '7 Days' },
  { id: '14d', label: '14 Days' },
  { id: '30d', label: '30 Days' },
];

const layerToggles = [
  { id: 'hail', label: 'Hail Reports', color: '#dcb428' },
  { id: 'wind', label: 'Wind Reports', color: '#6c5ce7' },
  { id: 'tornado', label: 'Tornadoes', color: '#ff2d55' },
  { id: 'thunderstorm', label: 'Thunderstorms', color: '#ff9500' },
  { id: 'properties', label: 'Properties', color: '#00d4aa' },
  { id: 'honeyHoles', label: 'Honey Holes (Hail History)', color: '#ff6b35' },
];

export function TimeFilter({ timeRange, onTimeRangeChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = timeRanges.find((tr) => tr.id === timeRange);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="map-controls__dropdown" ref={ref}>
      <button
        className="map-controls__dropdown-trigger glass"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{current?.label || 'Select'}</span>
        <svg className={`map-controls__chevron${open ? ' is-open' : ''}`} width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="map-controls__dropdown-menu glass">
          {timeRanges.map((tr) => (
            <button
              key={tr.id}
              className={`map-controls__dropdown-item${tr.id === timeRange ? ' is-active' : ''}`}
              onClick={() => { onTimeRangeChange(tr.id); setOpen(false); }}
            >
              {tr.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LayerPanel({ layers, onLayersChange, improvedOnly, onImprovedOnlyChange, showFema, onShowFemaChange, showCounty, onShowCountyChange }) {
  const handleLayerToggle = (layerId) => {
    onLayersChange((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  return (
    <div className="map-controls__layers glass">
      {layerToggles.map((layer) => (
        <div key={layer.id}>
          <label className="map-controls__toggle">
            <input
              type="checkbox"
              checked={layers[layer.id] || false}
              onChange={() => handleLayerToggle(layer.id)}
              style={{ '--check-color': layer.color }}
            />
            <span>{layer.label}</span>
          </label>
          {/* Wind Drift nested under Hail */}
          {layer.id === 'hail' && layers.hail && (
            <div className="map-controls__sub-row">
              <span className="map-controls__bracket" />
              <label className="map-controls__toggle map-controls__toggle--sub">
                <input
                  type="checkbox"
                  checked={layers.drift || false}
                  onChange={() => handleLayerToggle('drift')}
                  style={{ '--check-color': '#00e5ff' }}
                />
                <span>Wind Drift Correction</span>
              </label>
            </div>
          )}
          {/* Property sub-filters */}
          {layer.id === 'properties' && layers.properties && (
            <>
              <div className="map-controls__sub-row">
                <span className="map-controls__bracket" />
                <label className="map-controls__toggle map-controls__toggle--sub">
                  <input
                    type="checkbox"
                    checked={showCounty || false}
                    onChange={() => onShowCountyChange?.(!showCounty)}
                    style={{ '--check-color': '#00d4aa' }}
                  />
                  <span>County Records</span>
                </label>
              </div>
              {showCounty && (
                <div className="map-controls__sub-row map-controls__sub-row--nested">
                  <span className="map-controls__bracket" />
                  <label className="map-controls__toggle map-controls__toggle--sub">
                    <input
                      type="checkbox"
                      checked={improvedOnly || false}
                      onChange={() => onImprovedOnlyChange?.(!improvedOnly)}
                      style={{ '--check-color': '#00d4aa' }}
                    />
                    <span>Houses Only</span>
                  </label>
                </div>
              )}
              <div className="map-controls__sub-row">
                <span className="map-controls__bracket" />
                <label className="map-controls__toggle map-controls__toggle--sub">
                  <input
                    type="checkbox"
                    checked={showFema || false}
                    onChange={() => onShowFemaChange?.(!showFema)}
                    style={{ '--check-color': '#a882ff' }}
                  />
                  <span>FEMA Records</span>
                </label>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
