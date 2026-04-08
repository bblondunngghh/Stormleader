import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getWorkOrders, createWorkOrder, createWorkOrderFromEstimate, updateWorkOrder, completeWorkOrder, getTeamMembers, getWorkOrderMilestones, updateWorkOrderMilestone, addWorkOrderMilestone, deleteWorkOrderMilestone, getWorkOrderMilestoneTemplates, downloadWorkOrderPdf } from '../api/crm';
import { getEstimates } from '../api/estimates';
import { uploadDocument } from '../api/documents';
import { showToast } from './Toast';
import { IconPlusCircle, IconX, IconRefresh } from './Icons';
import { CheckCircleIcon, CameraIcon } from '@heroicons/react/24/outline';
import CustomSelect from './CustomSelect';
import DatePicker from './DatePicker';
import TimePicker from './TimePicker';

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
  const [milestones, setMilestones] = useState([]);
  const [milestonesLoading, setMilestonesLoading] = useState(true);
  const [uploadingMilestoneId, setUploadingMilestoneId] = useState(null);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const photoInputRef = useRef(null);
  const activeMilestoneRef = useRef(null);

  const handlePhotoUpload = async (milestoneId) => {
    activeMilestoneRef.current = milestoneId;
    photoInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const milestoneId = activeMilestoneRef.current;
    if (!milestoneId) return;

    setUploadingMilestoneId(milestoneId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('lead_id', wo.lead_id || '');
      formData.append('category', 'milestone_photo');
      formData.append('description', `Work order milestone photo`);

      const uploadRes = await uploadDocument(formData);
      const photoUrl = uploadRes.data?.url || uploadRes.data?.file_url;

      if (photoUrl) {
        const res = await updateWorkOrderMilestone(wo.id, milestoneId, { photo_url: photoUrl });
        setMilestones(prev => prev.map(m => m.id === milestoneId ? { ...m, photo_url: photoUrl, ...res.data } : m));
        showToast('Photo uploaded successfully');
      } else {
        showToast('Upload succeeded but no URL returned', 'error');
      }
    } catch (err) {
      showToast('Failed to upload photo', 'error');
    } finally {
      setUploadingMilestoneId(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  useEffect(() => {
    getWorkOrderMilestones(wo.id)
      .then(res => setMilestones(res.data?.milestones || []))
      .catch(() => {})
      .finally(() => setMilestonesLoading(false));
  }, [wo.id]);

  const toggleMilestone = async (milestone) => {
    const newCompleted = !milestone.completed;
    // Block completion if photo required but not uploaded
    if (newCompleted && milestone.photo_required && !milestone.photo_url) {
      showToast('Upload a photo before completing this milestone', 'error');
      return;
    }
    // Optimistic update
    setMilestones(prev => prev.map(m =>
      m.id === milestone.id ? { ...m, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null } : m
    ));
    try {
      const res = await updateWorkOrderMilestone(wo.id, milestone.id, { completed: newCompleted });
      setMilestones(prev => prev.map(m => m.id === milestone.id ? res.data : m));
    } catch (err) {
      // Revert
      setMilestones(prev => prev.map(m =>
        m.id === milestone.id ? milestone : m
      ));
      const msg = err?.response?.data?.error || 'Failed to update milestone';
      showToast(msg, 'error');
    }
  };

  const handleAddMilestone = async () => {
    if (!newMilestoneName.trim() || !wo?.id) return;
    try {
      const { data } = await addWorkOrderMilestone(wo.id, newMilestoneName.trim());
      setMilestones(prev => [...prev, data]);
      setNewMilestoneName('');
    } catch {
      showToast('Failed to add milestone', 'error');
    }
  };

  const handleDeleteMilestone = async (milestoneId) => {
    try {
      await deleteWorkOrderMilestone(wo.id, milestoneId);
      setMilestones(prev => prev.filter(ms => ms.id !== milestoneId));
    } catch {
      showToast('Failed to remove milestone', 'error');
    }
  };

  const completedCount = milestones.filter(m => m.completed).length;
  const totalCount = milestones.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

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

  const [editLineItems, setEditLineItems] = useState(() => {
    const items = Array.isArray(wo.line_items) ? wo.line_items : [];
    return items.map((item, i) => ({ ...item, _id: i }));
  });
  const [lineItemsDirty, setLineItemsDirty] = useState(false);
  const nextLineIdRef = useRef(editLineItems.length);

  const handleLineItemChange = (idx, field, value) => {
    setEditLineItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    ));
    setLineItemsDirty(true);
  };

  const handleAddLineItem = () => {
    nextLineIdRef.current += 1;
    setEditLineItems(prev => [...prev, {
      _id: nextLineIdRef.current,
      description: '',
      quantity: 1,
      unit_price: 0,
    }]);
    setLineItemsDirty(true);
  };

  const handleRemoveLineItem = (idx) => {
    setEditLineItems(prev => prev.filter((_, i) => i !== idx));
    setLineItemsDirty(true);
  };

  const handleSaveLineItems = async () => {
    setSaving(true);
    try {
      const cleaned = editLineItems.map(({ _id, ...rest }) => rest);
      await onSave(wo.id, { line_items: cleaned });
      setLineItemsDirty(false);
      showToast('Line items saved', 'success');
    } catch {
      showToast('Failed to save line items', 'error');
    }
    setSaving(false);
  };

  const statusColor = STATUS_COLORS[wo.status] || STATUS_COLORS.pending;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass no-scrollbar" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 580, maxHeight: '90vh', overflow: 'auto',
        borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)',
        boxShadow: '0 24px 80px oklch(0 0 0 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.06)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-lg)' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Work Order Detail</h2>
            <span style={{
              display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 'var(--radius-pill)',
              fontSize: 11, fontWeight: 700, color: statusColor,
              background: `color-mix(in oklch, ${statusColor} 14%, transparent)`,
            }}>{wo.status?.replace('_', ' ').toUpperCase()}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <IconX width={20} height={20} />
          </button>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <label style={labelStyle}>
            Title
            <input value={form.title} onChange={e => handleChange('title', e.target.value)}
              className="form-input" style={{ marginTop: 4 }} />
          </label>

          <label style={labelStyle}>
            Description
            <textarea value={form.description} onChange={e => handleChange('description', e.target.value)}
              rows={2} className="form-input" style={{ height: 'auto', minHeight: 60, marginTop: 4, resize: 'vertical' }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', alignItems: 'end' }}>
            <div>
              <span style={labelStyle}>Assigned To</span>
              <CustomSelect
                value={form.assigned_to || ''}
                onChange={(v) => handleChange('assigned_to', v)}
                placeholder="Unassigned"
                options={[
                  { value: '', label: 'Unassigned' },
                  ...teamMembers.map(m => ({
                    value: m.id,
                    label: [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email,
                  })),
                ]}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <span style={labelStyle}>Crew Name</span>
              <input value={form.crew_name} onChange={e => handleChange('crew_name', e.target.value)}
                className="form-input" style={{ marginTop: 4 }} placeholder="e.g. Crew A" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)', alignItems: 'end', overflow: 'visible', position: 'relative', zIndex: 10 }}>
            <div>
              <span style={labelStyle}>Date</span>
              <DatePicker value={form.scheduled_date} onChange={v => handleChange('scheduled_date', v)} placeholder="Select date" />
            </div>
            <div>
              <span style={labelStyle}>Start Time</span>
              <TimePicker value={form.scheduled_time_start} onChange={v => handleChange('scheduled_time_start', v)} placeholder="Start" />
            </div>
            <div>
              <span style={labelStyle}>End Time</span>
              <TimePicker value={form.scheduled_time_end} onChange={v => handleChange('scheduled_time_end', v)} placeholder="End" />
            </div>
          </div>

          {/* Line Items (editable) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                Line Items ({editLineItems.length})
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {lineItemsDirty && (
                  <button
                    onClick={handleSaveLineItems}
                    disabled={saving}
                    style={{
                      padding: '3px 10px', borderRadius: 6, border: '1px solid oklch(0.75 0.18 155 / 0.4)',
                      background: 'oklch(0.75 0.18 155 / 0.12)', color: 'oklch(0.75 0.18 155)',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Save Items
                  </button>
                )}
                <button
                  onClick={handleAddLineItem}
                  style={{
                    padding: '3px 10px', borderRadius: 6, border: '1px solid oklch(0.72 0.19 250 / 0.3)',
                    background: 'oklch(0.72 0.19 250 / 0.12)', color: 'oklch(0.72 0.19 250)',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  + Add
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {editLineItems.length === 0 && (
                <div style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No line items — click "+ Add" to create one
                </div>
              )}
              {editLineItems.map((item, i) => (
                <div key={item._id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 60px 80px auto', gap: 6, alignItems: 'center',
                  padding: '6px 8px', borderRadius: 8, background: 'oklch(1 0 0 / 0.04)',
                }}>
                  <input
                    value={item.description || item.name || ''}
                    onChange={e => handleLineItemChange(i, 'description', e.target.value)}
                    className="form-input"
                    placeholder="Description"
                    style={{ fontSize: 12, padding: '4px 8px', height: 30 }}
                  />
                  <input
                    type="number"
                    value={item.quantity || ''}
                    onChange={e => handleLineItemChange(i, 'quantity', e.target.value)}
                    className="form-input"
                    placeholder="Qty"
                    style={{ fontSize: 12, padding: '4px 6px', height: 30, textAlign: 'center' }}
                    min="0"
                    step="1"
                  />
                  <input
                    type="number"
                    value={item.unit_price || ''}
                    onChange={e => handleLineItemChange(i, 'unit_price', e.target.value)}
                    className="form-input"
                    placeholder="Price"
                    style={{ fontSize: 12, padding: '4px 6px', height: 30, textAlign: 'right' }}
                    min="0"
                    step="0.01"
                  />
                  <button
                    onClick={() => handleRemoveLineItem(i)}
                    title="Remove"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.12 25)',
                      padding: 2, display: 'flex', alignItems: 'center',
                    }}
                  >
                    <IconX width={14} height={14} />
                  </button>
                </div>
              ))}
              {editLineItems.length > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'flex-end', padding: '4px 8px',
                  fontSize: 13, fontWeight: 700, color: 'oklch(0.75 0.18 155)',
                }}>
                  Total: ${editLineItems.reduce((sum, item) =>
                    sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0
                  ).toFixed(2)}
                </div>
              )}
            </div>
          </div>

          <label style={labelStyle}>
            Notes
            <textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)}
              rows={3} className="form-input" style={{ height: 'auto', minHeight: 80, marginTop: 4, resize: 'vertical' }} placeholder="Internal notes..." />
          </label>

          {/* Milestones */}
          {!milestonesLoading && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                  Milestones ({completedCount}/{totalCount})
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: progressPct === 100 ? 'oklch(0.75 0.18 145)' : 'var(--text-muted)' }}>
                  {Math.round(progressPct)}%
                </span>
              </div>
              {/* Progress bar */}
              <div style={{
                height: 4, borderRadius: 2, background: 'oklch(1 0 0 / 0.08)',
                marginBottom: 10, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${progressPct}%`,
                  background: progressPct === 100 ? 'oklch(0.75 0.18 145)' : 'oklch(0.72 0.19 250)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              {/* Milestone rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {milestones.map(m => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                    borderRadius: 8, background: 'oklch(1 0 0 / 0.04)',
                    opacity: m.completed ? 0.7 : 1,
                  }}>
                    <button
                      onClick={() => toggleMilestone(m)}
                      style={{
                        width: 20, height: 20, borderRadius: 6, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: m.completed ? 'oklch(0.75 0.18 145)' : 'oklch(1 0 0 / 0.08)',
                        color: m.completed ? 'oklch(0.2 0 0)' : 'transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      {m.completed && (
                        <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span style={{
                      flex: 1, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500,
                      textDecoration: m.completed ? 'line-through' : 'none',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {m.name}
                      {m.photo_required && !m.photo_url && !m.completed && (
                        <span title="Photo required to complete" style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                          background: 'oklch(0.65 0.18 25 / 0.15)', color: 'oklch(0.65 0.18 25)',
                          whiteSpace: 'nowrap',
                        }}>PHOTO REQ</span>
                      )}
                    </span>
                    {m.completed_at && (
                      <span title={new Date(m.completed_at).toLocaleString()} style={{ fontSize: 10, color: 'oklch(0.75 0.18 145 / 0.8)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {formatDate(m.completed_at)} {new Date(m.completed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                    {m.photo_url && (
                      <a href={m.photo_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        <img src={m.photo_url} alt="Milestone photo" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--glass-border)' }} />
                      </a>
                    )}
                    <button
                      title={m.photo_required && !m.photo_url ? 'Photo required — upload before completing' : m.photo_url ? 'Replace photo' : 'Upload milestone photo'}
                      disabled={uploadingMilestoneId === m.id}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: uploadingMilestoneId === m.id ? 'var(--accent-blue)'
                          : m.photo_required && !m.photo_url && !m.completed ? 'oklch(0.65 0.18 25)'
                          : m.photo_url ? 'oklch(0.75 0.18 155)' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center',
                        opacity: (m.photo_required && !m.photo_url && !m.completed) || uploadingMilestoneId === m.id ? 1 : 0.7, padding: 2,
                      }}
                      onClick={(e) => { e.stopPropagation(); handlePhotoUpload(m.id); }}
                    >
                      {uploadingMilestoneId === m.id ? (
                        <span style={{ fontSize: 10, fontWeight: 600 }}>...</span>
                      ) : (
                        <CameraIcon width={14} height={14} />
                      )}
                    </button>
                    {!m.completed && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteMilestone(m.id); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '0 4px', opacity: 0.5 }}
                        title="Remove milestone">
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {/* Add milestone input */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input
                  className="form-input"
                  placeholder="Add milestone..."
                  value={newMilestoneName}
                  onChange={e => setNewMilestoneName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newMilestoneName.trim()) handleAddMilestone(); }}
                  style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                />
                <button className="btn btn-primary" disabled={!newMilestoneName.trim()} onClick={handleAddMilestone}
                  style={{ fontSize: 11, padding: '6px 12px' }}>
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Hidden file input for milestone photo upload */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />

          {/* Lead link */}
          {wo.lead_id && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Lead: <span style={{ color: 'oklch(0.72 0.15 220)', fontWeight: 600 }}>{wo.contact_name || wo.address || wo.lead_id}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)', justifyContent: 'flex-end' }}>
          <button onClick={async () => {
            try {
              const res = await downloadWorkOrderPdf(wo.id);
              const blob = new Blob([res.data], { type: 'application/pdf' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `work-order-${(wo.title || wo.id).replace(/[^a-zA-Z0-9]/g, '-').substring(0, 40)}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
              showToast('PDF downloaded');
            } catch { showToast('Failed to generate PDF', 'error'); }
          }} style={{
            ...btnStyle,
            background: 'oklch(0.6 0.12 55 / 0.15)',
            color: 'oklch(0.78 0.16 85)',
            border: '1px solid oklch(0.78 0.16 85 / 0.25)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>picture_as_pdf</span> Export PDF
          </button>
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
    milestone_template: 'default',
  });
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  useEffect(() => {
    getWorkOrderMilestoneTemplates()
      .then(res => {
        const tpls = res.data?.templates || [];
        setTemplates(tpls);
        setPreviewTemplate(tpls.find(t => t.key === 'default') || null);
      })
      .catch(() => {});
  }, []);

  const handleChange = (field, val) => {
    setForm(f => ({ ...f, [field]: val }));
    if (field === 'milestone_template') {
      setPreviewTemplate(templates.find(t => t.key === val) || null);
    }
  };

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
      <form className="glass no-scrollbar" onClick={e => e.stopPropagation()} onSubmit={handleSubmit} style={{
        width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto',
        borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)',
        boxShadow: '0 24px 80px oklch(0 0 0 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>New Work Order</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <IconX width={20} height={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <label style={labelStyle}>
            Title *
            <input value={form.title} onChange={e => handleChange('title', e.target.value)} className="form-input" style={{ marginTop: 4 }} placeholder="e.g. Roof Replacement" required />
          </label>
          <label style={labelStyle}>
            Description
            <textarea value={form.description} onChange={e => handleChange('description', e.target.value)} rows={2} className="form-input" style={{ height: 'auto', minHeight: 60, marginTop: 4, resize: 'vertical' }} />
          </label>

          {/* Milestone Template Selector */}
          {templates.length > 0 && (
            <div>
              <span style={labelStyle}>Job Type Template</span>
              <CustomSelect
                value={form.milestone_template}
                onChange={(v) => handleChange('milestone_template', v)}
                options={templates.map(t => ({
                  value: t.key,
                  label: `${t.label} (${t.count} steps)`,
                }))}
                style={{ marginTop: 4 }}
              />
              {/* Template preview */}
              {previewTemplate && (
                <div style={{
                  marginTop: 8, padding: '10px 14px', borderRadius: 10,
                  background: 'oklch(1 0 0 / 0.04)', border: '1px solid oklch(1 0 0 / 0.06)',
                  maxHeight: 160, overflowY: 'auto',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Checklist Preview
                  </div>
                  {previewTemplate.milestones.map((m, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0',
                      fontSize: 12, color: 'var(--text-secondary)',
                    }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        border: '1.5px solid oklch(1 0 0 / 0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }} />
                      <span>{m}</span>
                      {previewTemplate.photo_required?.[i] && (
                        <CameraIcon width={11} height={11} style={{ color: 'oklch(0.65 0.18 25)', flexShrink: 0 }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
            <div>
              <span style={labelStyle}>Assigned To</span>
              <CustomSelect
                value={form.assigned_to || ''}
                onChange={(v) => handleChange('assigned_to', v)}
                placeholder="Unassigned"
                options={[
                  { value: '', label: 'Unassigned' },
                  ...teamMembers.map(m => ({
                    value: m.id,
                    label: [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email,
                  })),
                ]}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <span style={labelStyle}>Crew Name</span>
              <input value={form.crew_name} onChange={e => handleChange('crew_name', e.target.value)} className="form-input" style={{ marginTop: 4 }} placeholder="e.g. Crew A" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end', overflow: 'visible', position: 'relative', zIndex: 10 }}>
            <div>
              <span style={labelStyle}>Date</span>
              <DatePicker value={form.scheduled_date} onChange={v => handleChange('scheduled_date', v)} placeholder="Select date" />
            </div>
            <div>
              <span style={labelStyle}>Start</span>
              <TimePicker value={form.scheduled_time_start} onChange={v => handleChange('scheduled_time_start', v)} placeholder="Start" />
            </div>
            <div>
              <span style={labelStyle}>End</span>
              <TimePicker value={form.scheduled_time_end} onChange={v => handleChange('scheduled_time_end', v)} placeholder="End" />
            </div>
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
        borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)',
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
  const [milestoneCounts, setMilestoneCounts] = useState({}); // { woId: { completed, total } }

  const fetchMilestoneCounts = useCallback(async (wos) => {
    const counts = {};
    await Promise.all(wos.map(async (wo) => {
      try {
        const res = await getWorkOrderMilestones(wo.id);
        const ms = res.data?.milestones || [];
        counts[wo.id] = { completed: ms.filter(m => m.completed).length, total: ms.length };
      } catch {
        counts[wo.id] = { completed: 0, total: 0 };
      }
    }));
    setMilestoneCounts(counts);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await getWorkOrders({ limit: 500 });
      const wos = res.data?.workOrders || [];
      setWorkOrders(wos);
      fetchMilestoneCounts(wos);
    } catch {
      showToast('Failed to load work orders', 'error');
    }
    setLoading(false);
  }, [fetchMilestoneCounts]);

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
    <div className="main-content !gap-0" style={{ padding: 0 }}>
      {/* Top Bar */}
      <div className="glass" style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: 'var(--space-md) var(--space-2xl)',
        borderRadius: '20px / 18px',
        boxShadow: '0 8px 32px oklch(0 0 0 / 0.25), inset 0 1px 0 oklch(1 0 0 / 0.05)',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Work Orders</h1>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 'var(--radius-pill)',
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
        {workOrders.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '80px 24px', textAlign: 'center', color: 'var(--text-muted)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🔧</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              No work orders yet
            </h2>
            <p style={{ fontSize: 14, maxWidth: 360, margin: '0 0 20px', lineHeight: 1.5 }}>
              Create a work order from an approved estimate or start a new one to track jobs through production.
            </p>
            <button onClick={() => setShowCreate(true)} style={{
              ...btnStyle,
              background: 'oklch(0.72 0.19 250 / 0.15)',
              color: 'oklch(0.72 0.19 250)',
              border: '1px solid oklch(0.72 0.19 250 / 0.25)',
              fontSize: 14, padding: '10px 20px',
            }}>
              <IconPlusCircle width={16} height={16} /> Create Work Order
            </button>
          </div>
        ) : (
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
                    display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', padding: 'var(--space-md) var(--space-lg)',
                    borderRadius: 'var(--radius-xl)', position: 'sticky', top: 0, zIndex: 10,
                    boxShadow: '0 8px 32px oklch(0 0 0 / 0.25), inset 0 1px 0 oklch(1 0 0 / 0.05)',
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: col.color, flex: 1 }}>{col.label}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-pill)',
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
                        padding: 'var(--space-lg)', borderRadius: 'var(--radius-xl)', cursor: 'pointer',
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

                      {/* Milestone progress */}
                      {milestoneCounts[wo.id] && milestoneCounts[wo.id].total > 0 && (() => {
                        const mc = milestoneCounts[wo.id];
                        const pct = (mc.completed / mc.total) * 100;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'oklch(1 0 0 / 0.08)', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: 2,
                                width: `${pct}%`,
                                background: pct === 100 ? 'oklch(0.75 0.18 145)' : 'oklch(0.72 0.19 250)',
                              }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {mc.completed}/{mc.total}
                            </span>
                          </div>
                        );
                      })()}
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
        )}
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
const labelStyle = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
};

const btnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 10, border: 'none',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  background: 'transparent', transition: 'all 0.15s',
};
