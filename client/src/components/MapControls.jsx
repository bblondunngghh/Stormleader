import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

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
        <ChevronDownIcon className={`map-controls__chevron${open ? ' is-open' : ''}`} width={10} height={10} />
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
      {/* Severity Legend */}
      {(layers.hail || layers.wind || layers.tornado) && (
        <div style={{ borderTop: '1px solid oklch(0.5 0 0 / 0.15)', marginTop: 8, paddingTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Severity Scale</div>
          {layers.hail && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>Hail Size</div>
              <div style={{ display: 'flex', gap: 1, borderRadius: 4, overflow: 'hidden', height: 8 }}>
                {['#66d97a','#8fd94e','#b8d92e','#f5c542','#f5a623','#ff8c00','#ff6322','#e84393','#c44dcc','#af52de'].map((c, i) => (
                  <div key={i} style={{ flex: 1, background: c }} title={['<0.5"','0.5"','0.75"','1.0"','1.25"','1.5"','1.75"','2.0"','2.5"','3.0"+'][i]} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>
                <span>Small</span><span>Severe</span>
              </div>
            </div>
          )}
          {layers.wind && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>Wind Speed</div>
              <div style={{ display: 'flex', gap: 1, borderRadius: 4, overflow: 'hidden', height: 8 }}>
                {['#7c8cf5','#6c5ce7','#8b3fd4','#a52ec0','#d41872'].map((c, i) => (
                  <div key={i} style={{ flex: 1, background: c }} title={['<58 mph','58-70','70-85','85-100','100+ mph'][i]} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>
                <span>58 mph</span><span>100+</span>
              </div>
            </div>
          )}
          {layers.tornado && (
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>Tornado (EF Scale)</div>
              <div style={{ display: 'flex', gap: 1, borderRadius: 4, overflow: 'hidden', height: 8 }}>
                {['#ffb347','#ff8c42','#ff5e3a','#ff2d55','#cc0000','#990000'].map((c, i) => (
                  <div key={i} style={{ flex: 1, background: c }} title={`EF${i}`} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>
                <span>EF0</span><span>EF5</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
