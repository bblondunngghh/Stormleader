import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconMapPin, IconCheckSquare } from './Icons';
import * as dashboardApi from '../api/dashboard';
import * as stormsApi from '../api/storms';
import { updateTask } from '../api/crm';

import iconDollar from '../assets/icons/Tag-Dollar--Streamline-Ultimate.svg';
import iconLeads from '../assets/icons/Add-Circle-Bold--Streamline-Ultimate.svg';
import iconTarget from '../assets/icons/Check-Badge--Streamline-Ultimate.svg';
import iconClock from '../assets/icons/Cash-Payment-Bills-1--Streamline-Ultimate.svg';
import iconHomePin from '../assets/icons/Style-Three-Pin-Home--Streamline-Ultimate.svg';

const statIcons = {
  dollar: <img src={iconDollar} alt="" width="28" height="28" />,
  leads: <img src={iconLeads} alt="" width="28" height="28" />,
  target: <img src={iconTarget} alt="" width="28" height="28" />,
  clock: <img src={iconClock} alt="" width="28" height="28" />,
};

const emptyStats = [
  { label: 'Pipeline Value', value: '$0', change: '—', icon: 'dollar', color: 'oklch(0.75 0.18 155)', link: '/pipeline' },
  { label: 'New Leads', value: '0', change: '—', icon: 'leads', color: 'oklch(0.72 0.19 250)', link: '/leads' },
  { label: 'Close Rate', value: '0%', change: '—', icon: 'target', color: 'oklch(0.78 0.17 85)', link: '/leads?stage=closed_won' },
  { label: 'Avg Days to Close', value: '0', change: '—', icon: 'clock', color: 'oklch(0.70 0.18 330)', link: '/leads?stage=closed_won' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatToday() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

const priorityColors = {
  urgent: 'var(--accent-red)',
  high: 'var(--accent-amber)',
  medium: 'var(--accent-blue)',
  low: 'var(--text-muted)',
};

function useCountUp(target, duration = 800, delay = 0) {
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

function AnimatedFunnelRow({ row, max, delay, onClick }) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef(null);
  const animatedValue = useCountUp(animated ? row.value : 0, 800, 0);
  const animatedCount = useCountUp(animated ? row.count : 0, 800, 0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const pct = animated ? (row.value / max) * 100 : 0;

  return (
    <div ref={ref} className="funnel__row" style={{ cursor: 'pointer' }} onClick={onClick}>
      <span className="funnel__label">{row.stage}</span>
      <div className="funnel__bar-track">
        <div className="funnel__bar-fill"
          style={{
            width: `${pct}%`,
            background: row.color,
            transition: `width 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
          }}>
          {Math.round(animatedCount)}
        </div>
      </div>
      <span className="funnel__value">${(animatedValue / 1000).toFixed(1)}K</span>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(emptyStats);
  const [funnel, setFunnel] = useState([]);
  const [activity, setActivity] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tasksToday, setTasksToday] = useState([]);
  const [storms, setStorms] = useState([]);
  const [stormRange, setStormRange] = useState('30d');
  const [loading, setLoading] = useState(true);

  const fetchStorms = useCallback(async (range) => {
    try {
      // Texas-wide bounding box
      const res = await stormsApi.getSwaths({ west: -106.65, south: 25.84, east: -93.51, north: 36.5, timeRange: range });
      setStorms(res.data?.features || []);
    } catch { setStorms([]); }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, funnelRes, activityRes, leaderRes, tasksRes] = await Promise.allSettled([
        dashboardApi.getStats(),
        dashboardApi.getFunnel(),
        dashboardApi.getActivity(),
        dashboardApi.getLeaderboard(),
        dashboardApi.getTasksToday(),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.data?.stats) {
        const apiStats = statsRes.value.data.stats;
        setStats(apiStats.map((s, i) => ({ ...s, link: emptyStats[i]?.link || '/leads' })));
      }
      if (funnelRes.status === 'fulfilled' && funnelRes.value.data?.funnel) setFunnel(funnelRes.value.data.funnel);
      if (activityRes.status === 'fulfilled' && activityRes.value.data?.activity) setActivity(activityRes.value.data.activity);
      if (leaderRes.status === 'fulfilled' && leaderRes.value.data?.leaderboard) setLeaderboard(leaderRes.value.data.leaderboard);
      if (tasksRes.status === 'fulfilled' && tasksRes.value.data?.tasks) setTasksToday(tasksRes.value.data.tasks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); fetchStorms(stormRange); }, [fetchAll, fetchStorms, stormRange]);

  const handleStormRange = (range) => {
    setStormRange(range);
    fetchStorms(range);
  };

  const maxFunnelValue = Math.max(...funnel.map(d => d.value), 1);

  const handleToggleTask = async (task) => {
    try {
      await updateTask(task.id, { status: 'completed' });
      setTasksToday(prev => prev.filter(t => t.id !== task.id));
    } catch { /* silent */ }
  };

  const overdueTasks = tasksToday.filter(t => t.due_date && new Date(t.due_date) < new Date());

  return (
    <div className="main-content">
      {/* Greeting */}
      <div style={{ padding: '0 var(--space-xs)' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          {getGreeting()}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{formatToday()}</div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card glass" style={{ cursor: 'pointer' }}
            onClick={() => navigate(stat.link)}>
            <div className="stat-card__header">
              <div className="stat-card__icon">
                {statIcons[stat.icon]}
              </div>
              <span className="stat-card__change">{stat.change}</span>
            </div>
            <div className="stat-card__value">{stat.value}</div>
            <div className="stat-card__label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Row 2: Pipeline Funnel + Activity */}
      <div className="dashboard-grid">
        {/* Pipeline Funnel */}
        <div className="dashboard-panel glass">
          <div className="dashboard-panel__title">Pipeline Funnel</div>
          {funnel.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 'var(--space-xl) 0' }}>No pipeline data yet</div>
          ) : (
            <div className="funnel">
              {funnel.map((row, i) => (
                <AnimatedFunnelRow key={row.stage} row={row} max={maxFunnelValue} delay={i * 120} onClick={() => navigate('/pipeline')} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="dashboard-panel glass">
          <div className="dashboard-panel__title">Recent Activity</div>
          <div className="activity-feed" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {activity.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 'var(--space-xl) 0' }}>No activity yet</div>
            ) : activity.map((item) => (
              <div key={item.id} className="activity-item">
                <span className={`activity-dot activity-dot--${item.type}`} />
                <span className="activity-text">{item.text}</span>
                <span className="activity-time">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Tasks Due Today + Quick Stats */}
      <div className="dashboard-grid">
        {/* Tasks Due Today */}
        <div className="dashboard-panel glass">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="dashboard-panel__title" style={{ margin: 0 }}>
              Tasks Due Today
              {overdueTasks.length > 0 && (
                <span style={{
                  marginLeft: 8, fontSize: 11, fontWeight: 700,
                  color: 'var(--accent-red)', background: 'oklch(0.68 0.22 25 / 0.12)',
                  padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                }}>
                  {overdueTasks.length} overdue
                </span>
              )}
            </div>
            <button className="quick-action-btn" onClick={() => navigate('/tasks')}
              style={{ fontSize: 11, padding: '4px 10px' }}>View All</button>
          </div>
          <div style={{ marginTop: 'var(--space-md)', maxHeight: 300, overflowY: 'auto' }}>
            {tasksToday.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 'var(--space-xl) 0' }}>No tasks due — enjoy your day!</div>
            ) : tasksToday.map(task => {
              const isOverdue = task.due_date && new Date(task.due_date) < new Date();
              return (
                <div key={task.id} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                  padding: 'var(--space-sm) 0', fontSize: 13,
                  borderBottom: '1px solid oklch(0.25 0.02 260 / 0.15)',
                }}>
                  <button onClick={() => handleToggleTask(task)} style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: `2px solid ${isOverdue ? 'var(--accent-red)' : 'var(--glass-border)'}`,
                    background: 'transparent', cursor: 'pointer', flexShrink: 0,
                    boxShadow: isOverdue ? '0 0 6px oklch(0.68 0.22 25 / 0.3)' : 'none',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: isOverdue ? 'var(--accent-red)' : 'var(--text-secondary)',
                      fontWeight: isOverdue ? 600 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {task.title}
                    </div>
                    {task.lead_name && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{task.lead_name}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    color: priorityColors[task.priority] || 'var(--text-muted)',
                  }}>
                    {task.priority}
                  </span>
                  {task.due_date && (
                    <span style={{ fontSize: 11, color: isOverdue ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                      {new Date(task.due_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Storms */}
        <div className="dashboard-panel glass" style={{ padding: 'var(--space-xl)', justifyContent: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <div className="dashboard-panel__title" style={{ margin: 0 }}>Recent Storm Activity</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['24h', '7d', '30d'].map((r) => (
                <button key={r} onClick={() => handleStormRange(r)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    background: stormRange === r ? 'oklch(0.50 0.15 250 / 0.2)' : 'transparent',
                    color: stormRange === r ? 'var(--accent-blue)' : 'var(--text-muted)',
                    border: stormRange === r ? '1px solid oklch(0.50 0.15 250 / 0.3)' : '1px solid transparent',
                  }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          {storms.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 'var(--space-xl) 0', textAlign: 'center' }}>
              No recent storm events
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {storms.slice(0, 5).map((s) => {
                const p = s.properties || {};
                return (
                  <div key={s.id} className="storm-row" style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/storm-map')}>
                    <img src={iconHomePin} alt="" width="28" height="28" style={{ flexShrink: 0, display: 'block' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.raw_data?.location || p.raw_data?.headline || p.raw_data?.areaDesc || p.source_id || 'Storm Event'}
                        {p.raw_data?.county ? `, ${p.raw_data.county}` : ''}
                        {p.raw_data?.state ? ` ${p.raw_data.state}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {p.raw_data?.type || p.raw_data?.severity || p.source || 'NOAA'}
                        {p.hail_size_max_in ? ` — Max ${p.hail_size_max_in}" hail` : ''}
                        {p.raw_data?.speed && p.raw_data.speed !== 'UNK' ? ` — ${p.raw_data.speed} mph` : ''}
                        {p.event_start ? ` — ${new Date(p.event_start).toLocaleDateString()}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
              <button
                style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600, textAlign: 'right', marginTop: 'var(--space-xs)', alignSelf: 'flex-end' }}
                onClick={() => navigate('/storm-map')}>
                View Storm Map →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Team Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="dashboard-panel glass" style={{ padding: 'var(--space-xl)' }}>
          <div className="dashboard-panel__title">Team Leaderboard</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="lead-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Rep</th>
                  <th style={{ textAlign: 'center' }}>Leads</th>
                  <th style={{ textAlign: 'center' }}>Contacted</th>
                  <th style={{ textAlign: 'center' }}>Appts</th>
                  <th style={{ textAlign: 'center' }}>Inspections</th>
                  <th style={{ textAlign: 'center' }}>Estimates</th>
                  <th style={{ textAlign: 'center' }}>Sold</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                  <th style={{ textAlign: 'center' }}>Close %</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map(rep => (
                  <tr key={rep.id}>
                    <td style={{ fontWeight: 600 }}>{rep.first_name} {rep.last_name}</td>
                    <td style={{ textAlign: 'center' }}>{rep.leads_assigned}</td>
                    <td style={{ textAlign: 'center' }}>{rep.contacted}</td>
                    <td style={{ textAlign: 'center' }}>{rep.appointments}</td>
                    <td style={{ textAlign: 'center' }}>{rep.inspections}</td>
                    <td style={{ textAlign: 'center' }}>{rep.estimates_sent}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent-green)' }}>{rep.sold}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-green)' }}>
                      ${Number(rep.revenue).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>{rep.close_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
