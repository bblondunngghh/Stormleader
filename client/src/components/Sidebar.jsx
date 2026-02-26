import { useState } from 'react';
import { IconLogOut } from './Icons';
import { useAuth } from '../auth/AuthContext';

import iconDashboard from '../assets/icons/App-Window-Pie-Chart--Streamline-Ultimate.svg';
import iconPipeline from '../assets/icons/Business-Team-Goal--Streamline-Ultimate.svg';
import iconLeads from '../assets/icons/Style-Three-Pin-Home--Streamline-Ultimate.svg';
import iconStormMap from '../assets/icons/Rain-Umbrella-1--Streamline-Ultimate.svg';
import iconAlerts from '../assets/icons/Alarm-Bell-Ring--Streamline-Ultimate.svg';
import iconTasks from '../assets/icons/Checklist--Streamline-Ultimate.svg';
import iconEstimates from '../assets/icons/Accounting-Calculator-1--Streamline-Ultimate.svg';
import iconSettings from '../assets/icons/Settings-Slider-Desktop-Horizontal--Streamline-Ultimate.svg';
import iconBrand from '../assets/icons/Weather-Cloud-Wind-4--Streamline-Ultimate.svg';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: iconDashboard },
  { id: 'storm-map', label: 'Storm Map', icon: iconStormMap },
  { id: 'pipeline', label: 'Pipeline', icon: iconPipeline },
  { id: 'leads', label: 'Leads', icon: iconLeads },
  { id: 'estimates', label: 'Estimates', icon: iconEstimates },
  { id: 'tasks', label: 'Tasks', icon: iconTasks },
  { id: 'alerts', label: 'Alerts', icon: iconAlerts },
  { id: 'settings', label: 'Settings', icon: iconSettings },
];

export default function Sidebar({ activeView, onNavigate }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const initials = user
    ? `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase() || 'U'
    : 'U';
  const displayName = user
    ? `${user.firstName || ''} ${(user.lastName || '')[0] || ''}.`.trim()
    : 'User';

  return (
    <aside className={`sidebar glass ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__brand" onClick={() => setCollapsed(c => !c)} style={{ cursor: 'pointer' }}>
        <div className="sidebar__logo"><img src={iconBrand} alt="StormLeads" width="28" height="28" /></div>
        {!collapsed && (
          <div>
            <div className="sidebar__title">StormLeads</div>
            <div className="sidebar__subtitle">Roofing CRM</div>
          </div>
        )}
      </div>

      <nav>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-link${activeView === item.id ? ' is-active' : ''}`}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <img src={item.icon} alt="" width="20" height="20" className="nav-link__icon" />
            {!collapsed && item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar__spacer" />

      <div className="sidebar__user">
        <div className="sidebar__avatar">{initials}</div>
        {!collapsed && (
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">{displayName}</span>
            <span className="sidebar__user-role">{user?.role || 'Admin'}</span>
          </div>
        )}
        <button
          onClick={logout}
          style={{ marginLeft: collapsed ? 0 : 'auto', color: 'var(--text-muted)', transition: 'color 0.2s' }}
          title="Sign out"
        >
          <IconLogOut />
        </button>
      </div>
    </aside>
  );
}
