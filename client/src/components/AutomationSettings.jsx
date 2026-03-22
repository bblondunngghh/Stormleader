import { useState, useEffect } from 'react';
import { getAutomations, createAutomation, updateAutomation, deleteAutomation, toggleAutomation, getTeamMembers } from '../api/crm';
import { showToast } from './Toast';

const STAGES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'appt_set', label: 'Appt Set' },
  { value: 'inspected', label: 'Inspected' },
  { value: 'estimate_sent', label: 'Estimate Sent' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'sold', label: 'Sold' },
  { value: 'in_production', label: 'In Production' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'lost', label: 'Lost' },
];

const TRIGGER_TYPES = [
  { value: 'stage_changed', label: 'Stage Changed' },
  { value: 'lead_created', label: 'Lead Created' },
];

const ACTION_TYPES = [
  { value: 'create_task', label: 'Create Task' },
  { value: 'change_stage', label: 'Change Stage' },
  { value: 'send_email', label: 'Send Email' },
  { value: 'notify', label: 'Notify' },
  { value: 'assign_rep', label: 'Assign Rep' },
];

const SOURCES = [
  { value: '', label: 'Any Source' },
  { value: 'storm_map', label: 'Storm Map' },
  { value: 'manual', label: 'Manual' },
  { value: 'address_search', label: 'Address Search' },
  { value: 'csv_import', label: 'CSV Import' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function triggerLabel(type) {
  return TRIGGER_TYPES.find(t => t.value === type)?.label || type;
}

function actionLabel(type) {
  return ACTION_TYPES.find(t => t.value === type)?.label || type;
}

const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

export default function AutomationSettings() {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [form, setForm] = useState(getEmptyForm());

  function getEmptyForm() {
    return {
      name: '', trigger_type: 'stage_changed', trigger_config: {},
      action_type: 'create_task', action_config: {},
    };
  }

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [autoRes, teamRes] = await Promise.all([getAutomations(), getTeamMembers()]);
      setAutomations(autoRes.data);
      setTeamMembers(teamRes.data);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleToggle(id) {
    try {
      const { data } = await toggleAutomation(id);
      setAutomations(prev => prev.map(a => a.id === id ? data : a));
    } catch { showToast('Failed to toggle', 'error'); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this automation rule?')) return;
    try {
      await deleteAutomation(id);
      setAutomations(prev => prev.filter(a => a.id !== id));
      showToast('Automation deleted');
    } catch { showToast('Failed to delete', 'error'); }
  }

  function handleEdit(auto) {
    setEditId(auto.id);
    setForm({
      name: auto.name,
      trigger_type: auto.trigger_type,
      trigger_config: auto.trigger_config || {},
      action_type: auto.action_type,
      action_config: auto.action_config || {},
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    try {
      if (editId) {
        const { data } = await updateAutomation(editId, form);
        setAutomations(prev => prev.map(a => a.id === editId ? data : a));
        showToast('Automation updated');
      } else {
        const { data } = await createAutomation(form);
        setAutomations(prev => [data, ...prev]);
        showToast('Automation created');
      }
      setShowForm(false);
      setEditId(null);
      setForm(getEmptyForm());
    } catch { showToast('Failed to save', 'error'); }
  }

  function updateTriggerConfig(key, value) {
    setForm(f => ({ ...f, trigger_config: { ...f.trigger_config, [key]: value || undefined } }));
  }

  function updateActionConfig(key, value) {
    setForm(f => ({ ...f, action_config: { ...f.action_config, [key]: value } }));
  }

  if (loading) {
    return <div style={{ padding: 'var(--space-xl)', color: 'var(--text-muted)', fontSize: 14 }}>Loading automations...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Workflow Automations</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Set up rules to automate actions when events occur
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(getEmptyForm()); }}
          style={{
            padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer', background: 'var(--accent-blue)', color: '#fff',
          }}
        >
          + New Automation
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
            {editId ? 'Edit Automation' : 'New Automation'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            {/* Name */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Rule Name</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Create follow-up task when sold" />
            </div>

            {/* Trigger Type */}
            <div>
              <label style={labelStyle}>When (Trigger)</label>
              <select className="form-input" value={form.trigger_type}
                onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value, trigger_config: {} }))}>
                {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Trigger Conditions */}
            <div>
              <label style={labelStyle}>Conditions</label>
              {form.trigger_type === 'stage_changed' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="form-input" style={{ flex: 1 }}
                    value={form.trigger_config.fromStage || ''}
                    onChange={e => updateTriggerConfig('fromStage', e.target.value)}>
                    <option value="">From: Any</option>
                    {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <select className="form-input" style={{ flex: 1 }}
                    value={form.trigger_config.toStage || ''}
                    onChange={e => updateTriggerConfig('toStage', e.target.value)}>
                    <option value="">To: Any</option>
                    {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              )}
              {form.trigger_type === 'lead_created' && (
                <select className="form-input"
                  value={form.trigger_config.source || ''}
                  onChange={e => updateTriggerConfig('source', e.target.value)}>
                  {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              )}
            </div>

            {/* Action Type */}
            <div>
              <label style={labelStyle}>Then (Action)</label>
              <select className="form-input" value={form.action_type}
                onChange={e => setForm(f => ({ ...f, action_type: e.target.value, action_config: {} }))}>
                {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Action Config */}
            <div>
              <label style={labelStyle}>Action Details</label>
              <ActionConfigFields
                actionType={form.action_type}
                config={form.action_config}
                onChange={updateActionConfig}
                teamMembers={teamMembers}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-lg)', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditId(null); }}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600,
                border: '1px solid var(--glass-border)', cursor: 'pointer',
                background: 'transparent', color: 'var(--text-muted)',
              }}>
              Cancel
            </button>
            <button onClick={handleSave}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600,
                border: 'none', cursor: 'pointer', background: 'var(--accent-blue)', color: '#fff',
              }}>
              {editId ? 'Update' : 'Create'} Rule
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {automations.length === 0 && !showForm ? (
        <div className="glass" style={{
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-2xl)',
          textAlign: 'center', color: 'var(--text-muted)', fontSize: 14,
        }}>
          No automation rules yet. Create one to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {automations.map(auto => (
            <div key={auto.id} className="glass" style={{
              borderRadius: 'var(--radius-md)', padding: 'var(--space-md) var(--space-lg)',
              display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
              opacity: auto.is_active ? 1 : 0.6,
            }}>
              {/* Toggle */}
              <button onClick={() => handleToggle(auto.id)}
                style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                  background: auto.is_active ? 'var(--accent-blue)' : 'oklch(0.30 0.02 260)',
                  position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3,
                  left: auto.is_active ? 21 : 3, transition: 'left 0.2s',
                }} />
              </button>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{auto.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  When <span style={{ color: 'var(--accent-blue)' }}>{triggerLabel(auto.trigger_type)}</span>
                  {' '}&rarr;{' '}
                  <span style={{ color: 'oklch(0.75 0.15 150)' }}>{actionLabel(auto.action_type)}</span>
                </div>
              </div>

              {/* Actions */}
              <button onClick={() => handleEdit(auto)}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--glass-border)', cursor: 'pointer',
                  background: 'transparent', color: 'var(--text-muted)',
                }}>
                Edit
              </button>
              <button onClick={() => handleDelete(auto.id)}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                  border: '1px solid oklch(0.55 0.2 25 / 0.3)', cursor: 'pointer',
                  background: 'transparent', color: 'oklch(0.70 0.18 25)',
                }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionConfigFields({ actionType, config, onChange, teamMembers }) {
  switch (actionType) {
    case 'create_task':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="form-input" placeholder="Task title" value={config.title || ''}
            onChange={e => onChange('title', e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="form-input" style={{ flex: 1 }} value={config.priority || 'medium'}
              onChange={e => onChange('priority', e.target.value)}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
              <input className="form-input" style={{ width: 60 }} type="number" min="0" placeholder="Days"
                value={config.dueDaysFromNow ?? ''} onChange={e => onChange('dueDaysFromNow', parseInt(e.target.value) || 0)} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>days out</span>
            </div>
          </div>
        </div>
      );

    case 'change_stage':
      return (
        <select className="form-input" value={config.stage || ''}
          onChange={e => onChange('stage', e.target.value)}>
          <option value="">Select stage...</option>
          {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      );

    case 'send_email':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="form-input" placeholder="Email subject" value={config.subject || ''}
            onChange={e => onChange('subject', e.target.value)} />
          <textarea className="form-input" style={{ height: 'auto', minHeight: 60, resize: 'vertical' }} placeholder="Email body"
            value={config.body || ''} onChange={e => onChange('body', e.target.value)} />
        </div>
      );

    case 'notify':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="form-input" placeholder="Notification title" value={config.title || ''}
            onChange={e => onChange('title', e.target.value)} />
          <input className="form-input" placeholder="Notification body" value={config.body || ''}
            onChange={e => onChange('body', e.target.value)} />
        </div>
      );

    case 'assign_rep':
      return (
        <select className="form-input" value={config.repId || ''}
          onChange={e => onChange('repId', e.target.value)}>
          <option value="">Select rep...</option>
          {teamMembers.map(m => (
            <option key={m.id} value={m.id}>
              {m.first_name} {m.last_name}
            </option>
          ))}
        </select>
      );

    default:
      return null;
  }
}
