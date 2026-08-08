import { useState, useEffect, useCallback } from 'react';
import { ArrowUpIcon, ArrowDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  getDripSequences,
  getDripSequence,
  createDripSequence,
  updateDripSequence,
  deleteDripSequence,
  getSequenceEnrollments,
  cancelSequenceEnrollment,
} from '../api/crm';
import { showToast } from './Toast';
import CustomSelect from './CustomSelect';

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
  { value: 'estimate_sent', label: 'Estimate Sent' },
  { value: 'lead_created', label: 'Lead Created' },
  { value: 'stage_changed', label: 'Stage Changed' },
];

const STEP_ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email' },
  { value: 'create_task', label: 'Create Task' },
  { value: 'notify', label: 'Notify Team' },
];

const SOURCES = [
  { value: '', label: 'Any Source' },
  { value: 'storm_map', label: 'Storm Map' },
  { value: 'manual', label: 'Manual' },
  { value: 'address_search', label: 'Address Search' },
  { value: 'csv_import', label: 'CSV Import' },
];

const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' };

function triggerLabel(type) {
  return TRIGGER_TYPES.find(t => t.value === type)?.label || type;
}

function getEmptyStep() {
  return { delay_days: 3, action_type: 'send_email', action_config: {} };
}

function getEmptyForm() {
  return {
    name: '',
    trigger_type: 'estimate_sent',
    trigger_config: {},
    steps: [getEmptyStep()],
  };
}

export default function DripSequences() {
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(getEmptyForm());
  const [expandedId, setExpandedId] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await getDripSequences();
      setSequences(data);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleToggle(seq) {
    try {
      const { data } = await updateDripSequence(seq.id, { is_active: !seq.is_active });
      setSequences(prev => prev.map(s => s.id === seq.id ? { ...s, ...data } : s));
    } catch { showToast('Failed to toggle', 'error'); }
  }

  async function handleDelete(id) {
    setDeleteConfirm(id);
  }

  async function confirmDelete() {
    const id = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await deleteDripSequence(id);
      setSequences(prev => prev.filter(s => s.id !== id));
      if (expandedId === id) setExpandedId(null);
      showToast('Sequence deleted');
    } catch { showToast('Failed to delete', 'error'); }
  }

  async function handleEdit(seq) {
    try {
      const { data } = await getDripSequence(seq.id);
      setEditId(data.id);
      setForm({
        name: data.name,
        trigger_type: data.trigger_type,
        trigger_config: data.trigger_config || {},
        steps: data.steps?.length ? data.steps.map(s => ({
          delay_days: s.delay_days,
          action_type: s.action_type,
          action_config: s.action_config || {},
        })) : [getEmptyStep()],
      });
      setShowForm(true);
    } catch { showToast('Failed to load sequence', 'error'); }
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    if (!form.steps.length) { showToast('At least one step is required', 'error'); return; }

    try {
      if (editId) {
        const { data } = await updateDripSequence(editId, form);
        setSequences(prev => prev.map(s => s.id === editId ? { ...s, ...data } : s));
        showToast('Sequence updated');
      } else {
        const { data } = await createDripSequence(form);
        setSequences(prev => [data, ...prev]);
        showToast('Sequence created');
      }
      setShowForm(false);
      setEditId(null);
      setForm(getEmptyForm());
      load(); // refresh step counts
    } catch { showToast('Failed to save', 'error'); }
  }

  async function toggleEnrollments(seqId) {
    if (expandedId === seqId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(seqId);
    setEnrollmentsLoading(true);
    try {
      const { data } = await getSequenceEnrollments(seqId);
      setEnrollments(data);
    } catch { setEnrollments([]); }
    setEnrollmentsLoading(false);
  }

  async function handleCancelEnrollment(seqId, leadId) {
    try {
      await cancelSequenceEnrollment(seqId, leadId);
      setEnrollments(prev => prev.map(e =>
        e.lead_id === leadId ? { ...e, status: 'cancelled' } : e
      ));
      showToast('Enrollment cancelled');
    } catch { showToast('Failed to cancel', 'error'); }
  }

  function updateStep(idx, key, value) {
    setForm(f => ({
      ...f,
      steps: f.steps.map((s, i) => i === idx ? { ...s, [key]: value } : s),
    }));
  }

  function updateStepConfig(idx, key, value) {
    setForm(f => ({
      ...f,
      steps: f.steps.map((s, i) => i === idx ? { ...s, action_config: { ...s.action_config, [key]: value } } : s),
    }));
  }

  function addStep() {
    setForm(f => ({ ...f, steps: [...f.steps, getEmptyStep()] }));
  }

  function removeStep(idx) {
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }));
  }

  function moveStep(idx, dir) {
    setForm(f => {
      const steps = [...f.steps];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= steps.length) return f;
      [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
      return { ...f, steps };
    });
  }

  if (loading) {
    return <div style={{ padding: 'var(--space-xl)', color: 'var(--text-muted)', fontSize: 14 }}>Loading drip sequences...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Drip Sequences</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Automated multi-step follow-up sequences for leads
          </div>
        </div>
        <button
          className="auth-btn"
          onClick={() => { setShowForm(true); setEditId(null); setForm(getEmptyForm()); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <PlusIcon style={{ width: 14, height: 14 }} /> New Sequence
        </button>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
            {editId ? 'Edit Sequence' : 'New Drip Sequence'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            {/* Name */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Sequence Name</label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Estimate Follow-up Series"
              />
            </div>

            {/* Trigger Type */}
            <div>
              <label style={labelStyle}>Trigger (When to start)</label>
              <CustomSelect
                value={form.trigger_type}
                onChange={v => setForm(f => ({ ...f, trigger_type: v, trigger_config: {} }))}
                options={TRIGGER_TYPES}
              />
            </div>

            {/* Trigger Conditions */}
            <div>
              <label style={labelStyle}>Conditions</label>
              {form.trigger_type === 'stage_changed' && (
                <CustomSelect
                  value={form.trigger_config.toStage || ''}
                  onChange={v => setForm(f => ({ ...f, trigger_config: { ...f.trigger_config, toStage: v || undefined } }))}
                  options={[{ value: '', label: 'To: Any Stage' }, ...STAGES]}
                />
              )}
              {form.trigger_type === 'lead_created' && (
                <CustomSelect
                  value={form.trigger_config.source || ''}
                  onChange={v => setForm(f => ({ ...f, trigger_config: { ...f.trigger_config, source: v || undefined } }))}
                  options={SOURCES}
                />
              )}
              {form.trigger_type === 'estimate_sent' && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
                  Starts when any estimate is sent to a lead
                </div>
              )}
            </div>
          </div>

          {/* Steps */}
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <label style={{ ...labelStyle, marginBottom: 'var(--space-sm)' }}>
              Steps ({form.steps.length})
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {form.steps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'oklch(0.16 0.02 260 / 0.5)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--glass-border)',
                    padding: 'var(--space-md)',
                  }}
                >
                  {/* Step header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--accent-blue)', color: 'oklch(1 0 0)', fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                      Step {idx + 1}
                    </span>

                    {/* Reorder buttons */}
                    <button
                      onClick={() => moveStep(idx, -1)}
                      disabled={idx === 0}
                      style={{
                        padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 14,
                        border: '1px solid var(--glass-border)', cursor: idx === 0 ? 'default' : 'pointer',
                        background: 'transparent', color: 'var(--text-muted)', opacity: idx === 0 ? 0.3 : 1,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      title="Move step up"
                    >
                      <ArrowUpIcon style={{ width: 14, height: 14, strokeWidth: 2 }} />
                    </button>
                    <button
                      onClick={() => moveStep(idx, 1)}
                      disabled={idx === form.steps.length - 1}
                      style={{
                        padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 14,
                        border: '1px solid var(--glass-border)', cursor: idx === form.steps.length - 1 ? 'default' : 'pointer',
                        background: 'transparent', color: 'var(--text-muted)', opacity: idx === form.steps.length - 1 ? 0.3 : 1,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      title="Move step down"
                    >
                      <ArrowDownIcon style={{ width: 14, height: 14, strokeWidth: 2 }} />
                    </button>

                    {form.steps.length > 1 && (
                      <button
                        onClick={() => removeStep(idx)}
                        style={{
                          padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                          border: '1px solid oklch(0.55 0.2 25 / 0.3)', cursor: 'pointer',
                          background: 'transparent', color: 'oklch(0.70 0.18 25)',
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Step config */}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 'var(--space-sm)' }}>
                    {/* Delay */}
                    <div>
                      <label style={labelStyle}>Delay</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          className="form-input"
                          type="number"
                          min="1"
                          value={step.delay_days}
                          onChange={e => updateStep(idx, 'delay_days', Math.max(1, parseInt(e.target.value) || 1))}
                          style={{ width: 60 }}
                        />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {idx === 0 ? 'days after trigger' : 'days after prev'}
                        </span>
                      </div>
                    </div>

                    {/* Action type + config */}
                    <div>
                      <label style={labelStyle}>Action</label>
                      <CustomSelect
                        value={step.action_type}
                        onChange={v => updateStep(idx, 'action_type', v)}
                        options={STEP_ACTION_TYPES}
                      />

                      {/* Action-specific fields */}
                      <div style={{ marginTop: 'var(--space-sm)' }}>
                        <StepActionConfig
                          actionType={step.action_type}
                          config={step.action_config}
                          onChange={(key, val) => updateStepConfig(idx, key, val)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addStep}
              style={{
                marginTop: 'var(--space-sm)', padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                fontSize: 13, fontWeight: 600, border: '1px dashed var(--glass-border)', cursor: 'pointer',
                background: 'transparent', color: 'var(--text-muted)', width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <PlusIcon style={{ width: 14, height: 14 }} /> Add Step
            </button>
          </div>

          {/* Save / Cancel */}
          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-lg)', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setShowForm(false); setEditId(null); }}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600,
                border: '1px solid var(--glass-border)', cursor: 'pointer',
                background: 'transparent', color: 'var(--text-muted)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600,
                border: 'none', cursor: 'pointer', background: 'var(--accent-blue)', color: 'oklch(1 0 0)',
              }}
            >
              {editId ? 'Update' : 'Create'} Sequence
            </button>
          </div>
        </div>
      )}

      {/* Sequence List */}
      {sequences.length === 0 && !showForm ? (
        <div className="glass" style={{
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-2xl)',
          textAlign: 'center', color: 'var(--text-muted)', fontSize: 14,
        }}>
          No drip sequences yet. Create one to automate follow-ups.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {sequences.map(seq => (
            <div key={seq.id}>
              <div className="glass" style={{
                borderRadius: 'var(--radius-md)', padding: 'var(--space-md) var(--space-lg)',
                display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                opacity: seq.is_active ? 1 : 0.6,
              }}>
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(seq)}
                  style={{
                    width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                    background: seq.is_active ? 'var(--accent-blue)' : 'oklch(0.30 0.02 260)',
                    position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: 'oklch(1 0 0)',
                    position: 'absolute', top: 3,
                    left: seq.is_active ? 21 : 3, transition: 'left 0.2s',
                  }} />
                </button>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{seq.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 12 }}>
                    <span>
                      Trigger: <span style={{ color: 'var(--accent-blue)' }}>{triggerLabel(seq.trigger_type)}</span>
                    </span>
                    <span>
                      {seq.step_count || 0} step{seq.step_count != 1 ? 's' : ''}
                    </span>
                    <span>
                      {seq.active_enrollments || 0} active
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => toggleEnrollments(seq.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                    border: '1px solid var(--glass-border)', cursor: 'pointer',
                    background: expandedId === seq.id ? 'oklch(0.25 0.04 250 / 0.5)' : 'transparent',
                    color: 'var(--text-muted)',
                  }}
                >
                  Enrollments
                </button>
                <button
                  onClick={() => handleEdit(seq)}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                    border: '1px solid var(--glass-border)', cursor: 'pointer',
                    background: 'transparent', color: 'var(--text-muted)',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(seq.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                    border: '1px solid oklch(0.55 0.2 25 / 0.3)', cursor: 'pointer',
                    background: 'transparent', color: 'oklch(0.70 0.18 25)',
                  }}
                >
                  Delete
                </button>
              </div>

              {/* Enrollments panel */}
              {expandedId === seq.id && (
                <div className="glass" style={{
                  borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                  padding: 'var(--space-md) var(--space-lg)',
                  marginTop: -1,
                  borderTop: '1px solid var(--glass-border)',
                }}>
                  {enrollmentsLoading ? (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading enrollments...</div>
                  ) : enrollments.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No leads enrolled in this sequence yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 100px 80px', gap: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0 4px' }}>
                        <span>Lead</span>
                        <span>Email</span>
                        <span>Step</span>
                        <span>Status</span>
                        <span></span>
                      </div>
                      {enrollments.map(e => (
                        <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 100px 80px', gap: 8, fontSize: 13, alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.contact_name || 'Unknown'}
                          </span>
                          <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.contact_email || '—'}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>{e.current_step}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                            display: 'inline-block', width: 'fit-content',
                            background: e.status === 'active' ? 'oklch(0.45 0.15 150 / 0.2)' : e.status === 'completed' ? 'oklch(0.45 0.12 250 / 0.2)' : 'oklch(0.45 0.1 60 / 0.2)',
                            color: e.status === 'active' ? 'oklch(0.75 0.15 150)' : e.status === 'completed' ? 'oklch(0.75 0.12 250)' : 'oklch(0.70 0.12 60)',
                          }}>
                            {e.status}
                          </span>
                          {e.status === 'active' && (
                            <button
                              onClick={() => handleCancelEnrollment(seq.id, e.lead_id)}
                              style={{
                                padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                                border: '1px solid oklch(0.55 0.2 25 / 0.3)', cursor: 'pointer',
                                background: 'transparent', color: 'oklch(0.70 0.18 25)',
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)} style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(8px)',
        }}>
          <div
            className="glass modal-scale-in"
            onClick={e => e.stopPropagation()}
            style={{
              borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)',
              width: 380, maxWidth: '90vw',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Delete Sequence?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 'var(--space-lg)', lineHeight: 1.5 }}>
              This will permanently delete this drip sequence and cancel all active enrollments. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600,
                  border: '1px solid var(--glass-border)', cursor: 'pointer',
                  background: 'transparent', color: 'var(--text-muted)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: 'oklch(0.55 0.22 25)', color: 'oklch(1 0 0)',
                }}
              >
                Delete Sequence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MERGE_FIELDS = [
  { token: '{{first_name}}', label: 'First Name' },
  { token: '{{last_name}}', label: 'Last Name' },
  { token: '{{full_name}}', label: 'Full Name' },
  { token: '{{email}}', label: 'Email' },
  { token: '{{phone}}', label: 'Phone' },
  { token: '{{address}}', label: 'Address' },
  { token: '{{city}}', label: 'City' },
  { token: '{{company_name}}', label: 'Company' },
  { token: '{{estimated_value}}', label: 'Est. Value' },
  { token: '{{stage}}', label: 'Stage' },
];

function MergeFieldBar({ onInsert }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>
        Insert:
      </span>
      {MERGE_FIELDS.map(f => (
        <button
          key={f.token}
          type="button"
          onClick={() => onInsert(f.token)}
          style={{
            padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontSize: 10, fontWeight: 600,
            border: '1px solid var(--glass-border)', cursor: 'pointer',
            background: 'oklch(0.20 0.02 260 / 0.5)', color: 'oklch(0.72 0.19 250)',
          }}
          title={`Insert ${f.token}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function StepActionConfig({ actionType, config, onChange }) {
  switch (actionType) {
    case 'send_email':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className="form-input"
            placeholder="Email subject — e.g. Hi {{first_name}}, following up on your roof"
            value={config.subject || ''}
            onChange={e => onChange('subject', e.target.value)}
          />
          <MergeFieldBar onInsert={token => onChange('subject', (config.subject || '') + token)} />
          <textarea
            className="form-input"
            style={{ height: 'auto', minHeight: 80, resize: 'vertical' }}
            placeholder="Email body — use merge fields like {{first_name}} to personalize"
            value={config.body || ''}
            onChange={e => onChange('body', e.target.value)}
          />
          <MergeFieldBar onInsert={token => onChange('body', (config.body || '') + token)} />
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Merge fields like {'{{first_name}}'} will be replaced with actual lead data when the email is sent.
          </div>
        </div>
      );

    case 'create_task':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className="form-input"
            placeholder="Task title"
            value={config.title || ''}
            onChange={e => onChange('title', e.target.value)}
          />
        </div>
      );

    case 'notify':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className="form-input"
            placeholder="Notification title"
            value={config.title || ''}
            onChange={e => onChange('title', e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Notification body"
            value={config.body || ''}
            onChange={e => onChange('body', e.target.value)}
          />
        </div>
      );

    default:
      return null;
  }
}
