import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import useIsMobile from '../hooks/useIsMobile';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as dashboardApi from '../api/dashboard';
import * as stormsApi from '../api/storms';
import { updateTask } from '../api/crm';

import {
  CurrencyDollarIcon,
  PlusCircleIcon,
  CheckBadgeIcon,
  BanknotesIcon,
  CloudIcon,
  HomeModernIcon,
  SignalIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';

/* ── Helpers ──────────────────────────────────────────────── */
function formatCurrency(value) {
  if (!value && value !== 0) return '$0';
  const num = Number(value);
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toLocaleString()}`;
}

function timeUntil(dateStr) {
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target - now;
  if (diffMs < 0) return 'Overdue';
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (diffHrs > 24) return `${Math.floor(diffHrs / 24)}d ${diffHrs % 24}h`;
  if (diffHrs > 0) return `${diffHrs}h ${diffMins}m`;
  return `${diffMins}m`;
}

const stageLabels = {
  new_lead: 'New', contacted: 'Contacted', appt_set: 'Appt Set',
  inspection: 'Inspection', estimate_sent: 'Estimate', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost', in_production: 'Production',
};

const priorityColors = {
  urgent: 'var(--accent-red)', high: 'var(--accent-amber)',
  medium: 'var(--accent-blue)', low: 'var(--text-muted)',
};

const emptyStats = [
  { label: 'Pipeline Value', value: '$0', change: '—', icon: 'dollar', color: 'oklch(0.75 0.18 155)', tint: '155', link: '/pipeline' },
  { label: 'New Leads', value: '0', change: '—', icon: 'leads', color: 'oklch(0.72 0.19 250)', tint: '250', link: '/leads' },
  { label: 'Close Rate', value: '0%', change: '—', icon: 'target', color: 'oklch(0.78 0.17 85)', tint: '85', link: '/leads?stage=closed_won' },
  { label: 'Avg Days to Close', value: '0', change: '—', icon: 'clock', color: 'oklch(0.70 0.18 330)', tint: '330', link: '/leads?stage=closed_won' },
];

const statIconMap = { dollar: CurrencyDollarIcon, leads: PlusCircleIcon, target: CheckBadgeIcon, clock: BanknotesIcon };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function useCountUp(target, duration = 900, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(eased * target);
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);
  return value;
}

/* ── Glass Card — pure CSS backdrop-filter ───────────────── */
function GlassCard({ children, className = '', onClick, style }) {
  return (
    <div
      onClick={onClick}
      style={{ borderRadius: '20px / 18px', ...style }}
      className={`
        glass
        shadow-[0_8px_32px_oklch(0_0_0/0.25),inset_0_1px_0_oklch(1_0_0/0.05)]
        ${className}
      `}
    >
      {children}
    </div>
  );
}


/* ── Pipeline Bars ────────────────────────────────────────── */
function PipelineBars({ funnel, onClick }) {
  const [animated, setAnimated] = useState(false);
  const maxCount = Math.max(...funnel.map(r => r.count), 1);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col gap-[6px] flex-1 justify-evenly cursor-pointer" onClick={onClick}>
      {funnel.map((row, i) => {
        const pct = (row.count / maxCount) * 100;
        return (
          <div key={row.stage} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', width: 90, flexShrink: 0 }}>{row.stage}</span>
            <div style={{
              flex: 1, height: 18, borderRadius: 6, overflow: 'hidden',
              background: 'oklch(0.12 0.015 265 / 0.5)',
            }}>
              <div style={{
                width: animated ? `${pct}%` : '0%',
                height: '100%', borderRadius: 6, minWidth: row.count > 0 ? 3 : 0,
                background: row.color,
                transition: `width 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms`,
              }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: row.color, width: 24, flexShrink: 0, textAlign: 'right' }}>{row.count}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Storm Row ────────────────────────────────────────────── */
function StormRow({ storm, navigate }) {
  const p = storm.properties || {};
  const rawType = (p.raw_data?.type || '').toLowerCase();
  const isHail = rawType === 'hail' || !!p.hail_size_max_in;
  const isTornado = rawType === 'tornado';
  const typeLabel = isTornado ? 'Tornado' : isHail ? 'Hail' : 'Wind';
  const typeColor = isTornado ? 'oklch(0.60 0.25 25)' : isHail ? 'oklch(0.75 0.15 85)' : 'oklch(0.55 0.20 300)';

  let rawLoc = p.raw_data?.location || '';
  const cleanLoc = rawLoc.replace(/^\d+\s+[NSEW]{1,3}\s+/i, '').trim();
  const county = p.raw_data?.county;
  const state = p.raw_data?.state;
  const areaDesc = p.raw_data?.areaDesc;
  let location;
  if (cleanLoc) location = cleanLoc + (state ? `, ${state}` : '');
  else if (areaDesc) location = areaDesc;
  else if (county) location = county + ' Co' + (state ? `, ${state}` : '');
  else location = 'Unknown';

  const hailSize = isHail && p.hail_size_max_in ? `${p.hail_size_max_in}"` : null;
  const windSpeed = p.wind_speed_max_mph ? `${p.wind_speed_max_mph} mph`
    : p.raw_data?.speed && p.raw_data.speed !== 'UNK' ? `${p.raw_data.speed} mph` : null;
  const date = p.event_start ? new Date(p.event_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const time = p.event_start ? new Date(p.event_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
  const source = p.source === 'spc_report' ? 'SPC' : p.source === 'nws_alert' ? 'NWS' : p.source === 'mrms_mesh' ? 'MRMS' : '';

  const geom = storm.geometry;
  let lat, lng;
  if (geom?.coordinates) {
    if (geom.type === 'Point') { [lng, lat] = geom.coordinates; }
    else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
      const flat = geom.type === 'MultiPolygon' ? geom.coordinates.flat(2) : geom.coordinates[0];
      if (flat?.length) {
        lng = flat.reduce((s, c) => s + c[0], 0) / flat.length;
        lat = flat.reduce((s, c) => s + c[1], 0) / flat.length;
      }
    }
  }

  return (
    <div
      className="flex items-center gap-2.5 px-2 py-2 rounded-[10px] cursor-pointer"
      onClick={() => navigate(`/storm-map${lat && lng ? `?lat=${lat}&lng=${lng}&zoom=11&stormId=${storm.id}` : ''}`)}
    >
      <span
        className="text-[9px] font-bold uppercase py-1 px-2 rounded-md text-center min-w-[50px] shrink-0 border"
        style={{
          color: typeColor,
          background: `color-mix(in oklch, ${typeColor} 10%, transparent)`,
          borderColor: `color-mix(in oklch, ${typeColor} 18%, transparent)`,
          boxShadow: `0 0 8px color-mix(in oklch, ${typeColor} 12%, transparent)`,
        }}
      >
        {typeLabel}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-px">
        <span className="text-xs font-[620] text-[var(--text-primary)] truncate">{location}</span>
        <span className="text-[10px] text-[var(--text-muted)] truncate">
          {[hailSize, windSpeed, source, p.raw_data?.severity].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="text-[11px] text-[var(--text-secondary)]">{date}</span>
        <span className="text-[10px] text-[var(--text-muted)]">{time}</span>
      </div>
    </div>
  );
}

/* ── Panel — glass card with title bar ────────────────────── */
function Panel({ children, title, action, actionLabel, className = '' }) {
  return (
    <GlassCard className={`p-5 flex flex-col h-full ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-[720] tracking-[-0.01em] text-[oklch(0.88_0.01_260)] flex items-center gap-2">
          {title}
        </h2>
        {action && (
          <button onClick={action} className="text-[11px] font-semibold text-[oklch(0.65_0.12_250)] hover:text-[oklch(0.82_0.16_250)] transition-colors">
            {actionLabel || 'View All'}
          </button>
        )}
      </div>
      {children}
    </GlassCard>
  );
}

/* ── Mini Storm Map ────────────────────────────────────────── */
function MiniStormMap({ storms, navigate }) {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-99.5, 31.5],
      zoom: 5,
      interactive: false,
    });

    // Fit to Texas bounds once loaded
    map.current.on('load', () => {
      map.current.fitBounds(
        [[-106.65, 25.84], [-93.51, 36.5]], // SW, NE corners of Texas
        { padding: 10, animate: false }
      );
    });

    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current || !storms.length) return;
    const m = map.current;
    const onLoad = () => {
      const features = storms.slice(0, 100).map(s => {
        const g = s.geometry;
        let coords;
        if (g?.type === 'Point') coords = g.coordinates;
        else if (g?.type === 'Polygon' || g?.type === 'MultiPolygon') {
          const flat = g.type === 'MultiPolygon' ? g.coordinates.flat(2) : g.coordinates[0];
          if (flat?.length) coords = [flat.reduce((a, c) => a + c[0], 0) / flat.length, flat.reduce((a, c) => a + c[1], 0) / flat.length];
        }
        if (!coords) return null;
        const p = s.properties || {};
        const rawType = (p.raw_data?.type || '').toLowerCase();
        const isHail = rawType === 'hail' || !!p.hail_size_max_in;
        const isTornado = rawType === 'tornado';
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coords },
          properties: { type: isTornado ? 'tornado' : isHail ? 'hail' : 'wind', id: s.id },
        };
      }).filter(Boolean);

      const data = { type: 'FeatureCollection', features };

      if (m.getSource('storm-pts')) {
        m.getSource('storm-pts').setData(data);
        return;
      }
      m.addSource('storm-pts', { type: 'geojson', data });
      // oklch-inspired colors: tornado=red(0.68 0.22 25), hail=amber(0.78 0.17 85), wind=purple(0.70 0.18 330)
      const tornadoColor = 'oklch(0.60 0.25 25)';
      const hailColor = 'oklch(0.75 0.15 85)';
      const windColor = 'oklch(0.55 0.20 300)';

      m.addLayer({
        id: 'storm-glow', type: 'circle', source: 'storm-pts',
        paint: {
          'circle-radius': 8, 'circle-blur': 0.8, 'circle-opacity': 0.5,
          'circle-color': ['match', ['get', 'type'], 'tornado', tornadoColor, 'hail', hailColor, windColor],
        },
      });
      m.addLayer({
        id: 'storm-dots', type: 'circle', source: 'storm-pts',
        paint: {
          'circle-radius': 5,
          'circle-color': ['match', ['get', 'type'], 'tornado', tornadoColor, 'hail', hailColor, windColor],
          'circle-stroke-width': 1.5, 'circle-stroke-color': 'oklch(0 0 0 / 0.3)',
        },
      });
      m.on('click', 'storm-dots', (e) => {
        const f = e.features?.[0];
        if (f) navigate(`/storm-map?lat=${f.geometry.coordinates[1]}&lng=${f.geometry.coordinates[0]}&zoom=11&stormId=${f.properties.id}`);
      });
      m.on('mouseenter', 'storm-dots', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'storm-dots', () => { m.getCanvas().style.cursor = ''; });
    };
    if (m.isStyleLoaded()) onLoad();
    else m.on('load', onLoad);
  }, [storms, navigate]);

  return <div ref={mapContainer} className="mini-storm-map w-full flex-1 min-h-[180px] max-h-[300px] rounded-xl overflow-hidden" />;
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(emptyStats);
  const [funnel, setFunnel] = useState([]);
  const [activity, setActivity] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tasksToday, setTasksToday] = useState([]);
  const [storms, setStorms] = useState([]);
  const [stormRange, setStormRange] = useState('30d');
  const [followups, setFollowups] = useState([]);
  const [conversionByStorm, setConversionByStorm] = useState([]);
  const [estimateSummary, setEstimateSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStorms = useCallback(async (range) => {
    try {
      const res = await stormsApi.getStorms({ timeRange: range, limit: 50 });
      const all = res.data?.features || [];
      setStorms(all.filter(f => f.properties?.raw_data));
    } catch { setStorms([]); }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, funnelRes, activityRes, leaderRes, tasksRes, followupsRes, convRes, estRes] = await Promise.allSettled([
        dashboardApi.getStats(), dashboardApi.getFunnel(), dashboardApi.getActivity(),
        dashboardApi.getLeaderboard(), dashboardApi.getTasksToday(), dashboardApi.getFollowups(),
        dashboardApi.getConversionByStorm(), dashboardApi.getEstimateSummary(),
      ]);
      if (statsRes.status === 'fulfilled' && statsRes.value.data?.stats)
        setStats(statsRes.value.data.stats.map((s, i) => ({ ...s, tint: emptyStats[i]?.tint, link: emptyStats[i]?.link || '/leads' })));
      if (funnelRes.status === 'fulfilled' && funnelRes.value.data?.funnel) setFunnel(funnelRes.value.data.funnel);
      if (activityRes.status === 'fulfilled' && activityRes.value.data?.activity) setActivity(activityRes.value.data.activity);
      if (leaderRes.status === 'fulfilled' && leaderRes.value.data?.leaderboard) setLeaderboard(leaderRes.value.data.leaderboard);
      if (tasksRes.status === 'fulfilled' && tasksRes.value.data?.tasks) setTasksToday(tasksRes.value.data.tasks);
      if (followupsRes.status === 'fulfilled' && followupsRes.value.data?.followups) setFollowups(followupsRes.value.data.followups);
      if (convRes.status === 'fulfilled' && convRes.value.data?.storms) setConversionByStorm(convRes.value.data.storms);
      if (estRes.status === 'fulfilled' && estRes.value.data) setEstimateSummary(estRes.value.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); fetchStorms(stormRange); }, [fetchAll, fetchStorms, stormRange]);

  const maxFunnelValue = Math.max(...funnel.map(d => d.value), 1);

  const handleToggleTask = async (task) => {
    try {
      await updateTask(task.id, { status: 'completed' });
      setTasksToday(prev => prev.filter(t => t.id !== task.id));
    } catch {}
  };

  const overdueTasks = tasksToday.filter(t => t.due_date && new Date(t.due_date) < new Date());
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const isMobile = useIsMobile();

  const stormTypeBadge = {
    hail: { color: 'oklch(0.75 0.15 85)', bg: 'oklch(0.75 0.15 85 / 0.1)', border: 'oklch(0.75 0.15 85 / 0.2)' },
    tornado: { color: 'oklch(0.60 0.25 25)', bg: 'oklch(0.60 0.25 25 / 0.1)', border: 'oklch(0.60 0.25 25 / 0.2)' },
    wind: { color: 'oklch(0.55 0.20 300)', bg: 'oklch(0.55 0.20 300 / 0.1)', border: 'oklch(0.55 0.20 300 / 0.2)' },
  };

  /* ── Mobile Dashboard ── */
  if (isMobile) {
    const pipelineValue = stats.find(s => s.label === 'Pipeline Value')?.value || '$0';
    const newLeads = stats.find(s => s.label === 'New Leads')?.value || '0';
    const closeRate = stats.find(s => s.label === 'Close Rate')?.value || '0%';
    const avgDays = stats.find(s => s.label === 'Avg Days to Close')?.value || '-';

    return (
      <div style={{
        background: 'var(--bg-deep)',
        minHeight: '100vh',
        paddingBottom: 96,
        color: 'var(--text-primary)',
      }}>
        <main style={{ paddingTop: 20, paddingLeft: 16, paddingRight: 16 }}>
          {/* Welcome Section */}
          <section style={{ marginBottom: 24 }}>
            <p style={{
              fontFamily: 'inherit',
              fontSize: 10,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'var(--text-muted)',
              marginBottom: 4,
            }}>
              Command Center
            </p>
            <h2 style={{
              fontFamily: 'inherit',
              fontSize: 30,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.1,
            }}>
              {getGreeting()}, <span style={{ color: 'var(--accent-cyan)' }}>{user?.firstName || 'Commander'}</span>
            </h2>
          </section>

          {/* Key Metrics Bento Grid */}
          <section style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 24,
          }}>
            {/* Pipeline Value — full width */}
            <div style={{
              gridColumn: '1 / -1',
              background: 'var(--bg-surface)',
              padding: 20,
              borderRadius: 12,
              borderLeft: '2px solid var(--accent-cyan)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}>
              <div>
                <p style={{
                  fontFamily: 'inherit',
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}>Pipeline Value</p>
                <h3 style={{
                  fontFamily: 'inherit',
                  fontSize: 30,
                  fontWeight: 700,
                  color: 'var(--accent-cyan)',
                  margin: '4px 0 0',
                }}>{pipelineValue}</h3>
              </div>
              <span className="material-symbols-outlined" style={{ color: 'oklch(0.78 0.12 200 / 0.5)', fontSize: 24 }}>
                account_balance_wallet
              </span>
            </div>

            {/* New Leads — half width */}
            <div style={{
              background: 'var(--bg-surface)',
              padding: 16,
              borderRadius: 12,
            }}>
              <p style={{
                fontFamily: 'inherit',
                fontSize: 10,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--text-muted)',
                margin: 0,
              }}>New Leads</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{
                  fontFamily: 'inherit',
                  fontSize: 24,
                  fontWeight: 700,
                }}>{newLeads}</span>
                <span style={{
                  fontFamily: 'inherit',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                }}>UNIT</span>
              </div>
            </div>

            {/* Close Rate — half width */}
            <div style={{
              background: 'var(--bg-surface)',
              padding: 16,
              borderRadius: 12,
            }}>
              <p style={{
                fontFamily: 'inherit',
                fontSize: 10,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--text-muted)',
                margin: 0,
              }}>Close Rate</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{
                  fontFamily: 'inherit',
                  fontSize: 24,
                  fontWeight: 700,
                }}>{closeRate}</span>
                <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  trending_flat
                </span>
              </div>
            </div>

            {/* Avg Days to Close — full width */}
            <div style={{
              gridColumn: '1 / -1',
              background: 'var(--bg-surface)',
              padding: 16,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <p style={{
                  fontFamily: 'inherit',
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}>Avg Days to Close</p>
                <span style={{
                  fontFamily: 'inherit',
                  fontSize: 24,
                  fontWeight: 700,
                  marginTop: 4,
                  display: 'inline-block',
                }}>{avgDays}</span>
              </div>
              <div style={{
                height: 32,
                width: 96,
                background: 'oklch(0.22 0.02 260)',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: 'inherit',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                }}>{avgDays === '-' || avgDays === '0' ? 'NO DATA' : `${avgDays} DAYS`}</span>
              </div>
            </div>
          </section>

          {/* Mini Storm Map */}
          <section style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <h3 style={{
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--text-primary)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <SignalIcon width={24} height={24} style={{ opacity: 0.9 }} />
                Storm Map
              </h3>
              <span style={{
                fontFamily: 'inherit',
                fontSize: 10,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
                color: 'var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                Live Radar
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent-cyan)',
                  display: 'inline-block',
                  animation: 'pulse 2s infinite',
                }} />
              </span>
            </div>
            <div style={{
              position: 'relative',
              height: 192,
              width: '100%',
              borderRadius: 12,
              overflow: 'hidden',
              background: 'oklch(0.10 0.02 260)',
            }}>
              <MiniStormMap storms={storms} navigate={navigate} />
              {/* Gradient overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, var(--bg-deep), transparent, transparent)',
                pointerEvents: 'none',
              }} />
              {/* Scanning overlay */}
              <div style={{
                position: 'absolute',
                top: 12,
                left: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                pointerEvents: 'none',
              }}>
                <div style={{
                  background: 'oklch(0.22 0.02 260 / 0.6)',
                  backdropFilter: 'blur(20px)',
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid oklch(1 0 0 / 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--accent-cyan)' }}>
                    radar
                  </span>
                  <span style={{
                    fontFamily: 'inherit',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}>SCANNING...</span>
                </div>
              </div>
              {/* Fullscreen button */}
              <div style={{ position: 'absolute', bottom: 12, right: 12 }}>
                <button
                  onClick={() => navigate('/storm-map')}
                  style={{
                    background: 'var(--accent-cyan)',
                    color: 'oklch(0.25 0.06 200)',
                    padding: 8,
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px oklch(0 0 0 / 0.3)',
                  }}
                >
                  <span className="material-symbols-outlined">fullscreen</span>
                </button>
              </div>
            </div>
          </section>

          {/* Recent Storm Activity */}
          <section style={{ marginBottom: 24 }}>
            <h3 style={{
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              margin: '0 0 12px',
            }}>Recent Storm Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {storms.length > 0 ? (
                <>
                  {storms.slice(0, 3).map(s => {
                    const p = s.properties || {};
                    const rawType = (p.raw_data?.type || '').toLowerCase();
                    const isHail = rawType === 'hail' || !!p.hail_size_max_in;
                    const isTornado = rawType === 'tornado';
                    const typeLabel = isTornado ? 'Tornado' : isHail ? 'Hail' : 'Wind';
                    const typeColor = isTornado ? 'oklch(0.60 0.25 25)' : isHail ? 'oklch(0.85 0.10 25)' : 'oklch(0.55 0.20 300)';

                    let rawLoc = p.raw_data?.location || '';
                    const cleanLoc = rawLoc.replace(/^\d+\s+[NSEW]{1,3}\s+/i, '').trim();
                    const county = p.raw_data?.county;
                    const state = p.raw_data?.state;
                    const areaDesc = p.raw_data?.areaDesc;
                    let location;
                    if (cleanLoc) location = cleanLoc + (state ? `, ${state}` : '');
                    else if (areaDesc) location = areaDesc;
                    else if (county) location = county + ' Co' + (state ? `, ${state}` : '');
                    else location = 'Unknown';

                    const hailSize = isHail && p.hail_size_max_in ? `${p.hail_size_max_in}" Hail Detected` : null;
                    const detail = hailSize || (p.raw_data?.severity ? p.raw_data.severity : typeLabel + ' Alert');
                    const eventDate = p.event_start ? new Date(p.event_start) : null;
                    const hoursAgo = eventDate ? Math.round((Date.now() - eventDate) / (1000 * 60 * 60)) : null;
                    const timeAgo = hoursAgo !== null ? (hoursAgo < 1 ? '<1h ago' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.round(hoursAgo / 24)}d ago`) : '';

                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          const geom = s.geometry;
                          let lat, lng;
                          if (geom?.type === 'Point') { [lng, lat] = geom.coordinates; }
                          else if (geom?.type === 'Polygon' || geom?.type === 'MultiPolygon') {
                            const flat = geom.type === 'MultiPolygon' ? geom.coordinates.flat(2) : geom.coordinates[0];
                            if (flat?.length) { lng = flat.reduce((a, c) => a + c[0], 0) / flat.length; lat = flat.reduce((a, c) => a + c[1], 0) / flat.length; }
                          }
                          navigate(`/storm-map${lat && lng ? `?lat=${lat}&lng=${lng}&zoom=11&stormId=${s.id}` : ''}`);
                        }}
                        style={{
                          background: 'oklch(0.16 0.02 260)',
                          padding: 16,
                          borderRadius: 12,
                          borderLeft: `2px solid ${typeColor}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            background: `${typeColor}1a`,
                            padding: 8,
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <HomeIcon width={24} height={24} style={{ opacity: 0.9 }} />
                          </div>
                          <div>
                            <p style={{
                              fontFamily: "'Manrope', sans-serif",
                              fontSize: 14,
                              fontWeight: 600,
                              margin: 0,
                              color: 'var(--text-primary)',
                            }}>{typeLabel} Alert: {location}</p>
                            <p style={{
                              fontFamily: 'inherit',
                              fontSize: 10,
                              textTransform: 'uppercase',
                              letterSpacing: '-0.02em',
                              color: 'var(--text-muted)',
                              margin: 0,
                            }}>{detail}{timeAgo ? ` \u2022 ${timeAgo}` : ''}</p>
                          </div>
                        </div>
                        <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                          chevron_right
                        </span>
                      </div>
                    );
                  })}
                </>
              ) : null}

              {/* Empty state / monitoring message */}
              <div style={{
                background: 'oklch(0.10 0.02 260)',
                border: '1px dashed oklch(0.35 0.02 260)',
                borderRadius: 12,
                padding: '32px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
                  cloud_off
                </span>
                <p style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                  margin: 0,
                }}>Monitoring atmospheric conditions for new activity...</p>
              </div>
            </div>
          </section>

          {/* Today's Tasks */}
          <section style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}>
              <h3 style={{
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--text-primary)',
                margin: 0,
              }}>Today</h3>
              <span style={{
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 500,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}>{tasksToday.length} Task{tasksToday.length !== 1 ? 's' : ''} Pending</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasksToday.length === 0 ? (
                <div style={{
                  background: 'var(--bg-surface)',
                  padding: 16,
                  borderRadius: 12,
                  textAlign: 'center',
                }}>
                  <p style={{
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    margin: 0,
                  }}>Nothing scheduled - you're all clear</p>
                </div>
              ) : (
                tasksToday.map(task => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                  const timeStr = task.due_date
                    ? new Date(task.due_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    : null;
                  return (
                    <div key={task.id} style={{
                      background: 'var(--bg-surface)',
                      padding: 16,
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                    }}>
                      <button
                        onClick={() => handleToggleTask(task)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          border: `2px solid ${isOverdue ? 'var(--accent-red)' : 'oklch(0.35 0.02 260)'}`,
                          background: 'transparent',
                          cursor: 'pointer',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <p style={{
                          fontFamily: "'Manrope', sans-serif",
                          fontSize: 14,
                          margin: 0,
                          color: isOverdue ? 'var(--accent-red)' : 'var(--text-primary)',
                        }}>{task.title}</p>
                        {(timeStr || task.lead_name) && (
                          <p style={{
                            fontFamily: 'inherit',
                            fontSize: 10,
                            color: isOverdue ? 'var(--accent-red)' : 'var(--accent-cyan)',
                            margin: 0,
                          }}>{timeStr || task.lead_name}</p>
                        )}
                      </div>
                      {task.priority && (
                        <div style={{
                          background: 'oklch(0.22 0.02 260)',
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}>
                          <span style={{
                            fontFamily: 'inherit',
                            fontSize: 9,
                            fontWeight: 700,
                            color: task.priority === 'urgent' ? 'var(--accent-red)' : 'var(--text-muted)',
                            textTransform: 'uppercase',
                          }}>{task.priority}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="main-content lg-dashboard">
      {/* ── Header — Desktop ── */}
      <header className="flex items-end justify-between gap-6 flex-wrap py-1">
        <div>
          <h1 className="text-[28px] font-[820] tracking-[-0.035em] leading-tight text-[var(--text-primary)]">
            {getGreeting()}{user?.firstName ? `, ${user.firstName}` : ''}
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1 font-[450]">{todayStr}</p>
        </div>
        <div className="flex gap-3">
          <GlassCard
            onClick={() => navigate('/storm-map')}
            className="group cursor-pointer px-6 py-2.5 flex items-center gap-2.5
              text-sm font-[650] text-[var(--text-primary)]
              hover:scale-[1.03] hover:shadow-[0_12px_40px_oklch(0_0_0/0.35),inset_0_1px_0_oklch(1_0_0/0.08)]
              active:scale-[0.97] transition-all duration-200 ease-out"
          >
            <CloudIcon width={18} height={18}
              className="opacity-85 transition-transform duration-300 ease-out group-hover:rotate-12" />
            Storm Map
          </GlassCard>
          <GlassCard
            onClick={() => navigate('/leads')}
            className="group cursor-pointer px-6 py-2.5 flex items-center gap-2.5
              text-sm font-[650] text-[var(--text-primary)]
              hover:scale-[1.03] hover:shadow-[0_12px_40px_oklch(0_0_0/0.35),inset_0_1px_0_oklch(1_0_0/0.08)]
              active:scale-[0.97] transition-all duration-200 ease-out"
          >
            <HomeModernIcon width={18} height={18}
              className="opacity-85 transition-transform duration-300 ease-out group-hover:rotate-12" />
            View Leads
          </GlassCard>
        </div>
      </header>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-4 gap-[var(--space-md)]">
        {stats.map((stat) => (
          <GlassCard key={stat.label} onClick={() => navigate(stat.link)} className="group cursor-pointer p-5 flex flex-col gap-2 items-center text-center relative">
            <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[oklch(0.75_0.18_155/0.12)] text-[var(--accent-green)]">
              {stat.change}
            </span>
            {(() => { const StatIcon = statIconMap[stat.icon]; return StatIcon ? <StatIcon width={28} height={28} className="opacity-85 transition-transform duration-300 ease-out group-hover:rotate-12" style={{ filter: `drop-shadow(0 0 6px oklch(0.50 0.10 ${stat.tint} / 0.3))` }} /> : null; })()}
            <div className="text-[28px] font-[820] tracking-[-0.04em] leading-none text-[var(--text-primary)]">
              {stat.value}
            </div>
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: `oklch(0.55 0.03 ${stat.tint})` }}
            >
              {stat.label}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ── Row 2: Pipeline + Storm Map + Storm Feed ── */}
      <div className="grid grid-cols-[3fr_4fr_3fr] gap-[var(--space-md)]" style={{ maxHeight: 420 }}>
        <Panel title="Pipeline" action={() => navigate('/pipeline')}>
          {funnel.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)] py-5 text-center">No pipeline data yet</div>
          ) : (
            <PipelineBars funnel={funnel} onClick={() => navigate('/pipeline')} />
          )}
        </Panel>

        {storms.length > 0 && (
          <Panel title="Storm Map" action={() => navigate('/storm-map')} actionLabel="Full Map">
            <MiniStormMap storms={storms} navigate={navigate} />
          </Panel>
        )}

        <Panel
          title={
            <span className="flex items-center gap-2">
              Storm Activity
              <span className="flex gap-1">
                {['24h', '7d', '30d'].map(r => (
                  <button
                    key={r}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                      stormRange === r
                        ? 'bg-[oklch(0.72_0.19_250/0.15)] text-[oklch(0.82_0.16_250)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                    onClick={() => setStormRange(r)}
                  >
                    {r}
                  </button>
                ))}
              </span>
            </span>
          }
        >
          <div className="flex flex-col gap-0.5 max-h-[340px] overflow-y-auto">
            {storms.length === 0 ? (
              <div className="text-xs text-[var(--text-muted)] py-5 text-center">No storm events in this range</div>
            ) : (
              <>
                {storms.slice(0, 6).map(s => <StormRow key={s.id} storm={s} navigate={navigate} />)}
                {storms.length > 6 && (
                  <button
                    className="text-[11px] font-semibold text-[oklch(0.65_0.12_250)] hover:text-[oklch(0.82_0.16_250)] text-center py-2 w-full transition-colors"
                    onClick={() => navigate('/storm-map')}
                  >
                    +{storms.length - 6} more events
                  </button>
                )}
              </>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Row 3: Today + Activity ── */}
      <div className="grid grid-cols-2 gap-[var(--space-md)]">
        <Panel
          title={
            <span className="flex items-center gap-2">
              Today
              {(overdueTasks.length > 0 || followups.length > 0) && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: overdueTasks.length > 0 ? 'oklch(0.68 0.22 25 / 0.15)' : 'oklch(0.72 0.16 45 / 0.15)',
                    color: overdueTasks.length > 0 ? 'var(--accent-red)' : 'oklch(0.72 0.16 45)',
                  }}
                >
                  {overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : `${followups.length} follow-ups`}
                </span>
              )}
            </span>
          }
          action={() => navigate('/tasks')}
          actionLabel="All Tasks"
        >
          <div className="flex flex-col gap-px max-h-[320px] overflow-y-auto">
            {tasksToday.length === 0 && followups.length === 0 ? (
              <div className="text-xs text-[var(--text-muted)] py-5 text-center">Nothing scheduled — you're all clear</div>
            ) : (
              <>
                {tasksToday.map(task => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                  return (
                    <div key={task.id} className="flex items-center gap-2.5 py-2 px-1 text-xs border-b border-[oklch(0.22_0.015_265/0.15)] rounded-md">
                      <button className="w-4 h-4 rounded-[5px] border-[1.5px] border-[oklch(0.40_0.02_265/0.35)] bg-[oklch(0.12_0.01_265/0.3)] cursor-pointer shrink-0" onClick={() => handleToggleTask(task)}
                        style={{ borderColor: isOverdue ? 'var(--accent-red)' : undefined }} />
                      <div className="flex-1 min-w-0 flex flex-col">
                        <span className={`text-[var(--text-secondary)] font-medium truncate${isOverdue ? ' text-[var(--accent-red)] font-[620]' : ''}`}>{task.title}</span>
                        {task.lead_name && <span className="text-[10px] text-[var(--text-muted)]">{task.lead_name}</span>}
                      </div>
                      <span className="text-[9px] font-bold uppercase shrink-0" style={{ color: priorityColors[task.priority] }}>{task.priority}</span>
                      {task.due_date && (
                        <span className="text-[10px] shrink-0 font-medium text-[var(--text-muted)]" style={{ color: isOverdue ? 'var(--accent-red)' : undefined }}>
                          {new Date(task.due_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  );
                })}
                {followups.length > 0 && tasksToday.length > 0 && (
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] pt-2.5 pb-1 border-t border-[oklch(0.25_0.02_265/0.12)] mt-1"><span>Follow-ups</span></div>
                )}
                {followups.map((fu, idx) => {
                  const isOverdue = fu.follow_up_at && new Date(fu.follow_up_at) < new Date();
                  return (
                    <div key={fu.id || idx} className="flex items-center gap-2.5 py-2 px-1 text-xs border-b border-[oklch(0.22_0.015_265/0.15)] rounded-md">
                      <div className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: isOverdue ? 'var(--accent-red)' : 'oklch(0.72 0.16 45)', boxShadow: `0 0 6px ${isOverdue ? 'var(--accent-red)' : 'oklch(0.72 0.16 45 / 0.5)'}` }} />
                      <div className="flex-1 min-w-0 flex flex-col">
                        <span className={`text-[var(--text-secondary)] font-medium truncate${isOverdue ? ' text-[var(--accent-red)] font-[620]' : ''}`}>{fu.contact_name || 'Unknown'}</span>
                        {fu.address && <span className="text-[10px] text-[var(--text-muted)]">{fu.address}</span>}
                      </div>
                      {fu.stage && <span className="text-[9px] font-semibold uppercase text-[oklch(0.72_0.19_250)] bg-[oklch(0.72_0.19_250/0.08)] px-1.5 py-0.5 rounded-full shrink-0">{stageLabels[fu.stage] || fu.stage}</span>}
                      <span className="text-[10px] shrink-0 font-medium text-[var(--text-muted)]" style={{ color: isOverdue ? 'var(--accent-red)' : 'oklch(0.72 0.16 45)' }}>
                        {fu.follow_up_at ? timeUntil(fu.follow_up_at) : ''}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </Panel>

        <Panel title="Activity Feed">
          <div className="flex flex-col gap-px max-h-[320px] overflow-y-auto">
            {activity.length === 0 ? (
              <div className="text-xs text-[var(--text-muted)] py-5 text-center">No recent activity</div>
            ) : activity.map(item => {
              const dotColorMap = { sold: 'var(--accent-green)', estimate: 'var(--accent-purple)', appointment: 'var(--accent-amber)', lead: 'var(--accent-blue)', inspection: 'var(--accent-cyan)', call: 'var(--text-muted)' };
              const dotColor = dotColorMap[item.type] || 'var(--text-muted)';
              return (
                <div key={item.id} className="flex items-start gap-2.5 py-[7px] px-1 rounded-md">
                  <span className="w-[7px] h-[7px] rounded-full shrink-0 mt-[5px]" style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
                  <span className="text-xs text-[var(--text-secondary)] leading-[1.4] flex-1">{item.text}</span>
                  <span className="text-[10px] text-[var(--text-muted)] shrink-0 mt-px">{item.time}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* ── Row 4: Conversion + Estimates ── */}
      <div className="grid grid-cols-[5fr_7fr] gap-[var(--space-md)]">
        <Panel title="Storm Conversion">
          {conversionByStorm.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)] py-5 text-center">No conversion data yet</div>
          ) : (
            <div className="flex flex-col gap-1">
              {conversionByStorm.slice(0, 5).map((storm, idx) => {
                const rate = storm.total_leads > 0 ? (storm.sold_count / storm.total_leads) * 100 : 0;
                const tk = (storm.storm_type || 'wind').toLowerCase();
                const badge = stormTypeBadge[tk] || stormTypeBadge.wind;
                return (
                  <div key={storm.id || idx} className="py-2 border-b border-[oklch(0.22_0.015_265/0.10)] last:border-b-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0" style={{ color: badge.color, background: badge.bg, borderColor: badge.border }}>{storm.storm_type || 'Wind'}</span>
                      <span className="text-xs font-[620] text-[var(--text-primary)] flex-1 truncate">{storm.location || 'Unknown'}</span>
                      <span className="text-xs font-[750] text-[oklch(0.75_0.18_155)] shrink-0">{formatCurrency(storm.revenue)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-muted)] min-w-[50px] shrink-0">{storm.sold_count}/{storm.total_leads}</span>
                      <div className="flex-1 h-[5px] rounded-sm bg-[oklch(0.08_0.01_265/0.4)] overflow-hidden">
                        <div className="h-full rounded-sm transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{
                          width: `${Math.min(rate, 100)}%`,
                          background: rate >= 50 ? 'oklch(0.75 0.18 155)' : rate >= 25 ? 'oklch(0.72 0.16 45)' : 'oklch(0.72 0.19 250)',
                          boxShadow: `0 0 8px ${rate >= 50 ? 'oklch(0.75 0.18 155 / 0.4)' : 'transparent'}`,
                        }} />
                      </div>
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] min-w-[30px] text-right shrink-0">{rate.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Estimates" action={() => navigate('/estimates')}>
          {!estimateSummary ? (
            <div className="text-xs text-[var(--text-muted)] py-5 text-center">No estimate data yet</div>
          ) : (
            <div className="flex flex-col flex-1">
              {/* Spacer */}
              <div className="flex-1" />

              {/* Status bars — just above bottom stats */}
              <div className="flex gap-1.5 mb-3">
                {[
                  { label: 'Draft', val: estimateSummary.draft || 0, color: 'oklch(0.55 0.05 260)' },
                  { label: 'Sent', val: estimateSummary.sent || 0, color: 'oklch(0.72 0.19 250)' },
                  { label: 'Viewed', val: estimateSummary.viewed || 0, color: 'oklch(0.72 0.16 45)' },
                  { label: 'Accepted', val: estimateSummary.accepted || 0, color: 'oklch(0.75 0.18 155)' },
                ].map(step => (
                  <div key={step.label} className="flex-1 text-center">
                    <div className="h-[5px] rounded-sm mb-2" style={{
                      background: step.color, opacity: step.val > 0 ? 1 : 0.15,
                      boxShadow: step.val > 0 ? `0 0 10px ${step.color}` : 'none',
                      transition: 'opacity 0.3s, box-shadow 0.3s',
                    }} />
                    <span className="block text-xl font-[820] tracking-tight" style={{ color: step.color }}>{step.val}</span>
                    <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{step.label}</span>
                  </div>
                ))}
              </div>

              {/* Bottom stats — centered */}
              <div className="flex flex-col items-center gap-3 pt-3 border-t border-[oklch(0.22_0.015_265/0.12)]">
                <div className="flex gap-6 text-center">
                  <div><span className="block text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Accepted Value</span><span className="text-lg font-[820] tracking-tight" style={{ color: 'oklch(0.75 0.18 155)' }}>{formatCurrency(estimateSummary.accepted_value)}</span></div>
                  <div><span className="block text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Pending Value</span><span className="text-lg font-[820] tracking-tight" style={{ color: 'oklch(0.72 0.16 45)' }}>{formatCurrency(estimateSummary.pending_value)}</span></div>
                </div>
                <div className="flex gap-4 justify-center">
                  <div className="flex items-center gap-1.5"><span className="text-[10px] text-[var(--text-muted)]">Declined</span><span className="text-[13px] font-bold" style={{ color: 'oklch(0.68 0.22 25)' }}>{estimateSummary.declined || 0}</span></div>
                  <div className="flex items-center gap-1.5"><span className="text-[10px] text-[var(--text-muted)]">Expired</span><span className="text-[13px] font-bold" style={{ color: 'oklch(0.55 0.05 260)' }}>{estimateSummary.expired || 0}</span></div>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Row 5: Leaderboard ── */}
      {leaderboard.length > 0 && (
        <Panel title="Team Leaderboard">
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full border-collapse text-xs">
              <thead><tr>
                <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-2.5 border-b border-[oklch(0.25_0.015_265/0.12)]">Rep</th>
                <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-2.5 border-b border-[oklch(0.25_0.015_265/0.12)]">Leads</th>
                <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-2.5 border-b border-[oklch(0.25_0.015_265/0.12)]">Contacted</th>
                <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-2.5 border-b border-[oklch(0.25_0.015_265/0.12)]">Appts</th>
                <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-2.5 border-b border-[oklch(0.25_0.015_265/0.12)]">Inspections</th>
                <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-2.5 border-b border-[oklch(0.25_0.015_265/0.12)]">Estimates</th>
                <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-2.5 border-b border-[oklch(0.25_0.015_265/0.12)]">Sold</th>
                <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-2.5 border-b border-[oklch(0.25_0.015_265/0.12)] !text-right">Revenue</th>
                <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2 px-2.5 border-b border-[oklch(0.25_0.015_265/0.12)]">Close %</th>
              </tr></thead>
              <tbody>
                {leaderboard.map((rep, idx) => (
                  <tr key={rep.id}>
                    <td className={`text-center py-2.5 px-2.5 text-[var(--text-secondary)] !text-left font-[620] !text-[var(--text-primary)]${idx < leaderboard.length - 1 ? ' border-b border-[oklch(0.18_0.015_265/0.08)]' : ''}`}>{rep.first_name} {rep.last_name}</td>
                    <td className={`text-center py-2.5 px-2.5 text-[var(--text-secondary)]${idx < leaderboard.length - 1 ? ' border-b border-[oklch(0.18_0.015_265/0.08)]' : ''}`}>{rep.leads_assigned}</td>
                    <td className={`text-center py-2.5 px-2.5 text-[var(--text-secondary)]${idx < leaderboard.length - 1 ? ' border-b border-[oklch(0.18_0.015_265/0.08)]' : ''}`}>{rep.contacted}</td>
                    <td className={`text-center py-2.5 px-2.5 text-[var(--text-secondary)]${idx < leaderboard.length - 1 ? ' border-b border-[oklch(0.18_0.015_265/0.08)]' : ''}`}>{rep.appointments}</td>
                    <td className={`text-center py-2.5 px-2.5 text-[var(--text-secondary)]${idx < leaderboard.length - 1 ? ' border-b border-[oklch(0.18_0.015_265/0.08)]' : ''}`}>{rep.inspections}</td>
                    <td className={`text-center py-2.5 px-2.5 text-[var(--text-secondary)]${idx < leaderboard.length - 1 ? ' border-b border-[oklch(0.18_0.015_265/0.08)]' : ''}`}>{rep.estimates_sent}</td>
                    <td className={`text-center py-2.5 px-2.5 text-[var(--text-secondary)] font-bold !text-[var(--accent-green)]${idx < leaderboard.length - 1 ? ' border-b border-[oklch(0.18_0.015_265/0.08)]' : ''}`}>{rep.sold}</td>
                    <td className={`text-center py-2.5 px-2.5 text-[var(--text-secondary)] !text-right font-bold !text-[var(--accent-green)]${idx < leaderboard.length - 1 ? ' border-b border-[oklch(0.18_0.015_265/0.08)]' : ''}`}>${Number(rep.revenue).toLocaleString()}</td>
                    <td className={`text-center py-2.5 px-2.5 text-[var(--text-secondary)]${idx < leaderboard.length - 1 ? ' border-b border-[oklch(0.18_0.015_265/0.08)]' : ''}`}>{rep.close_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
