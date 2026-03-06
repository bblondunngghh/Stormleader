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
  { id: 'drift', label: 'Wind Drift Correction', color: '#00e5ff' },
  { id: 'properties', label: 'Properties', color: '#00d4aa' },
];

export default function MapControls({ timeRange, onTimeRangeChange, layers, onLayersChange }) {
  const handleLayerToggle = (layerId) => {
    onLayersChange((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  return (
    <div className="map-controls">
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
      <div className="map-controls__group glass" style={{ flexDirection: 'column' }}>
        {layerToggles.map((layer) => (
          <label key={layer.id} className="map-controls__toggle">
            <input
              type="checkbox"
              checked={layers[layer.id] || false}
              onChange={() => handleLayerToggle(layer.id)}
              style={{ accentColor: layer.color }}
            />
            <span style={{ color: layers[layer.id] ? layer.color : undefined }}>{layer.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
