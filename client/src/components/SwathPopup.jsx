// SwathPopup — renders HTML string for Mapbox popup content
const SwathPopup = {
  renderHTML(properties) {
    // Parse raw_data if it's a string
    let rawData = properties.raw_data;
    if (typeof rawData === 'string') {
      try { rawData = JSON.parse(rawData); } catch { rawData = {}; }
    }
    rawData = rawData || {};

    const type = rawData.type || 'storm';
    const date = properties.event_start
      ? new Date(properties.event_start).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      : 'Unknown';

    const source = properties.source === 'spc_report' ? 'SPC Report' : (properties.source || 'MRMS');

    const titles = { hail: 'Hail Report', wind: 'Wind Report', tornado: 'Tornado Report', storm: 'Storm Event' };
    const colors = { hail: '#dcb428', wind: '#6c5ce7', tornado: '#ff2d55', storm: '#50b450' };

    let detailRows = '';

    if (type === 'hail' && properties.hail_size_max_in) {
      detailRows += row('Hail Size', `${properties.hail_size_max_in}"`);
    }
    if (type === 'wind' && properties.wind_speed_max_mph) {
      detailRows += row('Wind Speed', `${properties.wind_speed_max_mph} mph`);
    }
    if (type === 'tornado' && rawData.fscale) {
      detailRows += row('F-Scale', rawData.fscale);
    }
    if (rawData.location) {
      detailRows += row('Location', `${rawData.location}${rawData.state ? ', ' + rawData.state : ''}`);
    }
    if (rawData.county) {
      detailRows += row('County', rawData.county);
    }

    return `
      <div class="swath-popup">
        <div class="swath-popup__title" style="color:${colors[type] || colors.storm}">
          ${titles[type] || titles.storm}
        </div>
        <div class="swath-popup__row">
          <span class="swath-popup__label">Date</span>
          <span class="swath-popup__value">${date}</span>
        </div>
        ${detailRows}
        <div class="swath-popup__row">
          <span class="swath-popup__label">Source</span>
          <span class="swath-popup__value">${source}</span>
        </div>
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

export default SwathPopup;
