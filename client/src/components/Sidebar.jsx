import { useState } from 'react';
import { IconLogOut } from './Icons';
import { useAuth } from '../auth/AuthContext';

import {
  ChartBarSquareIcon,
  UserCircleIcon,
  HomeModernIcon,
  CloudIcon,
  BellAlertIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  AdjustmentsHorizontalIcon,
  ChartBarIcon,
  WrenchIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import iconBrand from '../assets/icons/stormpipe-brand.jpg';
const navItems = [
  { id: 'dashboard', label: 'Dashboard', Icon: ChartBarSquareIcon },
  { id: 'storm-map', label: 'Storm Map', Icon: CloudIcon },
  { id: 'pipeline', label: 'Pipeline', Icon: UserCircleIcon },
  { id: 'leads', label: 'Leads', Icon: HomeModernIcon },
  { id: 'estimates', label: 'Estimates', Icon: DocumentTextIcon },
  { id: 'materials', label: 'Materials', Icon: WrenchIcon },
  { id: 'tasks', label: 'Tasks', Icon: ClipboardDocumentCheckIcon },
  { id: 'calendar', label: 'Calendar', Icon: CalendarDaysIcon },
];

const settingsItem = { id: 'settings', label: 'Settings', Icon: AdjustmentsHorizontalIcon };

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
        <div className="sidebar__logo"><img src="/bg-wallpaper.jpg" alt="StormPipe" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', opacity: 0.7 }} /></div>
        {!collapsed && (
          <div>
            <div className="sidebar__title">StormPipe</div>
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
            <item.Icon width={20} height={20} className="nav-link__icon" />
            {!collapsed && item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar__spacer" />

      <button
        className={`nav-link${activeView === settingsItem.id ? ' is-active' : ''}`}
        onClick={() => onNavigate(settingsItem.id)}
        title={collapsed ? settingsItem.label : undefined}
      >
        <settingsItem.Icon width={20} height={20} className="nav-link__icon" />
        {!collapsed && settingsItem.label}
      </button>

      {user?.role === 'super_admin' && (
        <button
          className={`nav-link${activeView === 'admin' ? ' is-active' : ''}`}
          onClick={() => onNavigate('admin')}
          title={collapsed ? 'Admin' : undefined}
          style={{
            color: activeView === 'admin' ? 'oklch(0.72 0.18 250)' : 'var(--text-muted)',
          }}
        >
          <ChartBarIcon width={20} height={20} className="nav-link__icon" />
          {!collapsed && 'Admin'}
        </button>
      )}

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
