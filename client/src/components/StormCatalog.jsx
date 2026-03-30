import { useState, useEffect, useRef } from 'react';
import { getStorms } from '../api/storms';
import client from '../api/client';

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
  const [search, setSearch] = useState('');
  const [locations, setLocations] = useState({});
  const geocodeCacheRef = useRef({});

  useEffect(() => {
    setLoading(true);
    getStorms({ timeRange, limit: 200 })
      .then(({ data }) => {
        const features = data?.features || [];
        setStorms(features.sort((a, b) =>
          new Date(b.properties?.event_start || 0) - new Date(a.properties?.event_start || 0)
        ));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [timeRange]);

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

  const filtered = storms.filter(s => {
    if (!search) return true;
    const p = s.properties || {};
    const rd = p.raw_data || {};
    const text = `${rd.type || ''} ${p.source || ''} ${p.hail_size_max_in || ''} ${p.wind_speed_max_mph || ''} ${rd.location || ''} ${rd.county || ''} ${rd.state || ''} ${rd.areaDesc || ''}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const typeLabel = (s) => {
    const rd = s.properties?.raw_data;
    if (rd?.type === 'hail' || s.properties?.hail_size_max_in) return 'Hail';
    if (rd?.type === 'wind' || s.properties?.wind_speed_max_mph) return 'Wind';
    if (rd?.type === 'tornado') return 'Tornado';
    if (rd?.type === 'severe_thunderstorm') return 'Severe Thunderstorm';
    // Clean up any remaining underscored types
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

  return (
    <div className="main-content" style={{ padding: 'var(--space-xl)' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Storm Archive</h1>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
        {TIME_RANGES.map(tr => (
          <button key={tr.id}
            className={`btn ${timeRange === tr.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTimeRange(tr.id)}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            {tr.label}
          </button>
        ))}
        <input
          className="form-input"
          placeholder="Search storms..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, fontSize: 13 }}
        />
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: typeColor(s) }}>{typeLabel(s)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{date} {time}</span>
                </div>
                {loc && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{loc}</div>}
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
