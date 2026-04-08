import { useState, useEffect } from 'react';
import { IconLogOut } from './Icons';
import { useAuth } from '../auth/AuthContext';

import {
  ChartBarSquareIcon,
  UserCircleIcon,
  HomeModernIcon,
  CloudIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  BanknotesIcon,
  AdjustmentsHorizontalIcon,
  ChartBarIcon,
  WrenchIcon,
  WrenchScrewdriverIcon,
  CalendarDaysIcon,
  MapPinIcon,
  PresentationChartBarIcon,
  ChevronDownIcon,
  UserGroupIcon,
  ReceiptPercentIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';

const topItems = [
  { id: 'dashboard', label: 'Dashboard', Icon: ChartBarSquareIcon },
  { id: 'storm-map', label: 'Storm Map', Icon: CloudIcon },
  { id: 'storm-catalog', label: 'Storm Archive', Icon: ArchiveBoxIcon },
  { id: 'pipeline', label: 'Pipeline', Icon: UserCircleIcon },
  { id: 'leads', label: 'Leads', Icon: HomeModernIcon },
];

const groups = [
  {
    key: 'jobs',
    label: 'Jobs',
    items: [
      { id: 'estimates', label: 'Estimates', Icon: DocumentTextIcon },
      { id: 'contracts', label: 'Contracts', Icon: DocumentTextIcon },
      { id: 'work-orders', label: 'Work Orders', Icon: WrenchScrewdriverIcon },
      { id: 'materials', label: 'Materials', Icon: WrenchIcon },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    items: [
      { id: 'invoices', label: 'Invoices', Icon: BanknotesIcon },
      { id: 'expenses', label: 'Expenses', Icon: ReceiptPercentIcon },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    items: [
      { id: 'tasks', label: 'Tasks', Icon: ClipboardDocumentCheckIcon },
      { id: 'calendar', label: 'Calendar', Icon: CalendarDaysIcon },
      { id: 'canvassing', label: 'Canvassing', Icon: MapPinIcon },
      { id: 'subcontractors', label: 'Subcontractors', Icon: UserGroupIcon },
      { id: 'reports', label: 'Reports', Icon: PresentationChartBarIcon },
    ],
  },
];

const settingsItem = { id: 'settings', label: 'Settings', Icon: AdjustmentsHorizontalIcon };

function loadExpandedGroups() {
  try {
    const stored = localStorage.getItem('sidebar-groups');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export default function Sidebar({ activeView, onNavigate }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(() => loadExpandedGroups());

  // Auto-expand group when its child route is active
  useEffect(() => {
    for (const g of groups) {
      if (g.items.some((item) => item.id === activeView)) {
        setExpanded((prev) => {
          if (prev[g.key]) return prev;
          const next = { ...prev, [g.key]: true };
          localStorage.setItem('sidebar-groups', JSON.stringify(next));
          return next;
        });
        break;
      }
    }
  }, [activeView]);

  const toggleGroup = (key) => {
    setExpanded((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('sidebar-groups', JSON.stringify(next));
      return next;
    });
  };

  const initials = user
    ? `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase() || 'U'
    : 'U';
  const displayName = user
    ? `${user.firstName || ''} ${(user.lastName || '')[0] || ''}.`.trim()
    : 'User';

  const renderNavButton = (item, isChild) => (
    <button
      key={item.id}
      className={`nav-link${isChild ? ' nav-link--child' : ''}${activeView === item.id ? ' is-active' : ''}`}
      onClick={() => onNavigate(item.id)}
      title={collapsed ? item.label : undefined}
    >
      <item.Icon width={isChild ? 16 : 20} height={isChild ? 16 : 20} className="nav-link__icon" />
      {!collapsed && item.label}
    </button>
  );

  return (
    <aside className={`sidebar glass ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__brand" onClick={() => setCollapsed((c) => !c)} style={{ cursor: 'pointer' }}>
        {collapsed ? (
          <div className="sidebar__logo">
            <img src="/stormpipe-logo.png" alt="StormPipe" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
          </div>
        ) : (
          <img src="/stormpipe-logo.png" alt="StormPipe" className="sidebar__brand-img" />
        )}
      </div>

      <nav>
        {/* Top-level items */}
        {topItems.map((item) => renderNavButton(item, false))}

        {/* Grouped items */}
        {groups.map((group) => {
          const isOpen = expanded[group.key];

          // When sidebar is collapsed, show all items as flat icons (no headers)
          if (collapsed) {
            return group.items.map((item) => renderNavButton(item, false));
          }

          return (
            <div key={group.key} className="nav-group">
              <button
                className="nav-group__header"
                onClick={() => toggleGroup(group.key)}
                type="button"
              >
                {group.label}
                <ChevronDownIcon
                  width={14}
                  height={14}
                  className={`nav-group__chevron${isOpen ? ' is-open' : ''}`}
                />
              </button>
              {isOpen && (
                <div className="nav-group__children">
                  {group.items.map((item) => renderNavButton(item, true))}
                </div>
              )}
            </div>
          );
        })}
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
