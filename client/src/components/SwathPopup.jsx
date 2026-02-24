// SwathPopup — renders HTML string for Mapbox popup content
const SwathPopup = {
  renderHTML(properties) {
    const date = properties.event_start
      ? new Date(properties.event_start).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        })
      : 'Unknown';

    const hailSize = properties.hail_size_max_in
      ? `${properties.hail_size_max_in}"`
      : 'N/A';

    const source = properties.source || 'MRMS';

    return `
      <div class="swath-popup">
        <div class="swath-popup__title">Hail Swath</div>
        <div class="swath-popup__row">
          <span class="swath-popup__label">Date</span>
          <span class="swath-popup__value">${date}</span>
        </div>
        <div class="swath-popup__row">
          <span class="swath-popup__label">Max Hail</span>
          <span class="swath-popup__value">${hailSize}</span>
        </div>
        <div class="swath-popup__row">
          <span class="swath-popup__label">Source</span>
          <span class="swath-popup__value">${source}</span>
        </div>
      </div>
    `;
  },
};

export default SwathPopup;
