import { IconMapPin } from './Icons';
import { useDashboard } from '../hooks/useDashboard';

const statIcons = {
  dollar: '💰',
  leads: '📋',
  target: '🎯',
  clock: '⏱️',
};

export default function Dashboard() {
  const { stats, funnel, activity, loading } = useDashboard();
  const maxFunnelValue = Math.max(...funnel.map(d => d.value));

  return (
    <div className="main-content">
      {/* Stat Cards */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card glass">
            <div className="stat-card__header">
              <div
                className="stat-card__icon"
                style={{ background: stat.color.replace(')', ' / 0.15)').replace('oklch(', 'oklch(') }}
              >
                {statIcons[stat.icon]}
              </div>
              <span className="stat-card__change">{stat.change}</span>
            </div>
            <div className="stat-card__value">{stat.value}</div>
            <div className="stat-card__label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Two-column dashboard */}
      <div className="dashboard-grid">
        {/* Pipeline Funnel */}
        <div className="dashboard-panel glass">
          <div className="dashboard-panel__title">Pipeline Funnel</div>
          <div className="funnel">
            {funnel.map((row) => (
              <div key={row.stage} className="funnel__row">
                <span className="funnel__label">{row.stage}</span>
                <div className="funnel__bar-track">
                  <div
                    className="funnel__bar-fill"
                    style={{
                      width: `${(row.value / maxFunnelValue) * 100}%`,
                      background: row.color,
                    }}
                  >
                    {row.count}
                  </div>
                </div>
                <span className="funnel__value">${(row.value / 1000).toFixed(1)}K</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dashboard-panel glass">
          <div className="dashboard-panel__title">Recent Activity</div>
          <div className="activity-feed">
            {activity.map((item) => (
              <div key={item.id} className="activity-item">
                <span className={`activity-dot activity-dot--${item.type}`} />
                <span className="activity-text">{item.text}</span>
                <span className="activity-time">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Storm Map Placeholder */}
      <div className="dashboard-panel glass" style={{ padding: 'var(--space-xl)' }}>
        <div className="dashboard-panel__title">Active Storm Zone — Austin Metro</div>
        <div className="storm-map-placeholder">
          <div className="storm-map-label">
            <IconMapPin style={{ width: 32, height: 32 }} />
            Storm map — connect weather API for live data
          </div>
        </div>
      </div>
    </div>
  );
}
