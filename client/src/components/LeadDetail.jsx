import { useState, useEffect, useRef } from 'react';
import { getLeadDetail, updateLead, logActivity, getActivities, addContact } from '../api/crm';
import { getDocuments, uploadDocument, deleteDocument } from '../api/documents';
import { IconX, IconPhone, IconMail, IconCalendar, IconClipboard, IconDollar, IconCamera, IconSend, IconTrash } from './Icons';
import ActivityModal from './ActivityModal';

const stageLabels = {
  new: 'New',
  contacted: 'Contacted',
  appt_set: 'Appt Set',
  inspected: 'Inspected',
  estimate_sent: 'Estimate Sent',
  negotiating: 'Negotiating',
  sold: 'Sold',
  in_production: 'In Production',
  on_hold: 'On Hold',
  lost: 'Lost',
};

const stageKeys = Object.keys(stageLabels);

export default function LeadDetail({ leadId, lead: legacyLead, onClose, onUpdated }) {
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch full lead detail from API
  useEffect(() => {
    if (!leadId && !legacyLead) return;

    if (leadId) {
      setLoading(true);
      getLeadDetail(leadId)
        .then(res => {
          setLead(res.data);
          setActivities(res.data.activities || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (legacyLead) {
      // Legacy mock data support — no API call
      setLead(legacyLead);
      setLoading(false);
    }
  }, [leadId, legacyLead]);

  // Fetch documents for this lead (must be before any early returns — hooks rules)
  useEffect(() => {
    if (!leadId) return;
    getDocuments({ lead_id: leadId, limit: 50 })
      .then(res => setDocuments(res.data.documents || []))
      .catch(() => {});
  }, [leadId]);

  if (loading) {
    return (
      <>
        <div className="slide-over-backdrop" onClick={onClose} />
        <div className="slide-over glass" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>Loading...</span>
        </div>
      </>
    );
  }

  if (!lead) return null;

  // Normalize field names (API uses underscores, mock uses camelCase)
  const name = lead.contact_name || lead.name || '—';
  const address = lead.address || '—';
  const city = lead.city || '';
  const phone = lead.contact_phone || lead.phone || '—';
  const email = lead.contact_email || lead.email || '—';
  const value = lead.estimated_value || lead.value || 0;
  const priority = lead.priority || 'warm';
  const stage = lead.stage || 'new';
  const roofType = lead.roof_type || lead.roofType || '—';
  const sqft = lead.roof_sqft || lead.property_sqft || lead.sqft || 0;
  const hailSize = lead.hail_size_in || lead.storm_hail_max || lead.hailSize || '—';
  const stormDate = lead.storm_start ? new Date(lead.storm_start).toLocaleDateString() : (lead.stormDate || '—');
  const insuranceCo = lead.insurance_company || lead.insuranceCo || '—';
  const claimNumber = lead.insurance_claim_number || lead.claimNumber || '';
  const damageNotes = lead.damage_notes || lead.damageNotes || '';
  const repName = lead.rep_first_name
    ? `${lead.rep_first_name} ${lead.rep_last_name || ''}`
    : (lead.rep || '—');

  const refreshLead = async () => {
    if (!leadId) return;
    try {
      const res = await getLeadDetail(leadId);
      setLead(res.data);
      setActivities(res.data.activities || []);
      onUpdated?.();
    } catch { /* silent */ }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !leadId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('lead_id', leadId);
      formData.append('type', file.type.startsWith('image/') ? 'photo' : 'other');
      await uploadDocument(formData);
      const res = await getDocuments({ lead_id: leadId, limit: 50 });
      setDocuments(res.data.documents || []);
    } catch { /* silent */ } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await deleteDocument(docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch { /* silent */ }
  };

  const doUpdate = async (updates) => {
    if (!leadId) return;
    setSaving(true);
    try {
      await updateLead(leadId, updates);
      const res = await getLeadDetail(leadId);
      setLead(res.data);
      setActivities(res.data.activities || []);
      onUpdated?.();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const doLogActivity = async (data) => {
    if (!leadId) return;
    setSaving(true);
    try {
      await logActivity({ lead_id: leadId, ...data });
      const res = await getLeadDetail(leadId);
      setLead(res.data);
      setActivities(res.data.activities || []);
      onUpdated?.();
    } catch {
      // silent
    } finally {
      setSaving(false);
      setActiveModal(null);
    }
  };

  const handleStageChange = (e) => {
    doUpdate({ stage: e.target.value });
  };

  const handlePriorityChange = (e) => {
    doUpdate({ priority: e.target.value });
  };

  return (
    <>
      <div className="slide-over-backdrop" onClick={onClose} />
      <div className="slide-over glass">
        <button className="slide-over__close" onClick={onClose}>
          <IconX />
        </button>

        {/* Header */}
        <div className="slide-over__header">
          <div className="slide-over__priority-row">
            <select
              className="slide-over__priority-badge-select"
              value={priority}
              onChange={handlePriorityChange}
              disabled={!leadId || saving}
              style={{
                background: priority === 'hot' ? 'oklch(0.68 0.22 25 / 0.15)' : priority === 'warm' ? 'oklch(0.78 0.17 85 / 0.15)' : 'oklch(0.72 0.19 250 / 0.15)',
                color: priority === 'hot' ? 'var(--accent-red)' : priority === 'warm' ? 'var(--accent-amber)' : 'var(--accent-blue)',
                border: '1px solid oklch(0.50 0.05 260 / 0.15)',
                borderRadius: 'var(--radius-pill)',
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
              }}
            >
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
            <select
              className="slide-over__stage-select"
              value={stage}
              onChange={handleStageChange}
              disabled={!leadId || saving}
              style={{
                background: 'oklch(0.28 0.03 260 / 0.5)',
                color: 'var(--text-secondary)',
                border: '1px solid oklch(0.40 0.02 260 / 0.15)',
                borderRadius: 'var(--radius-pill)',
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
              }}
            >
              {stageKeys.map(k => <option key={k} value={k}>{stageLabels[k]}</option>)}
            </select>
          </div>
          <div className="slide-over__name">{name}</div>
          <div className="slide-over__address">{address}{city ? `, ${city}` : ''}</div>
          <div className="slide-over__value">${Number(value).toLocaleString()}</div>
        </div>

        <div className="divider" />

        {/* Contact Info */}
        <div className="detail-section">
          <div className="detail-section__title">Contact</div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-item__label">Phone</span>
              <span className="detail-item__value">{phone}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Email</span>
              <span className="detail-item__value" style={{ wordBreak: 'break-all' }}>{email}</span>
            </div>
          </div>

          {/* Additional contacts from API */}
          {lead.contacts?.length > 0 && (
            <div style={{ marginTop: 'var(--space-sm)' }}>
              {lead.contacts.map(c => (
                <div key={c.id} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0' }}>
                  {c.first_name} {c.last_name} ({c.role})
                  {c.phone && ` \u2022 ${c.phone}`}
                  {c.is_primary && <span style={{ color: 'var(--accent-blue)', marginLeft: 4, fontSize: 10, fontWeight: 700 }}>PRIMARY</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Property Details */}
        <div className="detail-section">
          <div className="detail-section__title">Property</div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-item__label">Roof Type</span>
              <span className="detail-item__value">{roofType}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Size</span>
              <span className="detail-item__value">{sqft ? `${Number(sqft).toLocaleString()} sq ft` : '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Year Built</span>
              <span className="detail-item__value">{lead.year_built || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Rep</span>
              <span className="detail-item__value">{repName}</span>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Storm Context */}
        <div className="detail-section">
          <div className="detail-section__title">Storm & Insurance</div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-item__label">Hail Size</span>
              <span className="detail-item__value">{typeof hailSize === 'number' ? `${hailSize}"` : hailSize}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Storm Date</span>
              <span className="detail-item__value">{stormDate}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Insurance</span>
              <span className="detail-item__value">{insuranceCo}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Claim #</span>
              <span className="detail-item__value">{claimNumber || '—'}</span>
            </div>
          </div>
          {damageNotes && <div className="detail-notes">{damageNotes}</div>}
        </div>

        <div className="divider" />

        {/* Activity Timeline */}
        <div className="detail-section">
          <div className="detail-section__title">Activity ({activities.length})</div>
          <div className="timeline">
            {activities.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 'var(--space-md) 0' }}>
                No activity yet
              </div>
            ) : activities.slice(0, 20).map((item) => (
              <div key={item.id} className="timeline-item">
                <span className="timeline-item__text">
                  {item.subject || `${item.type} logged`}
                  {item.notes && <span style={{ color: 'var(--text-muted)' }}> — {item.notes}</span>}
                </span>
                <span className="timeline-item__time">
                  {item.user_first_name && `${item.user_first_name} ${item.user_last_name?.[0] || ''} \u2022 `}
                  {new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="divider" />

        {/* Tasks */}
        {lead.tasks?.length > 0 && (
          <>
            <div className="detail-section">
              <div className="detail-section__title">Tasks</div>
              {lead.tasks.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                  padding: 'var(--space-sm) 0', fontSize: 13,
                }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 4, border: '2px solid var(--glass-border)',
                    background: t.completed_at ? 'var(--accent-green)' : 'transparent',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    color: t.completed_at ? 'var(--text-muted)' : 'var(--text-secondary)',
                    textDecoration: t.completed_at ? 'line-through' : 'none',
                    flex: 1,
                  }}>{t.title}</span>
                  {t.due_date && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="divider" />
          </>
        )}

        {/* Documents */}
        {leadId && (
          <>
            <div className="detail-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="detail-section__title" style={{ margin: 0 }}>Documents ({documents.length})</div>
                <button className="quick-action-btn" onClick={() => fileInputRef.current?.click()}
                  disabled={uploading} style={{ fontSize: 11, padding: '4px 10px' }}>
                  {uploading ? 'Uploading...' : '+ Upload'}
                </button>
                <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" />
              </div>

              {documents.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                  {documents.map(doc => {
                    const isImage = doc.mime_type?.startsWith('image/');
                    return (
                      <div key={doc.id} style={{
                        position: 'relative', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                        border: '1px solid var(--glass-border)', background: 'oklch(0.16 0.02 260 / 0.5)',
                      }}>
                        {isImage ? (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <img src={doc.file_url} alt={doc.filename}
                              style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                          </a>
                        ) : (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, color: 'var(--text-muted)', fontSize: 10, textDecoration: 'none', padding: 4, textAlign: 'center', wordBreak: 'break-all' }}>
                            {doc.filename}
                          </a>
                        )}
                        <button onClick={() => handleDeleteDoc(doc.id)} style={{
                          position: 'absolute', top: 2, right: 2, background: 'oklch(0.12 0.02 260 / 0.8)',
                          border: 'none', borderRadius: 4, cursor: 'pointer', padding: 2, lineHeight: 0,
                        }}>
                          <IconTrash style={{ width: 12, height: 12, color: 'var(--accent-red)' }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="divider" />
          </>
        )}

        {/* Quick Actions */}
        <div className="detail-section">
          <div className="detail-section__title">Quick Actions</div>
          <div className="quick-actions">
            <button className="quick-action-btn" onClick={() => setActiveModal('activity')} style={{ gridColumn: '1 / -1', color: 'var(--accent-blue)' }}>
              <IconClipboard /> Log Activity...
            </button>
            <button className="quick-action-btn" onClick={() => doLogActivity({ type: 'call', subject: 'Outbound call logged' })}>
              <IconPhone /> Quick Call
            </button>
            <button className="quick-action-btn" onClick={() => doLogActivity({ type: 'email', subject: 'Email sent' })}>
              <IconMail /> Quick Email
            </button>
            <button className="quick-action-btn" onClick={() => doLogActivity({ type: 'text', subject: 'SMS sent' })}>
              <IconSend /> Quick SMS
            </button>
            <button className="quick-action-btn" onClick={() => doLogActivity({ type: 'door_knock', subject: 'Door knock visit' })}>
              <IconCamera /> Quick Visit
            </button>
          </div>
        </div>

        {/* Full Activity Modal */}
        {activeModal === 'activity' && leadId && (
          <ActivityModal
            leadId={leadId}
            onSave={() => {
              setActiveModal(null);
              refreshLead();
            }}
            onClose={() => setActiveModal(null)}
          />
        )}
      </div>
    </>
  );
}

