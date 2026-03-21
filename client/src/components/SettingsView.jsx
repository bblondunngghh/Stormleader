import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getAlertConfig, updateAlertConfig } from '../api/alerts';
import { getTeamMembers, updateUserRole, inviteTeamMember } from '../api/crm';
import { getPreferences, updatePreference } from '../api/notifications';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import * as skipTraceApi from '../api/skipTrace';
import * as roofMeasurementApi from '../api/roofMeasurement';
import client from '../api/client';
import * as onboardingApi from '../api/onboarding';
import * as paymentsApi from '../api/payments';
import { showToast } from './Toast';
import AutomationSettings from './AutomationSettings';
import { getCustomFieldDefinitions, createCustomField, updateCustomField, deleteCustomField } from '../api/crm';

export default function SettingsView() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const urlTab = searchParams.get('tab');
    return ['profile', 'company', 'billing', 'payments', 'team', 'alerts', 'notifications', 'financing', 'automations', 'custom-fields'].includes(urlTab) ? urlTab : 'profile';
  });

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'company', label: 'Company' },
    { id: 'billing', label: 'Billing' },
    { id: 'payments', label: 'Payments' },
    { id: 'team', label: 'Team' },
    { id: 'alerts', label: 'Storm Alerts' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'financing', label: 'Financing' },
    { id: 'automations', label: 'Automations' },
    { id: 'custom-fields', label: 'Custom Fields' },
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
      {tab === 'company' && <CompanyTab />}
      {tab === 'billing' && <BillingTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'team' && <TeamTab currentUserId={user?.id} />}
      {tab === 'alerts' && <AlertsTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'financing' && <FinancingTab />}
      {tab === 'automations' && <AutomationSettings />}
      {tab === 'custom-fields' && <CustomFieldsTab />}
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
        <strong>StormPipe</strong> — Storm damage lead management platform.<br />
        NOAA MESH ingestion, property overlay, skip trace integration, and full CRM pipeline.
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--space-md)' }}>
        v2.0.0 — Phase 2 CRM
      </div>
    </div>
  );
}

// ============================================================
// COMPANY TAB — sender email, company info
// ============================================================

function CompanyTab() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    client.get('/crm/tenant-settings')
      .then(({ data }) => setSettings(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const flash = (msg) => { setSaveMsg(msg); setTimeout(() => setSaveMsg(''), 2500); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await client.put('/crm/tenant-settings', settings);
      setSettings(prev => ({ ...prev, ...data }));
      flash('Saved');
    } catch {
      flash('Error saving');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>Loading...</div>;
  if (!settings) return <div style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>Could not load company settings.</div>;

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* Sender Email */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Sender Email</div>
          {saveMsg && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)' }}>{saveMsg}</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-md)', lineHeight: 1.5 }}>
          This email address will be used as the "from" address when sending estimates, alerts, and other emails from StormPipe on behalf of your company.
        </div>
        <div className="form-group">
          <label>From Email Address</label>
          <input
            className="form-input"
            type="email"
            placeholder="you@yourcompany.com"
            value={settings.senderEmail || ''}
            onChange={(e) => setSettings(prev => ({ ...prev, senderEmail: e.target.value }))}
          />
        </div>
      </div>

      {/* Company Details */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Company Details</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div className="form-group">
            <label>Company Name</label>
            <input className="form-input" value={settings.name || ''} disabled style={{ opacity: 0.6 }} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input
              className="form-input"
              type="tel"
              placeholder="(555) 123-4567"
              value={settings.companyPhone || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, companyPhone: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Website</label>
            <input
              className="form-input"
              type="url"
              placeholder="https://yourcompany.com"
              value={settings.companyWebsite || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, companyWebsite: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Address</label>
            <input
              className="form-input"
              placeholder="123 Main St, City, ST 12345"
              value={settings.companyAddress || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, companyAddress: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <button type="submit" disabled={saving} style={{
        padding: '12px 32px', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 700,
        background: 'var(--accent-blue)', color: 'white', border: 'none', cursor: 'pointer',
        opacity: saving ? 0.6 : 1, alignSelf: 'flex-start',
        transition: 'opacity 0.15s var(--ease-out)',
      }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}

// ============================================================
// BILLING TAB
// ============================================================

function BillingTab() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [tenantSettings, setTenantSettings] = useState(null);
  const [switching, setSwitching] = useState(null);
  const [msg, setMsg] = useState('');
  const [confirmPlan, setConfirmPlan] = useState(null); // plan key pending confirmation

  // Add-ons state
  const [config, setConfig] = useState(null);
  const [usage, setUsage] = useState(null);
  const [balance, setBalance] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [roofConfig, setRoofConfig] = useState(null);
  const [roofUsage, setRoofUsage] = useState(null);
  const [roofBalance, setRoofBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlans = Promise.all([
      onboardingApi.getPlans().then(r => r.data.plans || []),
      client.get('/crm/tenant-settings').then(r => r.data),
    ]).then(([p, s]) => { setPlans(p); setTenantSettings(s); });

    const loadSkipTrace = Promise.all([
      skipTraceApi.getConfig(),
      skipTraceApi.getUsage(),
      skipTraceApi.getBalance(),
      skipTraceApi.getInvoices(),
    ]).then(([cfg, usg, bal, inv]) => {
      setConfig(cfg); setUsage(usg); setBalance(bal); setInvoices(inv);
    }).catch(() => {});

    const loadRoof = Promise.all([
      roofMeasurementApi.getConfig(),
      roofMeasurementApi.getUsage(),
      roofMeasurementApi.getBalance(),
    ]).then(([rCfg, rUsg, rBal]) => {
      setRoofConfig(rCfg); setRoofUsage(rUsg); setRoofBalance(rBal);
    }).catch(() => {});

    Promise.allSettled([loadPlans, loadSkipTrace, loadRoof])
      .finally(() => setLoading(false));
  }, []);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleConfirmSwitch = async () => {
    if (!confirmPlan || confirmPlan === tenantSettings?.subscriptionTier) return;
    setSwitching(confirmPlan);
    setConfirmPlan(null);
    try {
      await onboardingApi.selectPlan(confirmPlan);
      setTenantSettings(prev => ({ ...prev, subscriptionTier: confirmPlan, planChangedAt: new Date().toISOString() }));
      window.dispatchEvent(new Event('plan-changed'));
      flash('Plan updated successfully');
    } catch (err) {
      flash(err.response?.data?.error || 'Could not change plan');
    } finally {
      setSwitching(null);
    }
  };

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

  const currentTier = tenantSettings?.subscriptionTier || 'starter';
  const currentPlan = plans.find(p => p.key === currentTier);
  const skipEnabled = config?.enabled || false;
  const roofEnabled = roofConfig?.roof_measurement_enabled || false;
  const hasPaymentMethod = !!config?.card_last_four;
  const skipUnbilled = Number(balance?.unbilled_records || 0);
  const roofUnbilled = Number(roofBalance?.unbilled_measurements || 0);
  const skipUnbilledCents = Number(balance?.unbilled_cents || 0);
  const roofUnbilledCents = Number(roofBalance?.unbilled_cents || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Current plan summary */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Current Plan</div>
          {msg && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)' }}>{msg}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
          <div style={{
            fontSize: 20, fontWeight: 800, color: 'var(--accent-blue)',
            textTransform: 'capitalize',
          }}>
            {currentTier}
          </div>
          {currentPlan && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              ${(currentPlan.price_cents / 100).toFixed(0)}/mo
              {' · '}{currentPlan.max_users} users
              {' · '}{currentPlan.max_leads?.toLocaleString()} leads
            </div>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              padding: '3px 8px', borderRadius: 'var(--radius-pill)',
              color: 'oklch(0.75 0.18 145)', background: 'oklch(0.75 0.18 145 / 0.12)',
              border: '1px solid oklch(0.75 0.18 145 / 0.25)',
            }}>
              {tenantSettings?.subscriptionStatus || 'active'}
            </span>
          </div>
        </div>
        {tenantSettings?.planChangedAt && (() => {
          const changedDate = new Date(tenantSettings.planChangedAt);
          const nextBilling = new Date(changedDate);
          nextBilling.setMonth(nextBilling.getMonth() + 1);
          nextBilling.setDate(1); // billing resets on the 1st of next month
          const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          return (
            <div style={{
              display: 'flex', gap: 'var(--space-xl)', marginTop: 'var(--space-md)',
              padding: 'var(--space-md) var(--space-lg)', borderRadius: 'var(--radius-md)',
              background: 'oklch(0.14 0.02 260 / 0.5)', border: '1px solid var(--glass-border)',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Switched on</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{fmt(changedDate)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Next billing</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{fmt(nextBilling)}</div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-lg)' }}>
        {plans.map(plan => {
          const isCurrent = plan.key === currentTier;
          const price = plan.price_cents === 0 ? 'Free' : `$${(plan.price_cents / 100).toFixed(0)}`;

          return (
            <div
              key={plan.key}
              className="glass"
              style={{
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-xl)',
                display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)',
                border: isCurrent ? '2px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                position: 'relative',
              }}
            >
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--accent-blue)', color: 'oklch(0.12 0.02 260)',
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: '2px 8px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap',
                }}>
                  Current Plan
                </div>
              )}

              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {plan.name}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: isCurrent ? 'var(--accent-blue)' : 'var(--text-primary)', marginTop: 4 }}>
                  {price}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>/mo</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {plan.max_users} users · {plan.max_leads?.toLocaleString()} leads
                </div>
                {plan.features?.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-xs)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0, marginTop: 2 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setConfirmPlan(plan.key)}
                disabled={isCurrent || switching === plan.key}
                style={{
                  height: 34, borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700,
                  border: 'none', cursor: isCurrent ? 'default' : 'pointer',
                  background: isCurrent ? 'oklch(0.25 0.02 260 / 0.5)' : 'var(--accent-blue)',
                  color: isCurrent ? 'var(--text-muted)' : 'oklch(0.12 0.02 260)',
                  transition: 'all 0.15s var(--ease-out)',
                  opacity: isCurrent ? 0.5 : 1,
                }}
              >
                {switching === plan.key ? 'Switching...' : isCurrent ? 'Current' : 'Switch to ' + plan.name}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Add-Ons ── */}
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 'var(--space-md)' }}>Add-Ons</div>

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

      {/* Payment Method */}
      {(skipEnabled || roofEnabled) && (
        <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Payment Method</div>
          {hasPaymentMethod ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{
                padding: '8px 14px', borderRadius: 'var(--radius-md)',
                background: 'oklch(0.20 0.02 260 / 0.6)', border: '1px solid var(--glass-border)',
                fontSize: 13, fontWeight: 600,
              }}>
                {(config.card_brand || 'Card').toUpperCase()} **** {config.card_last_four}
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

      {/* Current Balance */}
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

      {/* Plan Change Confirmation Modal — portaled to body to avoid stacking context issues */}
      {confirmPlan && (() => {
        const newPlan = plans.find(p => p.key === confirmPlan);
        const oldPlan = plans.find(p => p.key === currentTier);
        if (!newPlan) return null;

        const newPrice = newPlan.price_cents / 100;
        const oldPrice = oldPlan ? oldPlan.price_cents / 100 : 0;
        const isUpgrade = newPrice > oldPrice;
        const direction = isUpgrade ? 'Upgrade' : 'Downgrade';

        const changes = [];
        if (oldPlan) {
          if (newPlan.max_users !== oldPlan.max_users) {
            changes.push({ label: 'Users', from: oldPlan.max_users, to: newPlan.max_users, better: newPlan.max_users > oldPlan.max_users });
          }
          if (newPlan.max_leads !== oldPlan.max_leads) {
            changes.push({ label: 'Leads', from: oldPlan.max_leads?.toLocaleString(), to: newPlan.max_leads?.toLocaleString(), better: newPlan.max_leads > oldPlan.max_leads });
          }
          const oldFeatures = oldPlan.features || [];
          const newFeatures = newPlan.features || [];
          const newHasUmbrella = newFeatures.some(f => /^everything in /i.test(f));
          const gained = newFeatures.filter(f => !oldFeatures.includes(f) && !/^everything in /i.test(f));
          const lost = oldFeatures.filter(f => !newFeatures.includes(f) && !(newHasUmbrella));
          if (gained.length) changes.push({ label: 'New features', list: gained, better: true });
          if (lost.length) changes.push({ label: 'Removed features', list: lost, better: false });
        }

        return createPortal(
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(8px)',
            }}
            onClick={() => setConfirmPlan(null)}
          >
            <div
              className="glass"
              style={{
                width: '100%', maxWidth: 460, borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-2xl)', display: 'flex', flexDirection: 'column',
                gap: 'var(--space-lg)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                  padding: '3px 8px', borderRadius: 'var(--radius-pill)',
                  color: isUpgrade ? 'oklch(0.75 0.18 145)' : 'oklch(0.72 0.18 50)',
                  background: isUpgrade ? 'oklch(0.75 0.18 145 / 0.12)' : 'oklch(0.72 0.18 50 / 0.12)',
                }}>
                  {direction}
                </span>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Change Plan</div>
              </div>

              {/* From → To */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-lg)',
                padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)',
                background: 'oklch(0.14 0.02 260 / 0.6)', border: '1px solid var(--glass-border)',
              }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Current</div>
                  <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'capitalize' }}>{oldPlan?.name || currentTier}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>${oldPrice}/mo</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>New</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'capitalize' }}>{newPlan.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>${newPrice}/mo</div>
                </div>
              </div>

              {/* What changes */}
              {changes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    What changes
                  </div>
                  {changes.map((c, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
                      <span style={{ color: c.better ? 'var(--accent-green)' : 'oklch(0.72 0.18 50)', flexShrink: 0, marginTop: 1 }}>
                        {c.better ? '▲' : '▼'}
                      </span>
                      {c.list ? (
                        <span><strong>{c.label}:</strong> {c.list.join(', ')}</span>
                      ) : (
                        <span><strong>{c.label}:</strong> {c.from} → {c.to}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!isUpgrade && (
                <div style={{
                  fontSize: 12, color: 'oklch(0.72 0.18 50)', lineHeight: 1.5,
                  padding: 'var(--space-md) var(--space-lg)', borderRadius: 'var(--radius-md)',
                  background: 'oklch(0.72 0.18 50 / 0.06)', border: '1px solid oklch(0.72 0.18 50 / 0.2)',
                }}>
                  Downgrading may limit your access to features, users, or leads. If you exceed the new plan's limits, you won't be able to add more until usage is within bounds.
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
                <button
                  onClick={() => setConfirmPlan(null)}
                  style={{
                    flex: 1, height: 40, borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700,
                    background: 'oklch(0.22 0.02 260 / 0.6)', color: 'var(--text-secondary)',
                    border: '1px solid var(--glass-border)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSwitch}
                  style={{
                    flex: 1, height: 40, borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700,
                    background: isUpgrade ? 'var(--accent-blue)' : 'oklch(0.72 0.18 50)',
                    color: 'oklch(0.12 0.02 260)',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  Confirm {direction}
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}

// ============================================================
// PAYMENTS TAB — Stripe Connect onboarding + payment history
// ============================================================

function PaymentsTab() {
  const [connectStatus, setConnectStatus] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    loadData();
  }, []);

  // Handle return from Stripe onboarding
  useEffect(() => {
    const stripeParam = searchParams.get('stripe');
    if (stripeParam === 'complete') {
      loadData();
      showToast('Checking Stripe connection status...', 'info');
    } else if (stripeParam === 'refresh') {
      showToast('Onboarding link expired. Click below to continue.', 'warning');
    }
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusRes, historyRes] = await Promise.allSettled([
        paymentsApi.getConnectStatus(),
        paymentsApi.getPaymentHistory({ limit: 20 }),
      ]);
      if (statusRes.status === 'fulfilled') setConnectStatus(statusRes.value.data);
      if (historyRes.status === 'fulfilled') {
        setPayments(historyRes.value.data.payments || []);
        setPaymentsTotal(historyRes.value.data.total || 0);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleOnboard = async () => {
    setOnboarding(true);
    try {
      const res = await paymentsApi.startOnboarding();
      if (res.data.url) {
        window.open(res.data.url, '_blank');
        showToast('Stripe onboarding opened in a new tab', 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to start Stripe onboarding', 'error');
    }
    setOnboarding(false);
  };

  const handleRefreshLink = async () => {
    setOnboarding(true);
    try {
      const res = await paymentsApi.refreshOnboarding();
      if (res.data.url) {
        window.open(res.data.url, '_blank');
        showToast('New onboarding link opened', 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to refresh link', 'error');
    }
    setOnboarding(false);
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>Loading...</div>;

  const isConnected = connectStatus?.onboardingComplete;
  const isPartial = connectStatus?.connected && !connectStatus?.onboardingComplete;

  const statusColor = isConnected ? 'oklch(0.75 0.18 145)' : isPartial ? 'oklch(0.78 0.15 85)' : 'oklch(0.65 0.15 25)';
  const statusLabel = isConnected ? 'Connected' : isPartial ? 'Incomplete' : 'Not Connected';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Stripe Connection Status */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Stripe Connect</div>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            padding: '3px 10px', borderRadius: 'var(--radius-pill)',
            color: statusColor, background: `${statusColor} / 0.12`.replace(')', ' / 0.12)').replace('oklch', 'oklch'),
            border: `1px solid ${statusColor}`,
          }}>
            {statusLabel}
          </span>
        </div>

        {isConnected ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'oklch(0.75 0.18 145 / 0.15)', border: '1px solid oklch(0.75 0.18 145 / 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="oklch(0.75 0.18 145)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.75 0.18 145)' }}>Stripe Connected</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Charges and payouts are enabled for your account
                </div>
              </div>
            </div>
            {connectStatus?.accountId && (
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                Account: {connectStatus.accountId}
              </div>
            )}
          </div>
        ) : isPartial ? (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
              Your Stripe account has been created but onboarding is not complete.
              Please finish the setup to start accepting payments.
            </div>
            <button onClick={handleRefreshLink} disabled={onboarding} className="auth-btn"
              style={{ width: 'auto', padding: '10px 24px', fontSize: 13 }}>
              {onboarding ? 'Opening...' : 'Continue Stripe Setup'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
              Connect your Stripe account to accept credit card and ACH payments directly from your estimates.
              Funds are deposited into your own Stripe account with no delays.
            </div>
            <button onClick={handleOnboard} disabled={onboarding} className="auth-btn"
              style={{
                width: 'auto', padding: '12px 28px', fontSize: 14, fontWeight: 700,
                background: 'oklch(0.55 0.15 270)', display: 'flex', alignItems: 'center', gap: 8,
              }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              {onboarding ? 'Opening Stripe...' : 'Connect with Stripe'}
            </button>
          </div>
        )}
      </div>

      {/* Fee Structure */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Processing Fees</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
          <div style={{
            padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)',
            background: 'oklch(0.14 0.02 260 / 0.5)', border: '1px solid var(--glass-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-md)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(0.70 0.15 250)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.70 0.15 250)' }}>Credit Card</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>2.9% + $0.25</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Per transaction</div>
          </div>
          <div style={{
            padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)',
            background: 'oklch(0.14 0.02 260 / 0.5)', border: '1px solid var(--glass-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-md)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="oklch(0.75 0.18 145)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.75 0.18 145)' }}>ACH / Bank Transfer</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>0.8%</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Capped at $25 per transaction</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--space-md)', lineHeight: 1.5 }}>
          Fees are automatically calculated and deducted from each payment. The remaining amount is deposited directly to your Stripe account.
        </div>
      </div>

      {/* Payment History */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Payment History</div>
          {paymentsTotal > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {paymentsTotal} total payment{paymentsTotal !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {payments.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 'var(--space-xl) 0', textAlign: 'center' }}>
            No payments yet. Payments will appear here once customers pay your estimates.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Estimate</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Amount</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Fee</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>Method</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => {
                  const statusColors = {
                    succeeded: 'oklch(0.75 0.18 145)',
                    pending: 'oklch(0.78 0.15 85)',
                    failed: 'oklch(0.65 0.18 25)',
                    refunded: 'oklch(0.65 0.10 260)',
                  };
                  const sc = statusColors[p.status] || 'var(--text-muted)';
                  return (
                    <tr key={p.id} style={{ background: 'oklch(0.14 0.02 260 / 0.3)', borderRadius: 'var(--radius-sm)' }}>
                      <td style={{ padding: '10px 12px', borderRadius: '8px 0 0 8px' }}>
                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {p.customer_name || p.customer_email || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11 }}>
                        {p.estimate_number || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                        ${(p.amount / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>
                        ${(p.application_fee / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', textTransform: 'uppercase', fontSize: 10, fontWeight: 600 }}>
                        {p.payment_method}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderRadius: '0 8px 8px 0' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                          padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                          color: sc, background: `${sc.replace(')', ' / 0.12)')}`,
                          border: `1px solid ${sc.replace(')', ' / 0.25)')}`,
                        }}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'sales_rep' });
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

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

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    setInviteMsg('');
    try {
      const res = await inviteTeamMember(inviteForm);
      setMembers(prev => [...prev, res.data.member]);
      setInviteForm({ firstName: '', lastName: '', email: '', password: '', role: 'sales_rep' });
      setShowInvite(false);
      setInviteMsg('Team member added successfully');
      setTimeout(() => setInviteMsg(''), 3000);
    } catch (err) {
      setInviteMsg(err.response?.data?.error || 'Failed to add team member');
    } finally {
      setInviting(false);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>Loading team...</div>;

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{members.length} team member{members.length !== 1 ? 's' : ''}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          {inviteMsg && (
            <span style={{ fontSize: 12, fontWeight: 600, color: inviteMsg.includes('success') ? 'var(--accent-green)' : 'oklch(0.72 0.18 50)' }}>
              {inviteMsg}
            </span>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowInvite(!showInvite)}
              style={{
                height: 34, padding: '0 16px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700,
                background: 'var(--accent-blue)', color: 'oklch(0.12 0.02 260)',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Member
            </button>
          )}
        </div>
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="glass" style={{
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-md)',
          border: '1px solid var(--accent-blue)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 'var(--space-xs)' }}>Add Team Member</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>First Name</label>
              <input className="form-input" required value={inviteForm.firstName}
                onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))}
                style={{ width: '100%', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Last Name</label>
              <input className="form-input" required value={inviteForm.lastName}
                onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))}
                style={{ width: '100%', fontSize: 13 }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Email</label>
            <input className="form-input" type="email" required value={inviteForm.email}
              onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              style={{ width: '100%', fontSize: 13 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Temporary Password</label>
              <input className="form-input" type="password" required minLength={8} value={inviteForm.password}
                onChange={e => setInviteForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 characters"
                style={{ width: '100%', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Role</label>
              <select className="form-input" value={inviteForm.role}
                onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                style={{ width: '100%', fontSize: 13 }}>
                <option value="sales_rep">Sales Rep</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end', marginTop: 'var(--space-xs)' }}>
            <button type="button" onClick={() => setShowInvite(false)}
              style={{
                height: 34, padding: '0 16px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 600,
                background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--glass-border)', cursor: 'pointer',
              }}>
              Cancel
            </button>
            <button type="submit" disabled={inviting}
              style={{
                height: 34, padding: '0 20px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700,
                background: 'var(--accent-blue)', color: 'oklch(0.12 0.02 260)',
                border: 'none', cursor: 'pointer', opacity: inviting ? 0.6 : 1,
              }}>
              {inviting ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      )}

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
    lead_status_changed: 'Lead Status Changed',
    task_due_soon: 'Task Due Soon',
    task_overdue: 'Task Overdue',
    estimate_viewed: 'Estimate Viewed',
    estimate_accepted: 'Estimate Accepted',
    estimate_declined: 'Estimate Declined',
    storm_alert: 'Storm Alert',
    new_storm_leads: 'New Storm Leads',
    mention: 'Mentioned in Note',
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

// ============================================================
// FINANCING TAB
// ============================================================

function FinancingTab() {
  const [lender, setLender] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ provider: 'mock', apiKey: '', merchantId: '' });
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: lenders } = await client.get('/crm/financing/lenders');
        const active = lenders.find(l => l.is_active);
        if (active) {
          setLender(active);
          const { data } = await client.get('/crm/financing/plans', { params: { lenderId: active.id } });
          setPlans(data);
        }
      } catch (err) {
        console.error('Failed to load financing config:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleConnect(e) {
    e.preventDefault();
    setConnecting(true);
    setError('');
    try {
      const { data } = await client.post('/crm/financing/lenders', {
        provider: form.provider,
        apiKey: form.apiKey,
        merchantId: form.merchantId,
      });
      setLender(data);
      setForm({ apiKey: '', merchantId: '' });
      // Auto-sync plans
      setSyncing(true);
      const { data: synced } = await client.post('/crm/financing/plans/sync', { lenderId: data.id });
      setPlans(synced);
      showToast('Hearth connected and plans synced');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect');
    } finally {
      setConnecting(false);
      setSyncing(false);
    }
  }

  async function handleSync() {
    if (!lender) return;
    setSyncing(true);
    try {
      const { data } = await client.post('/crm/financing/plans/sync', { lenderId: lender.id });
      setPlans(data);
      showToast('Plans synced from Hearth');
    } catch (err) {
      showToast('Failed to sync plans');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!lender) return;
    try {
      await client.delete(`/crm/financing/lenders/${lender.id}`);
      setLender(null);
      setPlans([]);
      showToast('Hearth disconnected');
    } catch (err) {
      showToast('Failed to disconnect');
    }
  }

  async function togglePlan(planId, field, value) {
    try {
      const { data } = await client.patch(`/crm/financing/plans/${planId}`, { [field]: value });
      setPlans(prev => prev.map(p => p.id === planId ? data : p));
    } catch (err) {
      showToast('Failed to update plan');
    }
  }

  if (loading) return <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Financing</span>
        {lender && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
            color: lender.is_active ? 'oklch(0.75 0.18 145)' : 'oklch(0.65 0.18 25)',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: lender.is_active ? 'oklch(0.65 0.2 145)' : 'oklch(0.55 0.2 25)',
            }} />
            {lender.is_active ? 'Connected' : 'Disconnected'}
          </span>
        )}
      </div>

      {!lender ? (
        <form onSubmit={handleConnect}>
          <div style={{ marginBottom: 'var(--space-md)', fontSize: 13, color: 'var(--text-muted)' }}>
            Connect a financing provider to offer financing options on estimates.
          </div>
          <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Provider</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ id: 'mock', label: 'Mock (Testing)' }, { id: 'hearth', label: 'Hearth' }].map(p => (
                <button key={p.id} type="button" onClick={() => setForm(f => ({ ...f, provider: p.id }))}
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: form.provider === p.id ? '1.5px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                    background: form.provider === p.id ? 'oklch(0.25 0.05 250 / 0.5)' : 'transparent',
                    color: form.provider === p.id ? 'var(--accent-blue)' : 'var(--text-muted)',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {error && <div style={{ color: 'oklch(0.7 0.2 25)', fontSize: 13, marginBottom: 'var(--space-md)' }}>{error}</div>}
          <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>API Key</label>
            <input type="password" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
              placeholder="Enter your Hearth API key"
              style={{ width: '100%', padding: '10px 12px', background: 'oklch(0.18 0.02 260 / 0.5)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13 }} />
          </div>
          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Merchant ID</label>
            <input type="text" value={form.merchantId} onChange={e => setForm(f => ({ ...f, merchantId: e.target.value }))}
              placeholder="Enter your Hearth merchant ID"
              style={{ width: '100%', padding: '10px 12px', background: 'oklch(0.18 0.02 260 / 0.5)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13 }} />
          </div>
          <button type="submit" disabled={connecting || !form.apiKey || !form.merchantId}
            style={{
              padding: '10px 24px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
              background: 'var(--accent-blue)', color: '#fff', fontWeight: 600, fontSize: 13,
              opacity: connecting || !form.apiKey || !form.merchantId ? 0.5 : 1,
            }}>
            {connecting ? 'Connecting...' : `Connect ${form.provider === 'mock' ? 'Mock Provider' : 'Hearth'}`}
          </button>
        </form>
      ) : (
        <>
          {/* Plan Management */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Financing Plans ({plans.length})
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button onClick={handleSync} disabled={syncing}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)',
                  background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  opacity: syncing ? 0.5 : 1,
                }}>
                {syncing ? 'Syncing...' : 'Sync Plans'}
              </button>
              <button onClick={handleDisconnect}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid oklch(0.5 0.15 25 / 0.3)',
                  background: 'transparent', color: 'oklch(0.7 0.18 25)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                Disconnect
              </button>
            </div>
          </div>

          {plans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)', fontSize: 13 }}>
              No plans found. Click &quot;Sync Plans&quot; to fetch from Hearth.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* Header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 70px 80px 70px 70px',
                gap: 'var(--space-sm)', padding: '8px 12px', fontSize: 11, fontWeight: 700,
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <span>Plan</span>
                <span>Term</span>
                <span>APR</span>
                <span>Dealer Fee</span>
                <span style={{ textAlign: 'center' }}>Active</span>
                <span style={{ textAlign: 'center' }}>Default</span>
              </div>
              {plans.map(plan => (
                <div key={plan.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 80px 70px 80px 70px 70px',
                  gap: 'var(--space-sm)', padding: '10px 12px', fontSize: 13,
                  background: 'oklch(0.18 0.02 260 / 0.3)', borderRadius: 'var(--radius-sm)',
                  color: plan.is_active ? 'var(--text-primary)' : 'var(--text-muted)',
                }}>
                  <span style={{ fontWeight: 600 }}>{plan.name}</span>
                  <span>{plan.term_months}mo</span>
                  <span>{Number(plan.apr).toFixed(2)}%</span>
                  <span>{Number(plan.dealer_fee_pct).toFixed(1)}%</span>
                  <span style={{ textAlign: 'center' }}>
                    <button onClick={() => togglePlan(plan.id, 'isActive', !plan.is_active)}
                      style={{
                        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative',
                        background: plan.is_active ? 'oklch(0.55 0.18 145)' : 'oklch(0.3 0.02 260)',
                        transition: 'background 0.15s',
                      }}>
                      <span style={{
                        position: 'absolute', top: 2, left: plan.is_active ? 18 : 2,
                        width: 16, height: 16, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.15s',
                      }} />
                    </button>
                  </span>
                  <span style={{ textAlign: 'center' }}>
                    <button onClick={() => togglePlan(plan.id, 'isDefault', !plan.is_default)}
                      style={{
                        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative',
                        background: plan.is_default ? 'oklch(0.55 0.18 250)' : 'oklch(0.3 0.02 260)',
                        transition: 'background 0.15s',
                      }}>
                      <span style={{
                        position: 'absolute', top: 2, left: plan.is_default ? 18 : 2,
                        width: 16, height: 16, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.15s',
                      }} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// CUSTOM FIELDS TAB
// ============================================================

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'boolean', label: 'Yes / No' },
];

const TYPE_BADGE_COLORS = {
  text: { bg: 'oklch(0.35 0.08 250 / 0.5)', fg: 'oklch(0.75 0.1 250)' },
  number: { bg: 'oklch(0.35 0.08 145 / 0.5)', fg: 'oklch(0.75 0.1 145)' },
  date: { bg: 'oklch(0.35 0.08 85 / 0.5)', fg: 'oklch(0.75 0.1 85)' },
  select: { bg: 'oklch(0.35 0.08 310 / 0.5)', fg: 'oklch(0.75 0.1 310)' },
  boolean: { bg: 'oklch(0.35 0.08 25 / 0.5)', fg: 'oklch(0.75 0.1 25)' },
};

function CustomFieldsTab() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ field_label: '', field_key: '', field_type: 'text', options: [], is_required: false, sort_order: 0 });
  const [newOption, setNewOption] = useState('');

  useEffect(() => {
    loadFields();
  }, []);

  async function loadFields() {
    try {
      const { data } = await getCustomFieldDefinitions('lead');
      setFields(data);
    } catch (err) {
      console.error('Failed to load custom fields:', err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ field_label: '', field_key: '', field_type: 'text', options: [], is_required: false, sort_order: 0 });
    setNewOption('');
    setShowForm(false);
    setEditingId(null);
  }

  function slugify(label) {
    return label.toLowerCase().replace(/[^a-z0-9\s_]/g, '').replace(/\s+/g, '_').substring(0, 50);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.field_label.trim()) return;
    setSaving(true);
    try {
      const payload = {
        field_label: form.field_label.trim(),
        field_key: form.field_key || slugify(form.field_label),
        field_type: form.field_type,
        options: form.field_type === 'select' ? form.options : null,
        is_required: form.is_required,
        sort_order: form.sort_order,
      };
      if (editingId) {
        await updateCustomField(editingId, payload);
        showToast('Field updated');
      } else {
        await createCustomField(payload);
        showToast('Field created');
      }
      await loadFields();
      resetForm();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save field', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteCustomField(id);
      showToast('Field deleted');
      setConfirmDelete(null);
      await loadFields();
    } catch (err) {
      showToast('Failed to delete field', 'error');
    }
  }

  function startEdit(field) {
    setForm({
      field_label: field.field_label,
      field_key: field.field_key,
      field_type: field.field_type,
      options: field.options || [],
      is_required: field.is_required,
      sort_order: field.sort_order || 0,
    });
    setEditingId(field.id);
    setShowForm(true);
  }

  function addOption() {
    if (!newOption.trim()) return;
    setForm(f => ({ ...f, options: [...f.options, newOption.trim()] }));
    setNewOption('');
  }

  function removeOption(idx) {
    setForm(f => ({ ...f, options: f.options.filter((_, i) => i !== idx) }));
  }

  const inputStyle = {
    background: 'oklch(0.18 0.02 260 / 0.6)', color: 'var(--text-primary)',
    border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)',
    padding: '8px 12px', fontSize: 13, width: '100%',
  };

  if (loading) {
    return (
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Custom Fields</div>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true); }}
            style={{
              padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
              background: 'var(--accent-blue)', color: '#fff', fontSize: 13, fontWeight: 600,
            }}>
            + Add Field
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <form onSubmit={handleSave} style={{
          padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)',
          background: 'oklch(0.16 0.02 260 / 0.4)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--glass-border)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-md)' }}>
            {editingId ? 'Edit Field' : 'New Field'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Label</label>
              <input value={form.field_label} onChange={e => {
                const label = e.target.value;
                setForm(f => ({ ...f, field_label: label, field_key: editingId ? f.field_key : slugify(label) }));
              }} style={inputStyle} placeholder="e.g. Deductible Amount" required />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Key</label>
              <input value={form.field_key} readOnly={!!editingId}
                onChange={e => !editingId && setForm(f => ({ ...f, field_key: e.target.value }))}
                style={{ ...inputStyle, opacity: editingId ? 0.5 : 1 }} placeholder="auto-generated" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Type</label>
              <select value={form.field_type} onChange={e => setForm(f => ({ ...f, field_type: e.target.value }))}
                style={inputStyle}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', paddingTop: 20 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <button type="button" onClick={() => setForm(f => ({ ...f, is_required: !f.is_required }))}
                  style={{
                    width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative',
                    background: form.is_required ? 'oklch(0.55 0.18 145)' : 'oklch(0.3 0.02 260)',
                    transition: 'background 0.15s',
                  }}>
                  <span style={{
                    position: 'absolute', top: 2, left: form.is_required ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.15s',
                  }} />
                </button>
                Required
              </label>
            </div>
          </div>

          {/* Options list for select type */}
          {form.field_type === 'select' && (
            <div style={{ marginTop: 'var(--space-md)' }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Options</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {form.options.map((opt, idx) => (
                  <span key={idx} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                    background: 'oklch(0.25 0.03 260)', fontSize: 12, color: 'var(--text-secondary)',
                  }}>
                    {opt}
                    <button type="button" onClick={() => removeOption(idx)}
                      style={{ background: 'none', border: 'none', color: 'oklch(0.6 0.15 25)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>
                      x
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newOption} onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                  style={{ ...inputStyle, flex: 1 }} placeholder="Add option..." />
                <button type="button" onClick={addOption}
                  style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'oklch(0.3 0.04 260)', color: 'var(--text-secondary)', fontSize: 13 }}>
                  Add
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-lg)', justifyContent: 'flex-end' }}>
            <button type="button" onClick={resetForm}
              style={{ padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13 }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'var(--accent-blue)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {/* Field List */}
      {fields.length === 0 && !showForm ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 'var(--space-lg) 0', textAlign: 'center' }}>
          No custom fields defined yet. Click "Add Field" to create one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {fields.map(field => (
            <div key={field.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
              padding: 'var(--space-md) var(--space-lg)',
              background: 'oklch(0.16 0.02 260 / 0.3)', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--glass-border)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {field.field_label}
                  {field.is_required && <span style={{ color: 'oklch(0.7 0.2 25)', marginLeft: 4, fontSize: 12 }}>required</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                  {field.field_key}
                  {field.field_type === 'select' && field.options?.length > 0 && (
                    <span> ({field.options.join(', ')})</span>
                  )}
                </div>
              </div>
              <span style={{
                padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                background: (TYPE_BADGE_COLORS[field.field_type] || TYPE_BADGE_COLORS.text).bg,
                color: (TYPE_BADGE_COLORS[field.field_type] || TYPE_BADGE_COLORS.text).fg,
              }}>
                {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
              </span>
              <button onClick={() => startEdit(field)}
                style={{ padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12 }}>
                Edit
              </button>
              {confirmDelete === field.id ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => handleDelete(field.id)}
                    style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'oklch(0.45 0.18 25)', color: '#fff', fontSize: 12 }}>
                    Confirm
                  </button>
                  <button onClick={() => setConfirmDelete(null)}
                    style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', fontSize: 12 }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(field.id)}
                  style={{ padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'oklch(0.25 0.08 25 / 0.4)', color: 'oklch(0.7 0.15 25)', fontSize: 12 }}>
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
