import { navItems } from '../data/mockData';
import { NavIcon, IconLogOut } from './Icons';
import { useAuth } from '../auth/AuthContext';

export default function Sidebar({ activeView, onNavigate }) {
  const { user, logout } = useAuth();

  const initials = user
    ? `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase() || 'U'
    : 'U';
  const displayName = user
    ? `${user.firstName || ''} ${(user.lastName || '')[0] || ''}.`.trim()
    : 'User';

  return (
    <aside className="sidebar glass">
      <div className="sidebar__brand">
        <div className="sidebar__logo">⛈️</div>
        <div>
          <div className="sidebar__title">StormLeads</div>
          <div className="sidebar__subtitle">Roofing CRM</div>
        </div>
      </div>

      <nav>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-link${activeView === item.id ? ' is-active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <NavIcon name={item.icon} className="nav-link__icon" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar__spacer" />

      <div className="sidebar__user">
        <div className="sidebar__avatar">{initials}</div>
        <div className="sidebar__user-info">
          <span className="sidebar__user-name">{displayName}</span>
          <span className="sidebar__user-role">{user?.role || 'Admin'}</span>
        </div>
        <button
          onClick={logout}
          style={{ marginLeft: 'auto', color: 'var(--text-muted)', transition: 'color 0.2s' }}
          title="Sign out"
        >
          <IconLogOut />
        </button>
      </div>
    </aside>
  );
}
