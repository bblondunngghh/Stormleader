// SwathPopup — renders HTML string for storm InfoWindow popup content
const SwathPopup = {
  renderHTML(properties) {
    let rawData = properties.raw_data;
    if (typeof rawData === 'string') {
      try { rawData = JSON.parse(rawData); } catch { rawData = {}; }
    }
    rawData = rawData || {};

    // Determine storm type from raw_data.type or by available fields
    const explicitType = rawData.type;
    let type = 'storm';
    if (explicitType === 'hail' || explicitType === 'wind' || explicitType === 'tornado') {
      type = explicitType;
    } else if (properties.hail_size_max_in && !properties.wind_speed_max_mph) {
      type = 'hail';
    } else if (properties.wind_speed_max_mph && !properties.hail_size_max_in) {
      type = 'wind';
    } else if (properties.hail_size_max_in) {
      type = 'hail';
    }

    const titles = {
      hail: 'Hail Report',
      wind: 'Wind Report',
      tornado: 'Tornado Report',
      storm: 'Severe Thunderstorm',
    };
    const colors = {
      hail: '#dcb428',
      wind: '#6c5ce7',
      tornado: '#ff2d55',
      storm: '#50b450',
    };

    const date = properties.event_start
      ? new Date(properties.event_start).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      : null;
    const endDate = properties.event_end
      ? new Date(properties.event_end).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit',
        })
      : null;

    const source = properties.source === 'spc_report' ? 'SPC Report'
      : properties.source === 'nws_alert' ? 'NWS Alert'
      : properties.source === 'mrms_mesh' ? 'MRMS Radar'
      : properties.source || 'Unknown';

    let rows = '';

    // Date/time
    if (date) {
      rows += row('Date', endDate ? `${date} – ${endDate}` : date);
    }

    // Hail size with color bar
    if (properties.hail_size_max_in && properties.hail_size_max_in > 0) {
      const size = Number(properties.hail_size_max_in);
      const desc = hailDesc(size);
      rows += row('Hail Size', `${size}" ${desc ? `<span style="opacity:0.6">(${desc})</span>` : ''}`);
      rows += hailColorBar(size);
    }

    // Wind speed with color bar and details
    const windMph = properties.wind_speed_max_mph || (rawData.maxWindGust ? parseFloat(rawData.maxWindGust) : null);
    const rawSpeed = rawData.speed;
    if (windMph && windMph > 0 && !isNaN(windMph)) {
      const speed = Number(windMph);
      const desc = windDesc(speed);
      rows += row('Wind Speed', `${speed} mph ${desc ? `<span style="opacity:0.6">(${desc})</span>` : ''}`);
      rows += windColorBar(speed);
    } else if (rawSpeed === 'UNK' || (type === 'wind' && !windMph)) {
      rows += row('Wind Speed', '<span style="opacity:0.5">Unknown</span>');
    }
    // Always show wind legend for wind-type events
    if (type === 'wind' && !(windMph && windMph > 0 && !isNaN(windMph))) {
      rows += windColorBar(null);
    }

    // Wind damage description from SPC remarks
    if (rawData.remarks) {
      const remark = rawData.remarks.length > 120 ? rawData.remarks.substring(0, 117) + '...' : rawData.remarks;
      rows += row('Details', `<span style="font-style:italic;opacity:0.8">${remark}</span>`);
    }

    // Severity
    if (rawData.severity) {
      const sevColor = rawData.severity === 'Extreme' ? '#ff2d55'
        : rawData.severity === 'Severe' ? '#ff9500'
        : '#dcb428';
      rows += row('Severity', `<span style="color:${sevColor}">${rawData.severity}</span>`);
    }

    // Location / Area
    if (rawData.areaDesc) {
      rows += row('Area', rawData.areaDesc);
    } else if (rawData.location) {
      rows += row('Location', `${rawData.location}${rawData.state ? ', ' + rawData.state : ''}`);
    }
    if (rawData.county && !rawData.areaDesc) {
      rows += row('County', rawData.county);
    }

    // Hail/wind threat details
    if (rawData.hailThreat) {
      rows += row('Hail Threat', rawData.hailThreat.toLowerCase());
    }
    if (rawData.windThreat) {
      rows += row('Wind Threat', rawData.windThreat.toLowerCase());
    }

    // NWS headline
    if (rawData.headline) {
      const hl = rawData.headline.length > 100 ? rawData.headline.substring(0, 97) + '...' : rawData.headline;
      rows += row('Alert', `<span style="font-size:10px">${hl}</span>`);
    }

    // Tornado scale
    if (rawData.fscale) {
      rows += row('Rating', rawData.fscale);
    }

    // MRMS threshold
    if (rawData.threshold) {
      rows += row('MESH Threshold', `${rawData.threshold}"`);
    }

    // Drift correction
    if (properties.drift_vector_m) {
      const driftMi = (properties.drift_vector_m / 1609.34).toFixed(1);
      rows += row('Wind Drift', `${driftMi} mi correction`);
    }

    // Source
    rows += row('Source', source);

    return `
      <div class="swath-popup">
        <div class="swath-popup__title" style="color:${colors[type] || colors.storm}">
          ${titles[type] || titles.storm}
        </div>
        ${rows}
      </div>
    `;
  },
};

function row(label, value) {
  return `
    <div class="swath-popup__row">
      <span class="swath-popup__label">${label}</span>
      <span class="swath-popup__value">${value}</span>
    </div>
  `;
}

// --- Hail helpers ---

function hailDesc(sizeIn) {
  if (sizeIn < 0.75) return '';
  if (sizeIn < 1.0) return 'penny';
  if (sizeIn < 1.25) return 'quarter';
  if (sizeIn < 1.5) return 'half dollar';
  if (sizeIn < 1.75) return 'ping pong ball';
  if (sizeIn < 2.0) return 'golf ball';
  if (sizeIn < 2.5) return 'hen egg';
  if (sizeIn < 2.75) return 'tennis ball';
  if (sizeIn < 3.0) return 'baseball';
  if (sizeIn < 4.0) return 'softball';
  return 'grapefruit';
}

const HAIL_STOPS = [
  { size: 0.5, color: '#66d97a' },
  { size: 0.75, color: '#8fd94e' },
  { size: 1.0, color: '#f5c542' },
  { size: 1.5, color: '#f5a623' },
  { size: 2.0, color: '#ff6322' },
  { size: 2.5, color: '#e84393' },
  { size: 3.0, color: '#c44dcc' },
  { size: 4.0, color: '#af52de' },
];

function hailColorBar(currentSize) {
  const stops = HAIL_STOPS.map(s => s.color).join(', ');
  const pct = Math.max(0, Math.min(100, ((currentSize - 0.5) / 3.5) * 100));
  return `
    <div style="padding:4px 0 2px;margin-top:2px">
      <div style="position:relative;height:10px;border-radius:5px;background:linear-gradient(to right, ${stops});border:1px solid rgba(255,255,255,0.15)">
        <div style="position:absolute;top:-2px;left:${pct}%;transform:translateX(-50%);width:14px;height:14px;border-radius:50%;border:2px solid #fff;background:rgba(0,0,0,0.4);box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:9px;opacity:0.5;margin-top:2px;padding:0 1px">
        <span>0.5"</span><span>1"</span><span>2"</span><span>3"</span><span>4"+</span>
      </div>
    </div>
  `;
}

// --- Wind helpers ---

function windDesc(mph) {
  if (mph < 58) return 'strong';
  if (mph < 70) return 'severe';
  if (mph < 80) return 'damaging';
  if (mph < 100) return 'destructive';
  if (mph < 130) return 'devastating';
  return 'catastrophic';
}

function windCategory(mph) {
  if (mph < 58) return 'Strong';
  if (mph < 70) return 'Severe';
  if (mph < 80) return 'Damaging';
  if (mph < 100) return 'Destructive';
  if (mph < 130) return 'Devastating';
  return 'Catastrophic';
}

const WIND_STOPS = [
  { speed: 40, color: '#74b9ff' },
  { speed: 58, color: '#6c5ce7' },
  { speed: 70, color: '#a55eea' },
  { speed: 80, color: '#e84393' },
  { speed: 100, color: '#ff3b30' },
  { speed: 130, color: '#d63031' },
];

function windColorBar(currentSpeed) {
  const stops = WIND_STOPS.map(s => s.color).join(', ');
  const hasSpeed = currentSpeed && !isNaN(currentSpeed) && currentSpeed > 0;
  const pct = hasSpeed ? Math.max(0, Math.min(100, ((currentSpeed - 40) / 90) * 100)) : 0;
  const marker = hasSpeed
    ? `<div style="position:absolute;top:-2px;left:${pct}%;transform:translateX(-50%);width:14px;height:14px;border-radius:50%;border:2px solid #fff;background:rgba(0,0,0,0.4);box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>`
    : '';
  return `
    <div style="padding:4px 0 2px;margin-top:2px">
      <div style="position:relative;height:10px;border-radius:5px;background:linear-gradient(to right, ${stops});border:1px solid rgba(255,255,255,0.15)">
        ${marker}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:9px;opacity:0.5;margin-top:2px;padding:0 1px">
        <span>40</span><span>58</span><span>70</span><span>80</span><span>100</span><span>130+</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:8px;opacity:0.35;margin-top:1px;padding:0 1px">
        <span>Strong</span><span>Severe</span><span>Damaging</span><span>Destructive</span>
      </div>
    </div>
  `;
}

export default SwathPopup;
