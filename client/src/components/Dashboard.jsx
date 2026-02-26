import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconMapPin, IconCheckSquare } from './Icons';
import * as dashboardApi from '../api/dashboard';
import { updateTask } from '../api/crm';

import iconDollar from '../assets/icons/Tag-Dollar--Streamline-Ultimate.svg';
import iconLeads from '../assets/icons/Add-Circle-Bold--Streamline-Ultimate.svg';
import iconTarget from '../assets/icons/Check-Badge--Streamline-Ultimate.svg';
import iconClock from '../assets/icons/Cash-Payment-Bills-1--Streamline-Ultimate.svg';

const statIcons = {
  dollar: <img src={iconDollar} alt="" width="28" height="28" />,
  leads: <img src={iconLeads} alt="" width="28" height="28" />,
  target: <img src={iconTarget} alt="" width="28" height="28" />,
  clock: <img src={iconClock} alt="" width="28" height="28" />,
};

const emptyStats = [
  { label: 'Pipeline Value', value: '$0', change: '—', icon: 'dollar', color: 'oklch(0.75 0.18 155)' },
  { label: 'New Leads', value: '0', change: '—', icon: 'leads', color: 'oklch(0.72 0.19 250)' },
  { label: 'Close Rate', value: '0%', change: '—', icon: 'target', color: 'oklch(0.78 0.17 85)' },
  { label: 'Avg Days to Close', value: '0', change: '—', icon: 'clock', color: 'oklch(0.70 0.18 330)' },
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

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(emptyStats);
  const [funnel, setFunnel] = useState([]);
  const [activity, setActivity] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tasksToday, setTasksToday] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, funnelRes, activityRes, leaderRes, tasksRes] = await Promise.allSettled([
        dashboardApi.getStats(),
        dashboardApi.getFunnel(),
        dashboardApi.getActivity(),
        dashboardApi.getLeaderboard(),
        dashboardApi.getTasksToday(),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.data?.stats) setStats(statsRes.value.data.stats);
      if (funnelRes.status === 'fulfilled' && funnelRes.value.data?.funnel) setFunnel(funnelRes.value.data.funnel);
      if (activityRes.status === 'fulfilled' && activityRes.value.data?.activity) setActivity(activityRes.value.data.activity);
      if (leaderRes.status === 'fulfilled' && leaderRes.value.data?.leaderboard) setLeaderboard(leaderRes.value.data.leaderboard);
      if (tasksRes.status === 'fulfilled' && tasksRes.value.data?.tasks) setTasksToday(tasksRes.value.data.tasks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
          <div key={stat.label} className="stat-card glass">
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
              {funnel.map((row) => (
                <div key={row.stage} className="funnel__row" style={{ cursor: 'pointer' }}
                  onClick={() => navigate('/pipeline')}>
                  <span className="funnel__label">{row.stage}</span>
                  <div className="funnel__bar-track">
                    <div className="funnel__bar-fill"
                      style={{ width: `${(row.value / maxFunnelValue) * 100}%`, background: row.color }}>
                      {row.count}
                    </div>
                  </div>
                  <span className="funnel__value">${(row.value / 1000).toFixed(1)}K</span>
                </div>
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

        {/* Storm Map Placeholder */}
        <div className="dashboard-panel glass" style={{ padding: 'var(--space-xl)' }}>
          <div className="dashboard-panel__title">Active Storm Zone</div>
          <div className="storm-map-placeholder">
            <div className="storm-map-label">
              <IconMapPin style={{ width: 32, height: 32 }} />
              Storm map — connect weather API for live data
            </div>
          </div>
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
