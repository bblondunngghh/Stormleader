import { useState, useEffect, useCallback } from 'react';
import { getAlertConfig, updateAlertConfig, getAlertHistory, sendTestAlert } from '../api/alerts';
import { IconBell, IconMail, IconSend } from './Icons';

export default function AlertSettings() {
  const [config, setConfig] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [newEmail, setNewEmail] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [cfg, hist] = await Promise.all([
        getAlertConfig(),
        getAlertHistory({ limit: 20 }),
      ]);
      setConfig(cfg);
      setHistory(hist);
    } catch (err) {
      console.error('Failed to load alert config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const save = async (updates) => {
    setSaving(true);
    try {
      const updated = await updateAlertConfig(updates);
      setConfig(updated);
    } catch (err) {
      console.error('Failed to save alert config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (field) => {
    save({ [field]: !config[field] });
  };

  const addEmail = () => {
    const email = newEmail.trim();
    if (!email || !email.includes('@')) return;
    const updated = [...(config.email_recipients || []), email];
    save({ email_recipients: updated });
    setNewEmail('');
  };

  const removeEmail = (email) => {
    const updated = (config.email_recipients || []).filter(e => e !== email);
    save({ email_recipients: updated });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await sendTestAlert();
      setTestResult(result);
    } catch (err) {
      setTestResult({ error: err.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="main-content">
        <div className="dashboard-panel glass" style={{ padding: 'var(--space-3xl)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading alert configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content" style={{ padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconBell /> Storm Alerts
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Get notified by email when storms are detected in your service area
          </p>
        </div>
        <button
          className="glass"
          onClick={handleTest}
          disabled={testing}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: testing ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <IconSend /> {testing ? 'Sending...' : 'Send Test Alert'}
        </button>
      </div>

      {testResult && (
        <div className="glass" style={{
          padding: 'var(--space-md)',
          borderRadius: '10px',
          background: testResult.error
            ? 'oklch(0.35 0.12 25 / 0.3)'
            : 'oklch(0.35 0.12 155 / 0.3)',
          fontSize: '13px',
        }}>
          {testResult.error
            ? `Test failed: ${testResult.error}`
            : `Test sent to ${testResult.results?.length || 0} recipient(s)`
          }
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
        {/* Left column — Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {/* Master toggle */}
          <div className="dashboard-panel glass" style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Alerts Enabled</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                  Master switch for all storm notifications
                </p>
              </div>
              <ToggleSwitch checked={config?.enabled} onChange={() => handleToggle('enabled')} />
            </div>
          </div>

          {/* Email recipients */}
          <div className="dashboard-panel glass" style={{ padding: 'var(--space-lg)', opacity: config?.enabled ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconMail style={{ width: 18, height: 18 }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Email Recipients</h3>
              </div>
              <ToggleSwitch checked={config?.email_enabled} onChange={() => handleToggle('email_enabled')} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(config?.email_recipients || []).map((email) => (
                <div key={email} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', fontSize: '13px'
                }}>
                  <span>{email}</span>
                  <button onClick={() => removeEmail(email)} style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                  placeholder="Add email address"
                  style={{
                    flex: 1, padding: '8px 12px', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '13px',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  onClick={addEmail}
                  disabled={saving}
                  style={{
                    padding: '8px 16px', background: 'oklch(0.55 0.18 250)', color: 'white',
                    borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none',
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Thresholds */}
          <div className="dashboard-panel glass" style={{ padding: 'var(--space-lg)', opacity: config?.enabled ? 1 : 0.5 }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 'var(--space-md)' }}>Alert Thresholds</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: 'var(--space-md)' }}>
              Only alert when storms meet these minimum criteria
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Min Hail Size (inches)</span>
                <input
                  type="number"
                  step="0.25"
                  min="0.5"
                  max="5"
                  value={config?.min_hail_size_in ?? 1.0}
                  onChange={(e) => save({ min_hail_size_in: parseFloat(e.target.value) })}
                  style={{
                    width: '80px', padding: '6px 10px', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '13px',
                    color: 'var(--text-primary)', textAlign: 'center',
                  }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Min Wind Speed (mph)</span>
                <input
                  type="number"
                  step="5"
                  min="40"
                  max="150"
                  value={config?.min_wind_speed_mph ?? 58}
                  onChange={(e) => save({ min_wind_speed_mph: parseFloat(e.target.value) })}
                  style={{
                    width: '80px', padding: '6px 10px', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '13px',
                    color: 'var(--text-primary)', textAlign: 'center',
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right column — Alert History */}
        <div className="dashboard-panel glass" style={{ padding: 'var(--space-lg)', height: 'fit-content' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 'var(--space-md)' }}>Alert History</h3>
          {history.length === 0 ? (
            <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              <p>No alerts sent yet.</p>
              <p style={{ marginTop: '8px', fontSize: '12px' }}>
                Alerts are sent automatically when new storms are detected in your service area during scheduled ingestion runs.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.map((alert) => (
                <div key={alert.id} style={{
                  padding: '10px 12px',
                  background: 'var(--bg-elevated)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  borderLeft: `3px solid ${alert.status === 'sent' ? 'oklch(0.75 0.18 155)' : 'oklch(0.65 0.20 25)'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>
                      Email — {alert.status}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {alert.sent_at ? new Date(alert.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    To: {alert.recipient}
                    {alert.affected_properties > 0 && ` | ${alert.affected_properties} properties affected`}
                  </div>
                  {alert.subject && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                      {alert.subject}
                    </div>
                  )}
                  {alert.error_message && (
                    <div style={{ color: 'oklch(0.65 0.20 25)', fontSize: '11px', marginTop: '4px' }}>
                      Error: {alert.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        background: checked ? 'oklch(0.55 0.18 250)' : 'var(--bg-elevated)',
        border: `1px solid ${checked ? 'oklch(0.55 0.18 250)' : 'var(--border-subtle)'}`,
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: 'white',
        position: 'absolute',
        top: '2px',
        left: checked ? '22px' : '2px',
        transition: 'left 0.2s ease',
      }} />
    </button>
  );
}
