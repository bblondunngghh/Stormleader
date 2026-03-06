import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getAlertConfig, updateAlertConfig } from '../api/alerts';
import { getTeamMembers, updateUserRole } from '../api/crm';
import { getPreferences, updatePreference } from '../api/notifications';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import * as skipTraceApi from '../api/skipTrace';
import * as roofMeasurementApi from '../api/roofMeasurement';

export default function SettingsView() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'team', label: 'Team' },
    { id: 'alerts', label: 'Storm Alerts' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'skipTrace', label: 'Add-Ons' },
  ];

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)', maxWidth: 800 }}>
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 2, background: 'oklch(0.16 0.02 260 / 0.6)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--glass-border)', width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: tab === t.id ? 'oklch(0.30 0.05 250 / 0.6)' : 'transparent',
              color: tab === t.id ? 'var(--accent-blue)' : 'var(--text-muted)',
              transition: 'all 0.15s var(--ease-out)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab user={user} />}
      {tab === 'team' && <TeamTab currentUserId={user?.id} />}
      {tab === 'alerts' && <AlertsTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'skipTrace' && <AddOnsTab user={user} />}
    </div>
  );
}

// ============================================================
// PROFILE TAB
// ============================================================

function ProfileTab({ user }) {
  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Profile</div>
      <div className="detail-grid">
        <div className="detail-item">
          <span className="detail-item__label">Name</span>
          <span className="detail-item__value">{user?.firstName || ''} {user?.lastName || ''}</span>
        </div>
        <div className="detail-item">
          <span className="detail-item__label">Email</span>
          <span className="detail-item__value">{user?.email || '—'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-item__label">Role</span>
          <span className="detail-item__value" style={{ textTransform: 'capitalize' }}>{user?.role || '—'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-item__label">Tenant ID</span>
          <span className="detail-item__value" style={{ fontSize: 11, fontFamily: 'monospace' }}>{user?.tenantId || '—'}</span>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-xl)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        <strong>StormLeads</strong> — Storm damage lead management platform.<br />
        NOAA MESH ingestion, property overlay, skip trace integration, and full CRM pipeline.
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--space-md)' }}>
        v2.0.0 — Phase 2 CRM
      </div>
    </div>
  );
}

// ============================================================
// TEAM TAB
// ============================================================

const roleColors = {
  admin: 'var(--accent-red)',
  manager: 'var(--accent-amber)',
  sales_rep: 'var(--accent-blue)',
};

const roleLabels = { admin: 'Admin', manager: 'Manager', sales_rep: 'Sales Rep' };

function TeamTab({ currentUserId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTeamMembers()
      .then(res => setMembers(res.data.members || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRoleChange = async (userId, role) => {
    try {
      await updateUserRole(userId, role);
      setMembers(prev => prev.map(m => m.id === userId ? { ...m, role } : m));
    } catch { /* silent */ }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>Loading team...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
        {members.map(member => {
          const initials = `${(member.first_name || '')[0] || ''}${(member.last_name || '')[0] || ''}`.toUpperCase() || '?';
          const isCurrentUser = member.id === currentUserId;

          return (
            <div key={member.id} className="glass" style={{
              borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)',
              border: isCurrentUser ? '1px solid oklch(0.72 0.19 250 / 0.3)' : undefined,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800,
                  background: `linear-gradient(135deg, ${roleColors[member.role] || 'var(--accent-blue)'}, oklch(0.50 0.15 250))`,
                  color: 'oklch(0.98 0.005 260)',
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {member.first_name} {member.last_name}
                    {isCurrentUser && <span style={{ fontSize: 10, color: 'var(--accent-blue)', marginLeft: 6 }}>YOU</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.email}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-blue)' }}>{member.active_leads || 0}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-green)' }}>{member.sold_count || 0}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sold</div>
                </div>
              </div>

              <select className="form-input" value={member.role}
                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                disabled={isCurrentUser}
                style={{ fontSize: 12, width: '100%' }}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="sales_rep">Sales Rep</option>
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ALERTS TAB
// ============================================================

function AlertsTab() {
  const [alertConfig, setAlertConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    getAlertConfig()
      .then(config => setAlertConfig(config))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAlertToggle = async (field, value) => {
    if (!alertConfig) return;
    setSaving(true);
    try {
      const updated = { ...alertConfig, [field]: value };
      await updateAlertConfig(updated);
      setAlertConfig(updated);
      flash('Saved');
    } catch {
      flash('Error saving');
    } finally {
      setSaving(false);
    }
  };

  const flash = (msg) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(''), 2000);
  };

  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Storm Alerts</div>
        {saveMsg && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)' }}>{saveMsg}</span>}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 'var(--space-lg) 0' }}>Loading...</div>
      ) : !alertConfig ? (
        <div style={{ color: 'var(--text-muted)', padding: 'var(--space-lg) 0' }}>
          Alert configuration unavailable. Check your connection.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <ToggleRow label="Email Alerts" description="Send email notifications when storms are detected" checked={alertConfig.email_enabled} onChange={(v) => handleAlertToggle('email_enabled', v)} disabled={saving} />
          <ToggleRow label="Alert System Enabled" description="Master toggle for all storm alert processing" checked={alertConfig.enabled} onChange={(v) => handleAlertToggle('enabled', v)} disabled={saving} />

          <div className="divider" />

          <div style={{ display: 'flex', gap: 'var(--space-lg)' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Min Hail Size (inches)</label>
              <input className="form-input" type="number" step="0.25" min="0"
                value={alertConfig.min_hail_size_in || ''} disabled={saving}
                onChange={(e) => setAlertConfig(prev => ({ ...prev, min_hail_size_in: e.target.value ? parseFloat(e.target.value) : null }))}
                onBlur={() => handleAlertToggle('min_hail_size_in', alertConfig.min_hail_size_in)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Min Wind Speed (mph)</label>
              <input className="form-input" type="number" step="5" min="0"
                value={alertConfig.min_wind_speed_mph || ''} disabled={saving}
                onChange={(e) => setAlertConfig(prev => ({ ...prev, min_wind_speed_mph: e.target.value ? parseFloat(e.target.value) : null }))}
                onBlur={() => handleAlertToggle('min_wind_speed_mph', alertConfig.min_wind_speed_mph)} />
            </div>
          </div>

          <div className="form-group">
            <label>Alert Mode</label>
            <select className="form-input" value={alertConfig.alert_mode || 'immediate'}
              onChange={(e) => handleAlertToggle('alert_mode', e.target.value)} disabled={saving}>
              <option value="immediate">Immediate — alert on every qualifying storm</option>
              <option value="digest">Daily Digest — batch alerts into one email</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// NOTIFICATIONS TAB
// ============================================================

function NotificationsTab() {
  const [prefs, setPrefs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPreferences()
      .then(res => setPrefs(res.data.preferences || res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (notifType, field, value) => {
    try {
      await updatePreference({ notification_type: notifType, [field]: value });
      setPrefs(prev => prev.map(p => p.notification_type === notifType ? { ...p, [field]: value } : p));
    } catch { /* silent */ }
  };

  const typeLabels = {
    lead_assigned: 'Lead Assigned',
    lead_status_change: 'Lead Status Change',
    task_due: 'Task Due / Overdue',
    estimate_viewed: 'Estimate Viewed',
    estimate_accepted: 'Estimate Accepted',
    estimate_declined: 'Estimate Declined',
    storm_alert: 'Storm Alert',
    storm_leads_generated: 'Storm Leads Generated',
    mention: 'Mentioned in Note',
    system: 'System Notifications',
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>Loading...</div>;

  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Notification Preferences</div>

      <div style={{ overflowX: 'auto' }}>
        <table className="lead-table" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Type</th>
              <th style={{ textAlign: 'center' }}>In-App</th>
              <th style={{ textAlign: 'center' }}>Email</th>
            </tr>
          </thead>
          <tbody>
            {prefs.map(p => (
              <tr key={p.notification_type}>
                <td style={{ fontWeight: 500 }}>{typeLabels[p.notification_type] || p.notification_type}</td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={p.in_app !== false}
                    onChange={(e) => handleToggle(p.notification_type, 'in_app', e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent-blue)' }} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={p.email !== false}
                    onChange={(e) => handleToggle(p.notification_type, 'email', e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent-blue)' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {prefs.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 'var(--space-xl) 0' }}>
          No notification preferences configured yet.
        </div>
      )}
    </div>
  );
}

// ============================================================
// ADD-ONS TAB
// ============================================================

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function AddOnsTab({ user }) {
  const [config, setConfig] = useState(null);
  const [usage, setUsage] = useState(null);
  const [balance, setBalance] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [roofConfig, setRoofConfig] = useState(null);
  const [roofUsage, setRoofUsage] = useState(null);
  const [roofBalance, setRoofBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load skip trace and roof measurement data independently so one failing doesn't block the other
    const loadSkipTrace = Promise.all([
      skipTraceApi.getConfig(),
      skipTraceApi.getUsage(),
      skipTraceApi.getBalance(),
      skipTraceApi.getInvoices(),
    ])
      .then(([cfg, usg, bal, inv]) => {
        setConfig(cfg);
        setUsage(usg);
        setBalance(bal);
        setInvoices(inv);
      })
      .catch(() => {});

    const loadRoof = Promise.all([
      roofMeasurementApi.getConfig(),
      roofMeasurementApi.getUsage(),
      roofMeasurementApi.getBalance(),
    ])
      .then(([rCfg, rUsg, rBal]) => {
        setRoofConfig(rCfg);
        setRoofUsage(rUsg);
        setRoofBalance(rBal);
      })
      .catch(() => {});

    Promise.allSettled([loadSkipTrace, loadRoof])
      .finally(() => setLoading(false));
  }, []);

  const handleSkipTraceToggle = async (enabled) => {
    setConfig(prev => ({ ...prev, enabled }));
    try {
      const updated = await skipTraceApi.updateConfig({ enabled });
      setConfig(updated);
    } catch {
      setConfig(prev => ({ ...prev, enabled: !enabled }));
    }
  };

  const handleRoofToggle = async (enabled) => {
    setRoofConfig(prev => ({ ...prev, roof_measurement_enabled: enabled }));
    try {
      const updated = await roofMeasurementApi.updateConfig({ roof_measurement_enabled: enabled });
      setRoofConfig(updated);
    } catch {
      setRoofConfig(prev => ({ ...prev, roof_measurement_enabled: !enabled }));
    }
  };

  const handlePaymentSetup = async (pm) => {
    setConfig(prev => ({ ...prev, stripe_payment_method_id: pm.id, card_last_four: pm.last4, card_brand: pm.brand }));
  };

  const handleRemoveCard = async () => {
    try {
      await skipTraceApi.removePaymentMethod();
      setConfig(prev => ({ ...prev, stripe_payment_method_id: null, card_last_four: null, card_brand: null }));
    } catch { /* silent */ }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>Loading...</div>;

  const skipEnabled = config?.enabled || false;
  const roofEnabled = roofConfig?.roof_measurement_enabled || false;
  const hasPaymentMethod = !!config?.card_last_four;
  const skipUnbilled = Number(balance?.unbilled_records || 0);
  const roofUnbilled = Number(roofBalance?.unbilled_measurements || 0);
  const skipUnbilledCents = Number(balance?.unbilled_cents || 0);
  const roofUnbilledCents = Number(roofBalance?.unbilled_cents || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* Shared Payment Method */}
      {(skipEnabled || roofEnabled) && (
        <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Payment Method</div>
          {hasPaymentMethod ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <div style={{
                  padding: '8px 14px', borderRadius: 'var(--radius-md)',
                  background: 'oklch(0.20 0.02 260 / 0.6)', border: '1px solid var(--glass-border)',
                  fontSize: 13, fontWeight: 600,
                }}>
                  {(config.card_brand || 'Card').toUpperCase()} **** {config.card_last_four}
                </div>
              </div>
              <button onClick={handleRemoveCard} style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                background: 'oklch(0.30 0.10 25 / 0.3)', color: 'var(--accent-red)',
                border: '1px solid oklch(0.50 0.15 25 / 0.3)', cursor: 'pointer',
              }}>Remove</button>
            </div>
          ) : (
            <Elements stripe={stripePromise}>
              <AddCardForm email={user?.email} onSuccess={handlePaymentSetup} />
            </Elements>
          )}
        </div>
      )}

      {/* Skip Tracing */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Skip Tracing</div>
        <ToggleRow
          label="Enable Skip Tracing"
          description="Allow skip trace jobs to be submitted and billed to your card"
          checked={skipEnabled}
          onChange={handleSkipTraceToggle}
        />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>$0.15/record &middot; billed monthly</div>
        {skipEnabled && usage && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-blue)' }}>{usage.total_jobs || 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Jobs</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-green)' }}>{Number(usage.total_requested || 0).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Records</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-amber)' }}>${((Number(usage.total_cost_cents) || 0) / 100).toFixed(2)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Cost</div>
            </div>
          </div>
        )}
      </div>

      {/* Roof Measurement */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Roof Measurement</div>
        <ToggleRow
          label="Enable Roof Measurement"
          description="Measure roof area using Google Solar API and bill to your card"
          checked={roofEnabled}
          onChange={handleRoofToggle}
        />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>$0.10/measurement &middot; billed monthly</div>
        {roofEnabled && roofUsage && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-blue)' }}>{roofUsage.total_measurements || 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Measurements</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-amber)' }}>${((Number(roofUsage.total_cost_cents) || 0) / 100).toFixed(2)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Cost</div>
            </div>
          </div>
        )}
      </div>

      {/* Current Balance (combined) */}
      {(skipUnbilled > 0 || roofUnbilled > 0) && (
        <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Current Balance</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', fontSize: 13 }}>
            {skipUnbilled > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Skip trace: {skipUnbilled.toLocaleString()} records</span>
                <span style={{ fontWeight: 700 }}>${(skipUnbilledCents / 100).toFixed(2)}</span>
              </div>
            )}
            {roofUnbilled > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Roof measurement: {roofUnbilled.toLocaleString()} measurements</span>
                <span style={{ fontWeight: 700 }}>${(roofUnbilledCents / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Total due</span>
              <span style={{ color: 'var(--accent-amber)', fontSize: 16 }}>${((skipUnbilledCents + roofUnbilledCents) / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Billing History */}
      {invoices.length > 0 && (
        <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Billing History</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="lead-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Period</th>
                  <th>Records</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={inv.id || i}>
                    <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td>{new Date(inv.period_start).toLocaleDateString()} – {new Date(inv.period_end).toLocaleDateString()}</td>
                    <td>{inv.total_records}</td>
                    <td>${(inv.total_cents / 100).toFixed(2)}</td>
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                        color: inv.status === 'paid' ? 'var(--accent-green)' : inv.status === 'failed' ? 'var(--accent-red)' : 'var(--accent-amber)',
                      }}>
                        {inv.status}
                      </span>
                    </td>
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

function AddCardForm({ email, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError('');

    const cardElement = elements.getElement(CardElement);
    const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (stripeError) {
      setError(stripeError.message);
      setProcessing(false);
      return;
    }

    try {
      const result = await skipTraceApi.setupPayment(paymentMethod.id, email);
      onSuccess(result);
    } catch (err) {
      setError('Failed to save payment method. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{
        padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
        background: 'oklch(0.14 0.01 260 / 0.8)', border: '1px solid var(--glass-border)',
        marginBottom: 'var(--space-md)',
      }}>
        <CardElement options={{
          style: {
            base: { fontSize: '14px', color: '#e0e0e0', '::placeholder': { color: '#666' } },
            invalid: { color: '#ef4444' },
          },
        }} />
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginBottom: 'var(--space-md)' }}>{error}</div>}
      <button type="submit" disabled={!stripe || processing} style={{
        padding: '10px 24px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700,
        background: 'var(--accent-blue)', color: 'white', border: 'none', cursor: 'pointer',
        opacity: processing ? 0.6 : 1,
      }}>
        {processing ? 'Saving...' : 'Add Payment Method'}
      </button>
    </form>
  );
}

// ============================================================
// TOGGLE ROW
// ============================================================

function ToggleRow({ label, description, checked, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-xl)' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <button onClick={() => onChange(!checked)} disabled={disabled}
        style={{
          width: 44, height: 24, borderRadius: 12, padding: 2, flexShrink: 0,
          background: checked ? 'var(--accent-green)' : 'oklch(0.30 0.02 260 / 0.6)',
          border: '1px solid var(--glass-border)',
          transition: 'all 0.2s var(--ease-out)', position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        }}>
        <span style={{
          display: 'block', width: 18, height: 18, borderRadius: 9, background: 'var(--text-primary)',
          transition: 'transform 0.2s var(--ease-spring)',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
        }} />
      </button>
    </div>
  );
}
