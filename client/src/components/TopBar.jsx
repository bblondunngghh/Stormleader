import { IconSearch, IconBell } from './Icons';

const viewTitles = {
  dashboard: 'Dashboard',
  pipeline: 'Pipeline',
  leads: 'Leads',
  'storm-map': 'Storm Map',
  tasks: 'Tasks',
  estimates: 'Estimates',
  settings: 'Settings',
};

export default function TopBar({ activeView }) {
  return (
    <header className="topbar glass">
      <h1 className="topbar__page-title">{viewTitles[activeView] || 'Dashboard'}</h1>

      <div className="topbar__search">
        <IconSearch className="topbar__search-icon" />
        <input type="text" placeholder="Search leads, addresses, claims..." />
      </div>

      <div className="topbar__spacer" />

      <div className="topbar__actions">
        <button className="topbar__btn" aria-label="Notifications">
          <IconBell />
          <span className="topbar__badge" />
        </button>
      </div>
    </header>
  );
}
