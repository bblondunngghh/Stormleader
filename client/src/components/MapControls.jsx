const timeRanges = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'All' },
];

const layerToggles = [
  { id: 'hail', label: 'Hail Reports' },
  { id: 'wind', label: 'Wind Reports' },
  { id: 'tornado', label: 'Tornadoes' },
  { id: 'drift', label: 'Wind Drift Correction' },
  { id: 'properties', label: 'Properties' },
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
            />
            {layer.label}
          </label>
        ))}
      </div>
    </div>
  );
}
