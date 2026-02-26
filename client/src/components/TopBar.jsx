import { useState, useEffect, useRef, useCallback } from 'react';
import { IconSearch, IconBell, IconHelpCircle, IconX } from './Icons';
import * as notificationsApi from '../api/notifications';
import * as searchApi from '../api/search';

const viewTitles = {
  dashboard: 'Dashboard',
  pipeline: 'Pipeline',
  leads: 'Leads',
  'storm-map': 'Storm Map',
  alerts: 'Alerts',
  tasks: 'Tasks',
  estimates: 'Estimates',
  settings: 'Settings',
};

export default function TopBar({ activeView, onNavigate }) {
  return (
    <header className="topbar glass">
      <h1 className="topbar__page-title">{viewTitles[activeView] || 'Dashboard'}</h1>

      <GlobalSearch onNavigate={onNavigate} />

      <div className="topbar__spacer" />

      <div className="topbar__actions">
        <HelpGuide />
        <NotificationBell />
      </div>
    </header>
  );
}

// ============================================================
// GLOBAL SEARCH (Cmd-K)
// ============================================================

function GlobalSearch({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Cmd-K / Ctrl-K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(null);
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchApi.globalSearch(query);
        setResults(res.data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hasResults = results && (results.leads?.length || results.contacts?.length || results.estimates?.length);

  return (
    <div className="topbar__search" ref={dropdownRef}>
      <IconSearch className="topbar__search-icon" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search leads, contacts... (Ctrl+K)"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />

      {open && query.length >= 2 && (
        <div className="search-dropdown glass">
          {loading ? (
            <div className="search-dropdown__empty">Searching...</div>
          ) : !hasResults ? (
            <div className="search-dropdown__empty">No results for "{query}"</div>
          ) : (
            <>
              {results.leads?.length > 0 && (
                <SearchGroup title="Leads" items={results.leads.map(l => ({
                  id: l.id,
                  primary: l.contact_name || l.address,
                  secondary: `${l.address}${l.city ? `, ${l.city}` : ''} — ${l.stage}`,
                  value: l.estimated_value ? `$${Number(l.estimated_value).toLocaleString()}` : null,
                }))} onSelect={() => { setOpen(false); setQuery(''); }} />
              )}
              {results.contacts?.length > 0 && (
                <SearchGroup title="Contacts" items={results.contacts.map(c => ({
                  id: c.id,
                  primary: `${c.first_name} ${c.last_name}`,
                  secondary: `${c.role}${c.lead_address ? ` — ${c.lead_address}` : ''}`,
                  value: c.phone || c.email,
                }))} onSelect={() => { setOpen(false); setQuery(''); }} />
              )}
              {results.estimates?.length > 0 && (
                <SearchGroup title="Estimates" items={results.estimates.map(e => ({
                  id: e.id,
                  primary: `${e.estimate_number} — ${e.customer_name || 'Unnamed'}`,
                  secondary: e.status,
                  value: `$${Number(e.total).toLocaleString()}`,
                }))} onSelect={() => { setOpen(false); setQuery(''); }} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SearchGroup({ title, items, onSelect }) {
  return (
    <div className="search-group">
      <div className="search-group__title">{title}</div>
      {items.map(item => (
        <div key={item.id} className="search-result" onClick={onSelect}>
          <div className="search-result__primary">{item.primary}</div>
          <div className="search-result__secondary">{item.secondary}</div>
          {item.value && <div className="search-result__value">{item.value}</div>}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// HELP GUIDE DROPDOWN
// ============================================================

function HelpGuide() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button className="topbar__btn" aria-label="Help" onClick={() => setOpen(!open)}>
        <IconHelpCircle />
      </button>

      {open && (
        <div className="help-dropdown glass">
          <div className="help-dropdown__header">
            <span style={{ fontWeight: 700, fontSize: 14 }}>How StormLeads Works</span>
            <button onClick={() => setOpen(false)} style={{ color: 'var(--text-muted)' }}>
              <IconX width={14} height={14} />
            </button>
          </div>

          <div className="help-dropdown__body">
            <div className="help-section">
              <div className="help-section__title">Quick Start</div>
              <div className="help-step">
                <span className="help-step__num">1</span>
                <span className="help-step__text">Check the <strong>Storm Map</strong> for recent hail events in your area.</span>
              </div>
              <div className="help-step">
                <span className="help-step__num">2</span>
                <span className="help-step__text">Create leads from affected properties and add them to your <strong>Pipeline</strong>.</span>
              </div>
              <div className="help-step">
                <span className="help-step__num">3</span>
                <span className="help-step__text">Track each lead through stages: door knock, appointment, estimate, production, and close.</span>
              </div>
              <div className="help-step">
                <span className="help-step__num">4</span>
                <span className="help-step__text">Send <strong>Estimates</strong> to homeowners and collect e-signatures.</span>
              </div>
              <div className="help-step">
                <span className="help-step__num">5</span>
                <span className="help-step__text">Use the <strong>Dashboard</strong> to monitor your team's performance and revenue.</span>
              </div>
            </div>

            <div className="help-section">
              <div className="help-section__title">Storm Map</div>
              <div className="help-section__text">
                View NOAA hail swath data overlaid on a map. Click swaths to see severity, then identify properties in affected zones to create new leads.
              </div>
            </div>

            <div className="help-section">
              <div className="help-section__title">Pipeline</div>
              <div className="help-section__text">
                A kanban board showing all your leads organized by stage. Drag and drop cards between columns to update their status instantly.
              </div>
            </div>

            <div className="help-section">
              <div className="help-section__title">Leads</div>
              <div className="help-section__text">
                A filterable, sortable table of every lead. Use bulk actions to update stages, export to CSV, or reassign leads between team members.
              </div>
            </div>

            <div className="help-section">
              <div className="help-section__title">Lead Detail</div>
              <div className="help-section__text">
                Click any lead to see its full history — contacts, documents, activity log, and notes. Edit fields inline and upload photos or files.
              </div>
            </div>

            <div className="help-section">
              <div className="help-section__title">Dashboard</div>
              <div className="help-section__text">
                At-a-glance stats: revenue funnel, activity feed, tasks due today, and a team leaderboard. Track your sales pipeline health over time.
              </div>
            </div>

            <div className="help-section">
              <div className="help-section__title">Tasks</div>
              <div className="help-section__text">
                Manage follow-ups and to-dos. Create tasks linked to specific leads, filter by status, and never miss a callback or appointment.
              </div>
            </div>

            <div className="help-section">
              <div className="help-section__title">Estimates</div>
              <div className="help-section__text">
                Build professional estimates with line items, apply templates, then send a public link for homeowner review and e-signature.
              </div>
            </div>

            <div className="help-section">
              <div className="help-section__title">Settings & Alerts</div>
              <div className="help-section__text">
                Configure your profile, manage team members and roles, set up storm alert zones to get notified when new hail events hit your territory.
              </div>
            </div>

            <div className="help-section">
              <div className="help-section__title">Keyboard Shortcuts</div>
              <div className="help-section__text">
                <span className="help-kbd">Ctrl</span> + <span className="help-kbd">K</span> — Open global search to quickly find any lead, contact, or estimate.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// NOTIFICATION BELL + DROPDOWN
// ============================================================

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Poll unread count every 30s
  const fetchCount = useCallback(async () => {
    try {
      const res = await notificationsApi.getUnreadCount();
      setUnreadCount(res.data.count || 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.getNotifications({ limit: 20 });
      setNotifications(res.data.notifications || []);
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleOpen = () => {
    setOpen(!open);
    if (!open) fetchNotifications();
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button className="topbar__btn" aria-label="Notifications" onClick={handleOpen}>
        <IconBell />
        {unreadCount > 0 && <span className="topbar__badge" />}
      </button>

      {open && (
        <div className="notification-dropdown glass">
          <div className="notification-dropdown__header">
            <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-dropdown__list">
            {loading ? (
              <div className="notification-dropdown__empty">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="notification-dropdown__empty">No notifications</div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                className={`notification-item ${!n.is_read ? 'notification-item--unread' : ''}`}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
              >
                <div className="notification-item__dot" />
                <div className="notification-item__body">
                  <div className="notification-item__title">{n.title}</div>
                  {n.body && <div className="notification-item__text">{n.body}</div>}
                  <div className="notification-item__time">
                    {formatRelativeTime(n.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(date) {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}
