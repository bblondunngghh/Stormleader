const timeRanges = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'All' },
];

const layerToggles = [
  { id: 'hail', label: 'Hail Reports', color: '#dcb428' },
  { id: 'wind', label: 'Wind Reports', color: '#6c5ce7' },
  { id: 'tornado', label: 'Tornadoes', color: '#ff2d55' },
  { id: 'properties', label: 'Properties', color: '#00d4aa' },
];

export function TimeFilter({ timeRange, onTimeRangeChange }) {
  return (
    <div className="map-controls__group glass">
      {timeRanges.map((tr) => (
        <button
          key={tr.id}
          className={`map-controls__btn${timeRange === tr.id ? ' is-active' : ''}`}
          onClick={() => onTimeRangeChange(tr.id)}
        >
          {tr.label}
        </button>
      ))}
    </div>
  );
}

export function LayerPanel({ layers, onLayersChange, improvedOnly, onImprovedOnlyChange }) {
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
              style={{ accentColor: layer.color }}
            />
            <span style={{ color: layers[layer.id] ? layer.color : undefined }}>{layer.label}</span>
          </label>
          {/* Wind Drift nested under Hail */}
          {layer.id === 'hail' && layers.hail && (
            <label className="map-controls__toggle map-controls__toggle--sub">
              <input
                type="checkbox"
                checked={layers.drift || false}
                onChange={() => handleLayerToggle('drift')}
                style={{ accentColor: '#00e5ff' }}
              />
              <span style={{ color: layers.drift ? '#00e5ff' : undefined }}>Wind Drift Correction</span>
            </label>
          )}
        </div>
      ))}
      <div style={{ borderTop: '1px solid oklch(1 0 0 / 0.08)', margin: '4px 0', paddingTop: 4 }}>
        <label className="map-controls__toggle">
          <input
            type="checkbox"
            checked={improvedOnly || false}
            onChange={() => onImprovedOnlyChange?.(!improvedOnly)}
            style={{ accentColor: '#ff9500' }}
          />
          <span style={{ color: improvedOnly ? '#ff9500' : undefined }}>Houses Only</span>
        </label>
      </div>
    </div>
  );
}
