import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import * as adminApi from '../api/admin';
import iconAdmin from '../assets/icons/Monitor-Graph-Line--Streamline-Ultimate.svg';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoney(cents) {
  if (cents == null || isNaN(Number(cents))) return '$0.00';
  return '$' + (Number(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelative(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  active:    { color: 'oklch(0.75 0.18 145)', bg: 'oklch(0.75 0.18 145 / 0.12)', border: 'oklch(0.75 0.18 145 / 0.25)' },
  trialing:  { color: 'oklch(0.72 0.18 250)', bg: 'oklch(0.72 0.18 250 / 0.12)', border: 'oklch(0.72 0.18 250 / 0.25)' },
  past_due:  { color: 'oklch(0.65 0.20 25)',  bg: 'oklch(0.65 0.20 25 / 0.12)',  border: 'oklch(0.65 0.20 25 / 0.25)'  },
  cancelled: { color: 'oklch(0.55 0.02 260)', bg: 'oklch(0.55 0.02 260 / 0.12)', border: 'oklch(0.55 0.02 260 / 0.25)' },
  canceled:  { color: 'oklch(0.55 0.02 260)', bg: 'oklch(0.55 0.02 260 / 0.12)', border: 'oklch(0.55 0.02 260 / 0.25)' },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.cancelled;
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
      padding: '3px 8px', borderRadius: 'var(--radius-pill)',
      color: style.color, background: style.bg, border: `1px solid ${style.border}`,
    }}>
      {status || 'unknown'}
    </span>
  );
}

// ─── Tier Badge ───────────────────────────────────────────────────────────────

const TIER_STYLES = {
  starter:      { color: 'oklch(0.75 0.03 260)', bg: 'oklch(0.75 0.03 260 / 0.10)' },
  professional: { color: 'oklch(0.72 0.18 250)', bg: 'oklch(0.72 0.18 250 / 0.10)' },
  enterprise:   { color: 'oklch(0.80 0.15 85)',  bg: 'oklch(0.80 0.15 85 / 0.10)'  },
};

function TierBadge({ tier }) {
  const style = TIER_STYLES[tier] || TIER_STYLES.starter;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
      color: style.color, background: style.bg,
      padding: '2px 8px', borderRadius: 'var(--radius-pill)',
    }}>
      {tier || 'starter'}
    </span>
  );
}

// ─── Shield Icon ──────────────────────────────────────────────────────────────

function IconShield(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function IconChevronRight(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

function IconChevronDown(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent, sub }) {
  return (
    <div className="glass" style={{
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-xl)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent || 'var(--text-primary)', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
      )}
    </div>
  );
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({ children, style }) {
  return (
    <div className="glass" style={{
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-xl)',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Tab Nav ──────────────────────────────────────────────────────────────────

function TabNav({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 2,
      background: 'oklch(0.16 0.02 260 / 0.6)',
      borderRadius: 'var(--radius-md)',
      padding: 3,
      border: '1px solid var(--glass-border)',
      width: 'fit-content',
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{
            padding: '8px 18px', borderRadius: 'var(--radius-sm)',
            fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: active === t.id ? 'oklch(0.30 0.05 250 / 0.6)' : 'transparent',
            color: active === t.id ? 'var(--accent-blue)' : 'var(--text-muted)',
            transition: 'all 0.15s var(--ease-out)',
          }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({ children, style }) {
  return (
    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-lg)', ...style }}>
      {children}
    </div>
  );
}

// ─── Loading / Empty states ───────────────────────────────────────────────────

function LoadingState({ message = 'Loading...' }) {
  return (
    <div style={{ padding: 'var(--space-xl)', color: 'var(--text-muted)', fontSize: 13 }}>
      {message}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ padding: 'var(--space-xl)', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
      {message}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getOverview()
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load overview data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <EmptyState message={error} />;
  if (!data) return null;

  const cards = [
    {
      label: 'Total Tenants',
      value: data.totalTenants ?? '—',
      accent: 'var(--text-primary)',
      sub: `${data.activeTenants ?? 0} active`,
    },
    {
      label: 'Trial Tenants',
      value: data.trialTenants ?? '—',
      accent: 'oklch(0.72 0.18 250)',
    },
    {
      label: 'New This Month',
      value: data.newTenantsThisMonth ?? '—',
      accent: 'oklch(0.75 0.18 145)',
      sub: 'tenants',
    },
    {
      label: 'Total Users',
      value: data.totalUsers ?? '—',
      accent: 'var(--text-primary)',
      sub: `+${data.newUsersThisMonth ?? 0} this month`,
    },
    {
      label: 'Total Leads',
      value: (data.totalLeads ?? 0).toLocaleString(),
      accent: 'oklch(0.80 0.15 85)',
    },
    {
      label: 'MRR',
      value: formatMoney(data.mrr),
      accent: 'oklch(0.75 0.18 145)',
    },
    {
      label: 'Skip Trace Rev (30d)',
      value: formatMoney(data.skipTraceRevenue30d),
      accent: 'oklch(0.72 0.18 250)',
      sub: 'add-on billing',
    },
    {
      label: 'Roof Meas. Rev (30d)',
      value: formatMoney(data.roofMeasurementRevenue30d),
      accent: 'oklch(0.80 0.15 85)',
      sub: 'add-on billing',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 'var(--space-md)',
      }}>
        {cards.map(c => (
          <StatCard key={c.label} label={c.label} value={c.value} accent={c.accent} sub={c.sub} />
        ))}
      </div>
    </div>
  );
}

// ─── Tenant Detail Inline Panel ───────────────────────────────────────────────

function TenantDetail({ tenantId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [tier, setTier] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    setLoading(true);
    adminApi.getTenantDetail(tenantId)
      .then(res => {
        setData(res.data);
        setTier(res.data.subscriptionTier || 'starter');
        setStatus(res.data.subscriptionStatus || 'active');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.updateTenant(tenantId, { subscriptionTier: tier, subscriptionStatus: status });
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2000);
      setData(prev => ({ ...prev, subscriptionTier: tier, subscriptionStatus: status }));
    } catch {
      setSaveMsg('Error saving');
      setTimeout(() => setSaveMsg(''), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      marginTop: 'var(--space-sm)',
      background: 'oklch(0.13 0.02 260 / 0.8)',
      border: '1px solid oklch(0.30 0.04 250 / 0.4)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-xl)',
    }}>
      {loading ? (
        <LoadingState message="Loading tenant details..." />
      ) : !data ? (
        <EmptyState message="Could not load tenant details." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{data.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                {data.slug} &middot; ID: {data.id}
              </div>
            </div>
            <button onClick={onClose} style={{
              fontSize: 12, color: 'var(--text-muted)', background: 'transparent',
              border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)',
              padding: '4px 10px', cursor: 'pointer',
            }}>
              Close
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
            {/* Billing Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Billing Controls
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Subscription Tier</label>
                <select value={tier} onChange={e => setTier(e.target.value)}
                  className="form-input" style={{ fontSize: 12 }}>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Subscription Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="form-input" style={{ fontSize: 12 }}>
                  <option value="active">Active</option>
                  <option value="trialing">Trialing</option>
                  <option value="past_due">Past Due</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <button onClick={handleSave} disabled={saving} style={{
                  padding: '7px 18px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700,
                  background: 'oklch(0.72 0.18 250 / 0.2)', color: 'var(--accent-blue)',
                  border: '1px solid oklch(0.72 0.18 250 / 0.3)', cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                {saveMsg && (
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    color: saveMsg === 'Saved' ? 'var(--accent-green)' : 'var(--accent-red)',
                  }}>
                    {saveMsg}
                  </span>
                )}
              </div>

              {data.stripeCustomerId && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--space-sm)' }}>
                  Stripe: <span style={{ fontFamily: 'monospace' }}>{data.stripeCustomerId}</span>
                </div>
              )}
              {data.trialEndsAt && (
                <div style={{ fontSize: 11, color: 'oklch(0.72 0.18 250)' }}>
                  Trial ends: {formatDate(data.trialEndsAt)}
                </div>
              )}
            </div>

            {/* Lead Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Lead Stats
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
                {[
                  { label: 'Total', value: data.leads?.total ?? data.leadCount ?? 0, color: 'var(--text-primary)' },
                  { label: 'Won', value: data.leads?.won ?? 0, color: 'oklch(0.75 0.18 145)' },
                  { label: 'Lost', value: data.leads?.lost ?? 0, color: 'oklch(0.65 0.20 25)' },
                  { label: 'Last 30d', value: data.leads?.last30d ?? 0, color: 'oklch(0.72 0.18 250)' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: 'oklch(0.18 0.02 260 / 0.5)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-md)',
                    border: '1px solid oklch(0.30 0.02 260 / 0.3)',
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginTop: 'var(--space-sm)' }}>
                Add-On Config
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Skip Trace</span>
                  <span style={{ color: data.skipTraceEnabled ? 'oklch(0.75 0.18 145)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {data.skipTraceEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Roof Measurement</span>
                  <span style={{ color: data.roofMeasurementEnabled ? 'oklch(0.75 0.18 145)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {data.roofMeasurementEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Users List */}
          {data.users && data.users.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                Users ({data.users.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.users.map(u => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                    padding: '8px 0',
                    borderBottom: '1px solid oklch(0.25 0.02 260 / 0.2)',
                    fontSize: 12,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: 'oklch(0.30 0.08 250 / 0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)',
                    }}>
                      {((u.first_name || u.firstName || '')[0] || '?').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {u.first_name || u.firstName || ''} {u.last_name || u.lastName || ''}
                      </div>
                      <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      color: u.role === 'admin' ? 'oklch(0.65 0.20 25)' : u.role === 'manager' ? 'oklch(0.80 0.15 85)' : 'var(--accent-blue)',
                    }}>
                      {u.role}
                    </span>
                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(u.created_at || u.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Billing summary */}
          {data.billing && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                Billing Summary
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-xl)', fontSize: 13 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'oklch(0.75 0.18 145)' }}>
                    {formatMoney(data.billing.totalSpentCents || 0)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>Total Spent</div>
                </div>
                {data.billing.subscriptionsCents != null && (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'oklch(0.72 0.18 250)' }}>
                      {formatMoney(data.billing.subscriptionsCents)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>Subscriptions</div>
                  </div>
                )}
                {data.billing.addonsCents != null && (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'oklch(0.80 0.15 85)' }}>
                      {formatMoney(data.billing.addonsCents)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>Add-Ons</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tenants Tab ──────────────────────────────────────────────────────────────

function TenantsTab() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at');
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback((q) => {
    setLoading(true);
    adminApi.getTenants({ search: q, sort, order: 'desc' })
      .then(res => setTenants(res.data || []))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  }, [sort]);

  useEffect(() => { load(search); }, [load]);

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    load(q);
  };

  const handleRowClick = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const cols = [
    { label: 'Tenant', key: 'name', flex: 2 },
    { label: 'Plan', key: 'subscriptionTier', flex: 1 },
    { label: 'Status', key: 'subscriptionStatus', flex: 1 },
    { label: 'Users', key: 'userCount', flex: 1 },
    { label: 'Leads', key: 'leadCount', flex: 1 },
    { label: 'Skip Trace (30d)', key: 'skipTraceUsage30d', flex: 1 },
    { label: 'Roof Meas (30d)', key: 'roofMeasurementUsage30d', flex: 1 },
    { label: 'Created', key: 'createdAt', flex: 1 },
    { label: 'Last Active', key: 'lastActivity', flex: 1 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Search bar */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={handleSearch}
            className="form-input"
            style={{ paddingLeft: 36, width: '100%', fontSize: 13 }}
          />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <select value={sort} onChange={e => { setSort(e.target.value); }}
          className="form-input" style={{ fontSize: 12, width: 'auto' }}>
          <option value="created_at">Sort: Created</option>
          <option value="name">Sort: Name</option>
          <option value="user_count">Sort: Users</option>
          <option value="lead_count">Sort: Leads</option>
          <option value="last_activity">Sort: Last Active</option>
        </select>
      </div>

      {/* Table */}
      <Panel style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 32px',
          gap: 0,
          padding: '10px var(--space-xl)',
          borderBottom: '1px solid var(--glass-border)',
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          color: 'var(--text-muted)',
        }}>
          {cols.map(c => <span key={c.key} style={c.key !== 'name' ? { textAlign: 'center' } : undefined}>{c.label}</span>)}
          <span />
        </div>

        {loading ? (
          <LoadingState />
        ) : tenants.length === 0 ? (
          <EmptyState message="No tenants found." />
        ) : (
          <div>
            {tenants.map(t => (
              <div key={t.id}>
                {/* Row */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRowClick(t.id)}
                  onKeyDown={e => e.key === 'Enter' && handleRowClick(t.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 32px',
                    gap: 0,
                    padding: '12px var(--space-xl)',
                    borderBottom: '1px solid oklch(0.22 0.02 260 / 0.3)',
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                    background: expandedId === t.id ? 'oklch(0.20 0.03 250 / 0.25)' : 'transparent',
                    outline: 'none',
                  }}
                  onMouseEnter={e => { if (expandedId !== t.id) e.currentTarget.style.background = 'oklch(0.20 0.02 260 / 0.15)'; }}
                  onMouseLeave={e => { if (expandedId !== t.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Name */}
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{t.slug}</div>
                  </div>
                  {/* Plan */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TierBadge tier={t.subscriptionTier} />
                  </div>
                  {/* Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <StatusBadge status={t.subscriptionStatus} />
                  </div>
                  {/* Users */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    {t.userCount ?? 0}
                  </div>
                  {/* Leads */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    {(t.leadCount ?? 0).toLocaleString()}
                  </div>
                  {/* Skip Trace */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    {(t.skipTraceUsage30d ?? 0).toLocaleString()}
                  </div>
                  {/* Roof Meas */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    {(t.roofMeasurementUsage30d ?? 0).toLocaleString()}
                  </div>
                  {/* Created */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
                    {formatDate(t.createdAt)}
                  </div>
                  {/* Last Active */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
                    {formatRelative(t.lastActivity)}
                  </div>
                  {/* Expand icon */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    {expandedId === t.id ? <IconChevronDown /> : <IconChevronRight />}
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === t.id && (
                  <div style={{ padding: '0 var(--space-xl) var(--space-lg)' }}>
                    <TenantDetail tenantId={t.id} onClose={() => setExpandedId(null)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ─── Revenue Tab ──────────────────────────────────────────────────────────────

function RevenueBar({ label, subscriptions, skipTrace, roofMeasurement, maxTotal }) {
  const total = (subscriptions || 0) + (skipTrace || 0) + (roofMeasurement || 0);
  const pctSub = maxTotal > 0 ? ((subscriptions || 0) / maxTotal) * 100 : 0;
  const pctSkip = maxTotal > 0 ? ((skipTrace || 0) / maxTotal) * 100 : 0;
  const pctRoof = maxTotal > 0 ? ((roofMeasurement || 0) / maxTotal) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
      {/* Stacked bar */}
      <div style={{
        height: 120,
        display: 'flex', flexDirection: 'column-reverse',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        background: 'oklch(0.18 0.02 260 / 0.4)',
        border: '1px solid oklch(0.25 0.02 260 / 0.3)',
        cursor: 'default',
      }}
        title={`${label}: ${formatMoney(total)}`}
      >
        <div style={{ height: `${pctSub}%`, background: 'oklch(0.72 0.18 250)', transition: 'height 0.5s ease' }} />
        <div style={{ height: `${pctSkip}%`, background: 'oklch(0.75 0.18 145)', transition: 'height 0.5s ease' }} />
        <div style={{ height: `${pctRoof}%`, background: 'oklch(0.80 0.15 85)', transition: 'height 0.5s ease' }} />
      </div>
      {/* Label */}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </div>
      {/* Value */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>
        {formatMoney(total)}
      </div>
    </div>
  );
}

function RevenueTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getRevenue()
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (!data) return <EmptyState message="No revenue data available." />;

  const monthly = data.monthly || [];
  const maxTotal = Math.max(
    ...monthly.map(m => (m.subscriptions || 0) + (m.skipTrace || 0) + (m.roofMeasurement || 0)),
    1
  );

  const totals = monthly.reduce((acc, m) => ({
    subscriptions: acc.subscriptions + (m.subscriptions || 0),
    skipTrace: acc.skipTrace + (m.skipTrace || 0),
    roofMeasurement: acc.roofMeasurement + (m.roofMeasurement || 0),
  }), { subscriptions: 0, skipTrace: 0, roofMeasurement: 0 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Chart */}
      <Panel>
        <SectionTitle>Monthly Revenue (Last 12 Months)</SectionTitle>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
          {[
            { label: 'Subscriptions', color: 'oklch(0.72 0.18 250)' },
            { label: 'Skip Trace', color: 'oklch(0.75 0.18 145)' },
            { label: 'Roof Measurement', color: 'oklch(0.80 0.15 85)' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
              {item.label}
            </div>
          ))}
        </div>

        {/* Y-axis labels + bars */}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
          {/* Y-axis */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 120, paddingBottom: 0, flexShrink: 0 }}>
            {[1, 0.75, 0.5, 0.25, 0].map(pct => (
              <div key={pct} style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', lineHeight: 1 }}>
                {formatMoney(maxTotal * pct)}
              </div>
            ))}
          </div>

          {/* Bars */}
          <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'flex-end', overflowX: 'auto' }}>
            {monthly.length === 0 ? (
              <EmptyState message="No monthly data yet." />
            ) : monthly.map((m, i) => (
              <RevenueBar
                key={m.month || i}
                label={m.month || ''}
                subscriptions={m.subscriptions}
                skipTrace={m.skipTrace}
                roofMeasurement={m.roofMeasurement}
                maxTotal={maxTotal}
              />
            ))}
          </div>
        </div>
      </Panel>

      {/* Summary totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
        <StatCard label="Total Subscriptions" value={formatMoney(totals.subscriptions)} accent="oklch(0.72 0.18 250)" />
        <StatCard label="Total Skip Trace" value={formatMoney(totals.skipTrace)} accent="oklch(0.75 0.18 145)" />
        <StatCard label="Total Roof Meas." value={formatMoney(totals.roofMeasurement)} accent="oklch(0.80 0.15 85)" />
        <StatCard
          label="All-Time Revenue"
          value={formatMoney(totals.subscriptions + totals.skipTrace + totals.roofMeasurement)}
          accent="var(--text-primary)"
        />
      </div>
    </div>
  );
}

// ─── Usage Tab ────────────────────────────────────────────────────────────────

function UsageLeaderboard({ items }) {
  if (!items || items.length === 0) {
    return <EmptyState message="No usage data yet." />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <div key={item.tenantId || i} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
          padding: '8px 0',
          borderBottom: '1px solid oklch(0.25 0.02 260 / 0.15)',
          fontSize: 12,
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800,
            background: i === 0 ? 'oklch(0.80 0.15 85 / 0.25)' : i === 1 ? 'oklch(0.75 0.03 260 / 0.20)' : 'oklch(0.20 0.02 260 / 0.4)',
            color: i === 0 ? 'oklch(0.80 0.15 85)' : i === 1 ? 'oklch(0.65 0.05 260)' : 'var(--text-muted)',
          }}>
            {i + 1}
          </span>
          <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.tenantName || item.name || `Tenant ${item.tenantId}`}
          </span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
            {(item.count || item.total || 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function UsageTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getUsage()
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (!data) return <EmptyState message="No usage data available." />;

  const { skipTrace, roofMeasurement } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
        {/* Skip Trace */}
        <Panel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-lg)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.72 0.18 250)', flexShrink: 0 }} />
            <SectionTitle style={{ margin: 0 }}>Skip Trace</SectionTitle>
          </div>

          {/* Key metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'oklch(0.72 0.18 250)' }}>
                {(skipTrace?.total ?? 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>All-Time</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                {(skipTrace?.last30d ?? 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>Last 30 Days</div>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
            Top Tenants
          </div>
          <UsageLeaderboard items={skipTrace?.topTenants} />
        </Panel>

        {/* Roof Measurement */}
        <Panel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-lg)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.80 0.15 85)', flexShrink: 0 }} />
            <SectionTitle style={{ margin: 0 }}>Roof Measurement</SectionTitle>
          </div>

          {/* Key metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'oklch(0.80 0.15 85)' }}>
                {(roofMeasurement?.total ?? 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>All-Time</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                {(roofMeasurement?.last30d ?? 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>Last 30 Days</div>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
            Top Tenants
          </div>
          <UsageLeaderboard items={roofMeasurement?.topTenants} />
        </Panel>
      </div>
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Overview'  },
  { id: 'tenants',   label: 'Tenants'   },
  { id: 'revenue',   label: 'Revenue'   },
  { id: 'usage',     label: 'Usage'     },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');

  // Guard: only super_admin may access
  if (user && user.role !== 'super_admin') {
    return (
      <div className="main-content" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Panel style={{ textAlign: 'center', maxWidth: 400 }}>
          <IconShield style={{ color: 'var(--accent-red)', margin: '0 auto var(--space-lg)' }} width={32} height={32} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Access Denied</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            This panel requires super admin privileges.
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="main-content">
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: '0 var(--space-xs)' }}>
        <img src={iconAdmin} alt="" width="24" height="24" />
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Super Admin</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
            Platform-wide management &amp; analytics
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <TabNav tabs={TABS} active={tab} onChange={setTab} />

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab />}
      {tab === 'tenants'  && <TenantsTab />}
      {tab === 'revenue'  && <RevenueTab />}
      {tab === 'usage'    && <UsageTab />}
    </div>
  );
}
