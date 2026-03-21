import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getWorkOrders, createWorkOrder, createWorkOrderFromEstimate, updateWorkOrder, completeWorkOrder, getTeamMembers } from '../api/crm';
import { getEstimates } from '../api/estimates';
import { showToast } from './Toast';
import { IconPlusCircle, IconX, IconRefresh } from './Icons';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

const STATUS_COLUMNS = [
  { key: 'pending',     label: 'Pending',     color: 'oklch(0.6 0 0)' },
  { key: 'scheduled',   label: 'Scheduled',   color: 'oklch(0.7 0.15 220)' },
  { key: 'in_progress', label: 'In Progress', color: 'oklch(0.75 0.15 55)' },
  { key: 'completed',   label: 'Completed',   color: 'oklch(0.75 0.18 145)' },
];

const STATUS_COLORS = {
  pending:     'oklch(0.6 0 0)',
  scheduled:   'oklch(0.7 0.15 220)',
  in_progress: 'oklch(0.75 0.15 55)',
  completed:   'oklch(0.75 0.18 145)',
  cancelled:   'oklch(0.5 0 0)',
};

function formatDate(d) {
  if (!d) return '';
  const parts = d.substring(0, 10).split('-');
  if (parts.length === 3) {
    const dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.substring(0, 10);
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const hr12 = hr % 12 || 12;
  return `${hr12}:${m} ${ampm}`;
}

function truncate(str, len = 30) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

// ============================================================
// DETAIL MODAL
// ============================================================
function WorkOrderDetail({ wo, onClose, onSave, onComplete, teamMembers }) {
  const [form, setForm] = useState({
    title: wo.title || '',
    description: wo.description || '',
    assigned_to: wo.assigned_to || '',
    crew_name: wo.crew_name || '',
    scheduled_date: wo.scheduled_date ? wo.scheduled_date.substring(0, 10) : '',
    scheduled_time_start: wo.scheduled_time_start || '',
    scheduled_time_end: wo.scheduled_time_end || '',
    notes: wo.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(wo.id, form);
      showToast('Work order updated', 'success');
    } catch {
      showToast('Failed to update', 'error');
    }
    setSaving(false);
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await onComplete(wo.id);
      showToast('Work order completed', 'success');
    } catch {
      showToast('Failed to complete', 'error');
    }
    setSaving(false);
  };

  const lineItems = Array.isArray(wo.line_items) ? wo.line_items : [];
  const statusColor = STATUS_COLORS[wo.status] || STATUS_COLORS.pending;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 580, maxHeight: '90vh', overflow: 'auto',
        borderRadius: '24px / 22px', padding: 28,
        boxShadow: '0 24px 80px oklch(0 0 0 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.06)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Work Order Detail</h2>
            <span style={{
              display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 99,
              fontSize: 11, fontWeight: 700, color: statusColor,
              background: `color-mix(in oklch, ${statusColor} 14%, transparent)`,
            }}>{wo.status?.replace('_', ' ').toUpperCase()}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <IconX width={20} height={20} />
          </button>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            Title
            <input value={form.title} onChange={e => handleChange('title', e.target.value)}
              style={inputStyle} />
          </label>

          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            Description
            <textarea value={form.description} onChange={e => handleChange('description', e.target.value)}
              rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              Assigned To
              <select value={form.assigned_to} onChange={e => handleChange('assigned_to', e.target.value)} style={inputStyle}>
                <option value="">Unassigned</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>
                    {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              Crew Name
              <input value={form.crew_name} onChange={e => handleChange('crew_name', e.target.value)}
                style={inputStyle} placeholder="e.g. Crew A" />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              Date
              <input type="date" value={form.scheduled_date} onChange={e => handleChange('scheduled_date', e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              Start Time
              <input type="time" value={form.scheduled_time_start} onChange={e => handleChange('scheduled_time_start', e.target.value)} style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              End Time
              <input type="time" value={form.scheduled_time_end} onChange={e => handleChange('scheduled_time_end', e.target.value)} style={inputStyle} />
            </label>
          </div>

          {/* Line Items (read-only) */}
          {lineItems.length > 0 && (
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Line Items</span>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {lineItems.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', padding: '6px 10px',
                    borderRadius: 8, background: 'oklch(1 0 0 / 0.04)', fontSize: 13,
                  }}>
                    <span style={{ color: 'var(--text-primary)' }}>{item.description || item.name || `Item ${i + 1}`}</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                      {item.quantity && item.unit_price
                        ? `${item.quantity} × $${Number(item.unit_price).toFixed(2)}`
                        : item.total ? `$${Number(item.total).toFixed(2)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            Notes
            <textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)}
              rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Internal notes..." />
          </label>

          {/* Lead link */}
          {wo.lead_id && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Lead: <span style={{ color: 'oklch(0.72 0.15 220)', fontWeight: 600 }}>{wo.contact_name || wo.address || wo.lead_id}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          {wo.status !== 'completed' && (
            <button onClick={handleComplete} disabled={saving} style={{
              ...btnStyle,
              background: 'oklch(0.75 0.18 145 / 0.15)',
              color: 'oklch(0.75 0.18 145)',
              border: '1px solid oklch(0.75 0.18 145 / 0.25)',
            }}>
              <CheckCircleIcon width={16} height={16} /> Complete
            </button>
          )}
          <button onClick={handleSave} disabled={saving} style={{
            ...btnStyle,
            background: 'oklch(0.72 0.19 250 / 0.15)',
            color: 'oklch(0.72 0.19 250)',
            border: '1px solid oklch(0.72 0.19 250 / 0.25)',
          }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CREATE MODAL
// ============================================================
function CreateWorkOrderModal({ onClose, onCreate, teamMembers }) {
  const [form, setForm] = useState({
    title: '', description: '', lead_id: '', crew_name: '',
    scheduled_date: '', scheduled_time_start: '', scheduled_time_end: '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { showToast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      await onCreate(form);
      showToast('Work order created', 'success');
      onClose();
    } catch {
      showToast('Failed to create', 'error');
    }
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form className="glass" onClick={e => e.stopPropagation()} onSubmit={handleSubmit} style={{
        width: '100%', maxWidth: 480, borderRadius: '24px / 22px', padding: 28,
        boxShadow: '0 24px 80px oklch(0 0 0 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>New Work Order</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <IconX width={20} height={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={labelStyle}>
            Title *
            <input value={form.title} onChange={e => handleChange('title', e.target.value)} style={inputStyle} placeholder="e.g. Roof Replacement" required />
          </label>
          <label style={labelStyle}>
            Description
            <textarea value={form.description} onChange={e => handleChange('description', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>
              Assigned To
              <select value={form.assigned_to || ''} onChange={e => handleChange('assigned_to', e.target.value)} style={inputStyle}>
                <option value="">Unassigned</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>
                    {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Crew Name
              <input value={form.crew_name} onChange={e => handleChange('crew_name', e.target.value)} style={inputStyle} placeholder="e.g. Crew A" />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>
              Date
              <input type="date" value={form.scheduled_date} onChange={e => handleChange('scheduled_date', e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Start
              <input type="time" value={form.scheduled_time_start} onChange={e => handleChange('scheduled_time_start', e.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              End
              <input type="time" value={form.scheduled_time_end} onChange={e => handleChange('scheduled_time_end', e.target.value)} style={inputStyle} />
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ ...btnStyle, color: 'var(--text-muted)' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{
            ...btnStyle,
            background: 'oklch(0.72 0.19 250 / 0.15)',
            color: 'oklch(0.72 0.19 250)',
            border: '1px solid oklch(0.72 0.19 250 / 0.25)',
          }}>{saving ? 'Creating...' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// ESTIMATE PICKER MODAL
// ============================================================
function EstimatePickerModal({ onClose, onPick }) {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEstimates({ limit: 100 })
      .then(res => setEstimates(res.data?.estimates || res.data || []))
      .catch(() => showToast('Failed to load estimates', 'error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, maxHeight: '70vh', overflow: 'auto',
        borderRadius: '24px / 22px', padding: 28,
        boxShadow: '0 24px 80px oklch(0 0 0 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Select Estimate</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <IconX width={20} height={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading estimates...</div>
        ) : estimates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No estimates found</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {estimates.map(est => (
              <button key={est.id} onClick={() => onPick(est.id)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'oklch(1 0 0 / 0.04)', color: 'var(--text-primary)', fontSize: 13,
                textAlign: 'left', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'oklch(1 0 0 / 0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'oklch(1 0 0 / 0.04)'}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{est.title || `Estimate #${est.estimate_number || est.id?.slice(0, 8)}`}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{est.contact_name || est.lead_address || ''}</div>
                </div>
                {est.total && (
                  <span style={{ fontWeight: 700, color: 'oklch(0.75 0.18 145)' }}>${Number(est.total).toLocaleString()}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN VIEW
// ============================================================
export default function WorkOrdersView() {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEstimatePicker, setShowEstimatePicker] = useState(false);
  const [dragState, setDragState] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await getWorkOrders({ limit: 500 });
      setWorkOrders(res.data?.workOrders || []);
    } catch {
      showToast('Failed to load work orders', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    getTeamMembers().then(res => setTeamMembers(res.data?.members || [])).catch(() => {});
  }, [fetchData]);

  // Drag handlers (same pattern as Pipeline.jsx)
  const handleDragStart = (e, wo) => {
    setDragState({ woId: wo.id, fromStatus: wo.status });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', wo.id);
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDragState(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, toStatus) => {
    e.preventDefault();
    if (!dragState || dragState.fromStatus === toStatus) return;

    const woId = dragState.woId;
    const fromStatus = dragState.fromStatus;

    // Optimistic update
    setWorkOrders(prev => prev.map(w =>
      w.id === woId ? { ...w, status: toStatus } : w
    ));

    const colLabel = STATUS_COLUMNS.find(c => c.key === toStatus)?.label || toStatus;
    showToast(`Moved to ${colLabel}`, 'success');

    try {
      if (toStatus === 'completed') {
        await completeWorkOrder(woId);
      } else {
        await updateWorkOrder(woId, { status: toStatus });
      }
    } catch {
      showToast('Failed to update status', 'error');
      setWorkOrders(prev => prev.map(w =>
        w.id === woId ? { ...w, status: fromStatus } : w
      ));
    }
    setDragState(null);
  };

  const handleCreate = async (data) => {
    const res = await createWorkOrder(data);
    setWorkOrders(prev => [res.data, ...prev]);
  };

  const handleCreateFromEstimate = async (estimateId) => {
    try {
      const res = await createWorkOrderFromEstimate(estimateId);
      setWorkOrders(prev => [res.data, ...prev]);
      showToast('Work order created from estimate', 'success');
      setShowEstimatePicker(false);
    } catch {
      showToast('Failed to create from estimate', 'error');
    }
  };

  const handleSave = async (id, data) => {
    const res = await updateWorkOrder(id, data);
    setWorkOrders(prev => prev.map(w => w.id === id ? { ...w, ...res.data } : w));
    setSelectedWO(prev => prev ? { ...prev, ...res.data } : null);
  };

  const handleComplete = async (id) => {
    const res = await completeWorkOrder(id);
    setWorkOrders(prev => prev.map(w => w.id === id ? { ...w, ...res.data, status: 'completed' } : w));
    setSelectedWO(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        <div className="storm-map-loading__spinner" style={{ marginRight: 12 }} />
        Loading work orders...
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%', overflow: 'hidden' }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 28px',
        borderBottom: '1px solid oklch(1 0 0 / 0.06)',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Work Orders</h1>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 99,
          color: 'var(--text-muted)', background: 'oklch(1 0 0 / 0.06)',
        }}>{workOrders.length}</span>

        <div style={{ flex: 1 }} />

        <button onClick={() => setShowEstimatePicker(true)} style={{
          ...btnStyle,
          background: 'oklch(0.75 0.15 55 / 0.12)',
          color: 'oklch(0.75 0.15 55)',
          border: '1px solid oklch(0.75 0.15 55 / 0.2)',
        }}>
          From Estimate
        </button>

        <button onClick={() => setShowCreate(true)} style={{
          ...btnStyle,
          background: 'oklch(0.72 0.19 250 / 0.15)',
          color: 'oklch(0.72 0.19 250)',
          border: '1px solid oklch(0.72 0.19 250 / 0.25)',
        }}>
          <IconPlusCircle width={16} height={16} /> New Work Order
        </button>

        <button onClick={fetchData} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center',
        }} title="Refresh">
          <IconRefresh width={18} height={18} />
        </button>
      </div>

      {/* Kanban Board */}
      <div style={{ overflow: 'auto', padding: '16px 28px 16px' }}>
        <div style={{ display: 'flex', gap: 16, minWidth: '100%', alignItems: 'flex-start' }}>
          {STATUS_COLUMNS.map(col => {
            const colOrders = workOrders.filter(w => w.status === col.key);
            const isDropTarget = dragState && dragState.fromStatus !== col.key;

            return (
              <div
                key={col.key}
                style={{
                  minWidth: 280, width: 280, display: 'flex', flexDirection: 'column', gap: 8,
                  ...(isDropTarget ? { outline: `2px dashed ${col.color}`, outlineOffset: -2, borderRadius: 12 } : {}),
                }}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, col.key)}
              >
                {/* Column Header */}
                <div
                  className="glass"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
                    borderRadius: '20px / 18px', position: 'sticky', top: 0, zIndex: 10,
                    boxShadow: '0 8px 32px oklch(0 0 0 / 0.25), inset 0 1px 0 oklch(1 0 0 / 0.05)',
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: col.color, flex: 1 }}>{col.label}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    color: col.color, background: `color-mix(in oklch, ${col.color} 12%, transparent)`,
                  }}>{colOrders.length}</span>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colOrders.map(wo => (
                    <div
                      key={wo.id}
                      className="glass"
                      draggable
                      onDragStart={e => handleDragStart(e, wo)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedWO(wo)}
                      style={{
                        padding: 16, borderRadius: '20px / 18px', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', gap: 6,
                        boxShadow: '0 8px 32px oklch(0 0 0 / 0.25), inset 0 1px 0 oklch(1 0 0 / 0.05)',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 40px oklch(0 0 0 / 0.35), inset 0 1px 0 oklch(1 0 0 / 0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 32px oklch(0 0 0 / 0.25), inset 0 1px 0 oklch(1 0 0 / 0.05)'; }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{wo.title}</span>

                      {(wo.crew_name || wo.assigned_name) && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {wo.crew_name || wo.assigned_name}
                        </span>
                      )}

                      {wo.scheduled_date && (
                        <span style={{ fontSize: 11, color: 'oklch(0.7 0.15 220)', fontWeight: 600 }}>
                          {formatDate(wo.scheduled_date)}
                          {wo.scheduled_time_start && ` ${formatTime(wo.scheduled_time_start)}`}
                          {wo.scheduled_time_end && ` - ${formatTime(wo.scheduled_time_end)}`}
                        </span>
                      )}

                      {wo.address && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {truncate(wo.address, 35)}
                        </span>
                      )}
                    </div>
                  ))}

                  {colOrders.length === 0 && (
                    <div style={{
                      padding: '24px 16px', textAlign: 'center', fontSize: 12,
                      color: 'var(--text-muted)', borderRadius: 12,
                      border: '1px dashed oklch(1 0 0 / 0.08)',
                    }}>
                      No work orders
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateWorkOrderModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          teamMembers={teamMembers}
        />
      )}

      {showEstimatePicker && (
        <EstimatePickerModal
          onClose={() => setShowEstimatePicker(false)}
          onPick={handleCreateFromEstimate}
        />
      )}

      {selectedWO && (
        <WorkOrderDetail
          wo={selectedWO}
          onClose={() => setSelectedWO(null)}
          onSave={handleSave}
          onComplete={handleComplete}
          teamMembers={teamMembers}
        />
      )}
    </div>
  );
}

// ============================================================
// SHARED STYLES
// ============================================================
const inputStyle = {
  display: 'block', width: '100%', marginTop: 4, padding: '8px 12px',
  borderRadius: 10, border: '1px solid oklch(1 0 0 / 0.1)',
  background: 'oklch(1 0 0 / 0.04)', color: 'var(--text-primary)',
  fontSize: 13, outline: 'none',
};

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
};

const btnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 10, border: 'none',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  background: 'transparent', transition: 'all 0.15s',
};
