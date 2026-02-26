import { useState } from 'react';
import { NavIcon, IconLogOut } from './Icons';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'pipeline', label: 'Pipeline', icon: 'columns' },
  { id: 'leads', label: 'Leads', icon: 'users' },
  { id: 'storm-map', label: 'Storm Map', icon: 'map' },
  { id: 'alerts', label: 'Alerts', icon: 'bell' },
  { id: 'tasks', label: 'Tasks', icon: 'check-square' },
  { id: 'estimates', label: 'Estimates', icon: 'file-text' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
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
        <div className="sidebar__logo">⛈️</div>
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
            <NavIcon name={item.icon} className="nav-link__icon" />
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
