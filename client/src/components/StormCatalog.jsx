import { useState, useEffect, useRef } from 'react';
import { getStorms } from '../api/storms';
import client from '../api/client';
import DatePicker from './DatePicker';

const TIME_RANGES = [
  { id: '24h', label: '24 Hours' },
  { id: '3d', label: '3 Days' },
  { id: '7d', label: '7 Days' },
  { id: '14d', label: '14 Days' },
  { id: '30d', label: '30 Days' },
];

// Get centroid from server-computed values
function getCentroid(storm) {
  const p = storm.properties || {};
  if (p.centroid_lat && p.centroid_lng) return { lat: p.centroid_lat, lng: p.centroid_lng };
  return null;
}

export default function StormCatalog() {
  const [storms, setStorms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [locations, setLocations] = useState({});
  const [sortBy, setSortBy] = useState('date'); // date | severity | hail | wind
  const [typeFilter, setTypeFilter] = useState(''); // '' | Hail | Wind | Tornado
  const geocodeCacheRef = useRef({});

  const isCustomRange = !!(dateFrom && dateTo);

  const handlePillClick = (id) => {
    setTimeRange(id);
    setDateFrom('');
    setDateTo('');
  };

  const handleDateFromChange = (val) => {
    setDateFrom(val);
    if (val && dateTo) setTimeRange('');
  };

  const handleDateToChange = (val) => {
    setDateTo(val);
    if (dateFrom && val) setTimeRange('');
  };

  const clearDateRange = () => {
    setDateFrom('');
    setDateTo('');
    setTimeRange('30d');
  };

  useEffect(() => {
    setLoading(true);
    const params = { limit: 200 };
    if (isCustomRange) {
      params.dateFrom = dateFrom;
      params.dateTo = dateTo;
    } else if (timeRange) {
      params.timeRange = timeRange;
    }
    getStorms(params)
      .then(({ data }) => {
        const features = data?.features || [];
        setStorms(features.sort((a, b) =>
          new Date(b.properties?.event_start || 0) - new Date(a.properties?.event_start || 0)
        ));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [timeRange, dateFrom, dateTo]);

  // Lazy reverse-geocode storms that don't have location in raw_data
  useEffect(() => {
    if (storms.length === 0) return;
    const toGeocode = storms.filter(s => {
      const rd = s.properties?.raw_data || {};
      if (rd.location || rd.areaDesc) return false; // already has location
      if (geocodeCacheRef.current[s.id]) return false; // already geocoded
      return true;
    }).slice(0, 20); // limit to 20 at a time

    if (toGeocode.length === 0) return;

    let cancelled = false;
    (async () => {
      const newLocs = {};
      for (const s of toGeocode) {
        if (cancelled) break;
        const centroid = getCentroid(s);
        if (!centroid) continue;
        // Round to reduce duplicate lookups for nearby storms
        const key = `${centroid.lat.toFixed(1)},${centroid.lng.toFixed(1)}`;
        if (geocodeCacheRef.current[key]) {
          newLocs[s.id] = geocodeCacheRef.current[key];
          continue;
        }
        try {
          const { data } = await client.get('/properties/reverse-geocode', { params: centroid });
          const label = data.matched && data.city ? `${data.city}, ${data.state || 'TX'}` : null;
          if (label) {
            geocodeCacheRef.current[key] = label;
            geocodeCacheRef.current[s.id] = label;
            newLocs[s.id] = label;
          }
        } catch {}
      }
      if (!cancelled && Object.keys(newLocs).length > 0) {
        setLocations(prev => ({ ...prev, ...newLocs }));
      }
    })();
    return () => { cancelled = true; };
  }, [storms]);

  const typeLabel = (s) => {
    const rd = s.properties?.raw_data;
    if (rd?.type === 'hail' || s.properties?.hail_size_max_in) return 'Hail';
    if (rd?.type === 'wind' || s.properties?.wind_speed_max_mph) return 'Wind';
    if (rd?.type === 'tornado') return 'Tornado';
    if (rd?.type === 'severe_thunderstorm') return 'Severe Thunderstorm';
    const raw = rd?.type || s.properties?.source || 'Storm';
    return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const typeColor = (s) => {
    const label = typeLabel(s);
    if (label === 'Hail') return 'oklch(0.78 0.17 85)';
    if (label === 'Wind') return 'oklch(0.72 0.19 250)';
    if (label === 'Tornado') return 'oklch(0.70 0.20 30)';
    return 'oklch(0.75 0.10 200)';
  };

  const severityRating = (s) => {
    const p = s.properties || {};
    let score = 0;
    const hail = parseFloat(p.hail_size_max_in) || 0;
    const wind = parseFloat(p.wind_speed_max_mph) || 0;
    const type = typeLabel(s);

    if (hail >= 2.5) score += 3;
    else if (hail >= 1.75) score += 2.5;
    else if (hail >= 1.5) score += 2;
    else if (hail >= 1.0) score += 1.5;
    else if (hail >= 0.75) score += 1;
    else if (hail > 0) score += 0.5;

    if (wind >= 80) score += 2;
    else if (wind >= 65) score += 1.5;
    else if (wind >= 58) score += 1;
    else if (wind >= 40) score += 0.5;

    if (type === 'Tornado') score += 2;
    else if (type === 'Severe Thunderstorm') score += 0.5;

    return Math.max(1, Math.min(5, Math.round(score)));
  };

  const severityLabel = (rating) => {
    if (rating >= 5) return 'Extreme';
    if (rating >= 4) return 'Severe';
    if (rating >= 3) return 'Significant';
    if (rating >= 2) return 'Moderate';
    return 'Minor';
  };

  const severityColor = (rating) => {
    if (rating >= 5) return 'oklch(0.60 0.25 30)';
    if (rating >= 4) return 'oklch(0.65 0.20 40)';
    if (rating >= 3) return 'oklch(0.72 0.18 55)';
    if (rating >= 2) return 'oklch(0.75 0.15 85)';
    return 'oklch(0.7 0.10 145)';
  };

  const filtered = storms.filter(s => {
    const p = s.properties || {};
    const rd = p.raw_data || {};
    if (typeFilter && typeLabel(s) !== typeFilter) return false;
    if (search) {
      const text = `${rd.type || ''} ${p.source || ''} ${p.hail_size_max_in || ''} ${p.wind_speed_max_mph || ''} ${rd.location || ''} ${rd.county || ''} ${rd.state || ''} ${rd.areaDesc || ''}`.toLowerCase();
      if (!text.includes(search.toLowerCase())) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'severity') return severityRating(b) - severityRating(a);
    if (sortBy === 'hail') return (parseFloat(b.properties?.hail_size_max_in) || 0) - (parseFloat(a.properties?.hail_size_max_in) || 0);
    if (sortBy === 'wind') return (parseFloat(b.properties?.wind_speed_max_mph) || 0) - (parseFloat(a.properties?.wind_speed_max_mph) || 0);
    return new Date(b.properties?.event_start || 0) - new Date(a.properties?.event_start || 0);
  });

  return (
    <div className="main-content" style={{ padding: 'var(--space-xl)' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Storm Archive</h1>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
        {TIME_RANGES.map(tr => (
          <button key={tr.id}
            className={`btn ${timeRange === tr.id && !isCustomRange ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handlePillClick(tr.id)}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            {tr.label}
          </button>
        ))}

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: 'var(--glass-border)', flexShrink: 0 }} />

        {/* Custom pill - active when date range is set */}
        <button
          className={`btn ${isCustomRange ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: 12, padding: '6px 14px' }}
          onClick={() => {
            if (!isCustomRange) {
              // Pre-fill with a reasonable default: last 30 days
              const now = new Date();
              const from = new Date(now);
              from.setDate(from.getDate() - 30);
              const fmt = (d) => d.toISOString().slice(0, 10);
              setDateFrom(fmt(from));
              setDateTo(fmt(now));
              setTimeRange('');
            }
          }}
        >
          Custom
        </button>

        {/* Date range pickers */}
        {isCustomRange && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>From</span>
              <div style={{ width: 130 }}>
                <DatePicker
                  value={dateFrom}
                  onChange={handleDateFromChange}
                  placeholder="Start date"
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>To</span>
              <div style={{ width: 130 }}>
                <DatePicker
                  value={dateTo}
                  onChange={handleDateToChange}
                  placeholder="End date"
                />
              </div>
            </div>
            <button
              onClick={clearDateRange}
              title="Clear date range"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 'var(--radius-pill)',
                background: 'oklch(0.35 0.05 30 / 0.3)', border: '1px solid oklch(0.55 0.15 30 / 0.3)',
                color: 'oklch(0.75 0.12 30)', cursor: 'pointer', flexShrink: 0,
                fontSize: 14, lineHeight: 1, padding: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </>
        )}

        <input
          className="form-input"
          placeholder="Search storms..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, fontSize: 13 }}
        />
      </div>
      {/* Type filter + sort controls */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
        {['', 'Hail', 'Wind', 'Tornado'].map(t => (
          <button key={t}
            onClick={() => setTypeFilter(t)}
            style={{
              padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: typeFilter === t ? '1px solid oklch(0.7 0.15 220 / 0.4)' : '1px solid transparent',
              background: typeFilter === t ? 'oklch(0.7 0.15 220 / 0.12)' : 'transparent',
              color: typeFilter === t ? 'oklch(0.8 0.12 220)' : 'var(--text-muted)',
            }}
          >{t || 'All Types'}</button>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Sort:</span>
        {[
          { key: 'date', label: 'Date' },
          { key: 'severity', label: 'Severity' },
          { key: 'hail', label: 'Hail Size' },
          { key: 'wind', label: 'Wind' },
        ].map(opt => (
          <button key={opt.key}
            onClick={() => setSortBy(opt.key)}
            style={{
              padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: sortBy === opt.key ? '1px solid oklch(0.72 0.15 145 / 0.4)' : '1px solid transparent',
              background: sortBy === opt.key ? 'oklch(0.72 0.15 145 / 0.12)' : 'transparent',
              color: sortBy === opt.key ? 'oklch(0.8 0.12 145)' : 'var(--text-muted)',
            }}
          >{opt.label}</button>
        ))}
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
        {filtered.length} storm{filtered.length !== 1 ? 's' : ''} found
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>Loading storms...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)', textAlign: 'center' }}>No storms found.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
          {filtered.map(s => {
            const p = s.properties || {};
            const date = p.event_start ? new Date(p.event_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014';
            const time = p.event_start ? new Date(p.event_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
            const rd = p.raw_data || {};
            // SPC reports have location/county/state, NWS alerts have areaDesc, MRMS uses reverse-geocoded location
            const loc = rd.location && rd.state
              ? `${rd.location}${rd.county ? ', ' + rd.county : ''}, ${rd.state}`
              : rd.areaDesc || locations[s.id] || '';
            return (
              <div key={s.id} className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', cursor: 'pointer', transition: 'transform 0.15s ease' }}
                onClick={() => window.location.href = `/storm-map?stormId=${s.id}`}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {(() => {
                  const rating = severityRating(s);
                  const sColor = severityColor(rating);
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: typeColor(s) }}>{typeLabel(s)}</span>
                          {/* Severity stars */}
                          <span title={`${severityLabel(rating)} (${rating}/5)`} style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            {[1, 2, 3, 4, 5].map(i => (
                              <svg key={i} width={12} height={12} viewBox="0 0 20 20" fill={i <= rating ? sColor : 'none'} stroke={sColor} strokeWidth={1.5}>
                                <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.35 5.06 16.7 6 11.21l-4-3.9 5.53-.8z" />
                              </svg>
                            ))}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{date} {time}</span>
                      </div>
                      {/* Severity label */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: loc ? 0 : 8 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 4,
                          background: `color-mix(in oklch, ${sColor} 15%, transparent)`,
                          color: sColor, textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{severityLabel(rating)}</span>
                        {p.hail_size_max_in && parseFloat(p.hail_size_max_in) >= 1.5 && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                            background: 'oklch(0.45 0.18 310 / 0.2)', color: 'oklch(0.70 0.22 310)',
                          }}>DAMAGE LIKELY</span>
                        )}
                      </div>
                    </>
                  );
                })()}
                {loc && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc}</div>}
                <div style={{ display: 'flex', gap: 'var(--space-lg)', fontSize: 12 }}>
                  {p.hail_size_max_in && (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 2 }}>Hail Size</div>
                      <div style={{ fontWeight: 700, color: 'oklch(0.78 0.17 85)' }}>{p.hail_size_max_in}"</div>
                    </div>
                  )}
                  {p.wind_speed_max_mph && (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 2 }}>Wind Speed</div>
                      <div style={{ fontWeight: 700, color: 'oklch(0.72 0.19 250)' }}>{p.wind_speed_max_mph} mph</div>
                    </div>
                  )}
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 2 }}>Source</div>
                    <div style={{ fontWeight: 600 }}>{p.source?.replace(/_/g, ' ') || '\u2014'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
