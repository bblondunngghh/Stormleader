import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getLeadDetail, updateLead, deleteLead, updateLeadRoofType, logActivity, getActivities, addContact } from '../api/crm';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { getDocuments, uploadDocument, deleteDocument } from '../api/documents';
import { submitTrace } from '../api/skipTrace';
import { measureRoof } from '../api/roofMeasurement';
import { IconX, IconPhone, IconMail, IconCalendar, IconClipboard, IconDollar, IconCamera, IconSend, IconTrash } from './Icons';
import streetViewIcon from '../assets/icons/street-view-new.png';
import runTraceIcon from '../assets/icons/run-trace.png';
import quickCallIcon from '../assets/icons/Phone-Actions-Add--Streamline-Ultimate.png';
import quickEmailIcon from '../assets/icons/Email-Action-Unread--Streamline-Ultimate.png';
import quickSmsIcon from '../assets/icons/Messages-Logo--Streamline-Ultimate.png';
import quickVisitIcon from '../assets/icons/Architecture-Door--Streamline-Ultimate.png';
import logActivityIcon from '../assets/icons/log-activity.png';
import removeLeadIcon from '../assets/icons/remove-lead.png';
import measureRoofIcon from '../assets/icons/Measure-Caliber-1--Streamline-Ultimate.png';
import ActivityModal from './ActivityModal';
import EmailModal from './EmailModal';

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
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // 'priority' | 'stage' | null
  const [showEstimateInfo, setShowEstimateInfo] = useState(false);
  const [openRoofType, setOpenRoofType] = useState(false);
  const [tracing, setTracing] = useState(false);
  const [traceError, setTraceError] = useState('');
  const [measuring, setMeasuring] = useState(false);
  const [measureError, setMeasureError] = useState('');
  const [showStreetView, setShowStreetView] = useState(false);
  const [mapMode, setMapMode] = useState('street'); // 'street' | 'satellite'
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
  const address = lead.address || lead.address_line1 || '—';
  const city = lead.city || lead.property_city || '';
  const state = lead.state || '';
  const zip = lead.zip || '';
  const phone = lead.contact_phone || lead.phone || '—';
  const email = lead.contact_email || lead.email || '—';
  const value = lead.estimated_value || lead.value || 0;
  const priority = lead.priority || 'warm';
  const stage = lead.stage || 'new';
  const roofType = lead.roof_type || lead.roofType || '—';
  const sqft = lead.roof_sqft || lead.property_sqft || lead.sqft || 0;
  const hailSize = lead.hail_size_in || lead.storm_hail_max || lead.hailSize || '—';
  const windSpeed = lead.storm_wind_max || null;
  const stormType = (lead.storm_type || '').toLowerCase() || null;
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

  const doLogActivity = async (data, { keepModal } = {}) => {
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
      if (!keepModal) setActiveModal(null);
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
            {/* Priority Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
                disabled={!leadId || saving}
                style={{
                  background: priority === 'hot' ? 'oklch(0.68 0.22 25 / 0.15)' : priority === 'warm' ? 'oklch(0.78 0.17 85 / 0.15)' : 'oklch(0.72 0.19 250 / 0.15)',
                  color: priority === 'hot' ? 'var(--accent-red)' : priority === 'warm' ? 'var(--accent-amber)' : 'var(--accent-blue)',
                  border: `1px solid ${priority === 'hot' ? 'oklch(0.68 0.22 25 / 0.3)' : priority === 'warm' ? 'oklch(0.78 0.17 85 / 0.3)' : 'oklch(0.72 0.19 250 / 0.3)'}`,
                  borderRadius: 'var(--radius-pill)', padding: '4px 12px',
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                {priority} ▾
              </button>
              {openDropdown === 'priority' && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
                  background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
                  borderRadius: 8, padding: 4, minWidth: 100,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}>
                  {['hot', 'warm', 'cold'].map(p => (
                    <button key={p} onClick={() => { handlePriorityChange({ target: { value: p } }); setOpenDropdown(null); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
                        fontSize: 12, fontWeight: 600, textTransform: 'uppercase', border: 'none', borderRadius: 6,
                        cursor: 'pointer',
                        background: p === priority ? 'oklch(0.25 0.03 260)' : 'transparent',
                        color: p === 'hot' ? 'var(--accent-red)' : p === 'warm' ? 'var(--accent-amber)' : 'var(--accent-blue)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'oklch(0.25 0.03 260)'}
                      onMouseLeave={e => e.currentTarget.style.background = p === priority ? 'oklch(0.25 0.03 260)' : 'transparent'}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Stage Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setOpenDropdown(openDropdown === 'stage' ? null : 'stage')}
                disabled={!leadId || saving}
                style={{
                  background: 'oklch(0.22 0.02 260 / 0.8)',
                  color: 'var(--text-secondary)',
                  border: '1px solid oklch(0.35 0.02 260)',
                  borderRadius: 'var(--radius-pill)', padding: '4px 12px',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {stageLabels[stage] || stage} ▾
              </button>
              {openDropdown === 'stage' && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
                  background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
                  borderRadius: 8, padding: 4, minWidth: 140,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  maxHeight: 280, overflowY: 'auto',
                }}>
                  {stageKeys.map(k => (
                    <button key={k} onClick={() => { handleStageChange({ target: { value: k } }); setOpenDropdown(null); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
                        fontSize: 12, fontWeight: 500, border: 'none', borderRadius: 6, cursor: 'pointer',
                        background: k === stage ? 'oklch(0.25 0.03 260)' : 'transparent',
                        color: k === stage ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'oklch(0.25 0.03 260)'}
                      onMouseLeave={e => e.currentTarget.style.background = k === stage ? 'oklch(0.25 0.03 260)' : 'transparent'}
                    >
                      {stageLabels[k]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="slide-over__name">{name}</div>
          <div className="slide-over__address">{address}{city && !address?.toUpperCase().includes(city?.toUpperCase()) ? `, ${city}` : ''}{state && !address?.includes(state) ? `, ${state}` : ''}{zip && !address?.includes(zip) ? ` ${zip}` : ''}</div>
          <div className="slide-over__value" style={{ position: 'relative' }}>
            ${Number(value).toLocaleString()}
            {value > 0 && (
              <>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6, verticalAlign: 'baseline' }}>
                  est. repair
                  <button
                    onClick={() => setShowEstimateInfo(!showEstimateInfo)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4,
                      padding: 0, verticalAlign: 'middle', opacity: 0.45, display: 'inline-flex',
                    }}
                    title="How is this calculated?"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </button>
                </span>
                {showEstimateInfo && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowEstimateInfo(false)} />
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 100,
                      background: 'oklch(0.14 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
                      borderRadius: 10, padding: '16px 18px', width: 340,
                      boxShadow: '0 12px 40px rgba(0,0,0,0.6)', fontSize: 12, lineHeight: 1.6,
                      color: 'var(--text-secondary)',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 10 }}>
                        Estimate Breakdown
                      </div>

                      {/* This lead's specific calc */}
                      <div style={{ background: 'oklch(0.18 0.02 260)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, border: '1px solid oklch(0.25 0.02 260)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Lead</div>
                        {lead.roof_sqft ? (
                          <div>
                            {Number(lead.roof_sqft).toLocaleString()} sqft × ${(({ composition: 5.5, asphalt: 5.5, metal: 8, slate: 12, tile: 9.5, wood: 7, 'built-up': 6 })[(lead.roof_type || '').toLowerCase()] || 6).toFixed(2)}/sqft
                            {(lead.roof_type && lead.roof_type !== '—') ? ` (${lead.roof_type})` : ' (default)'} × {(() => {
                              const h = lead.hail_size_in ? parseFloat(lead.hail_size_in) : 0;
                              const w = lead.storm_wind_max ? parseFloat(lead.storm_wind_max) : 0;
                              let df = 0.3;
                              if (h >= 2.5) df = 1.0; else if (h >= 1.75) df = 0.8; else if (h >= 1.25) df = 0.6; else if (h >= 1.0) df = 0.45; else if (h >= 0.75) df = 0.35;
                              if (w >= 80) df = Math.min(df + 0.2, 1.0); else if (w >= 60) df = Math.min(df + 0.1, 1.0);
                              return `${(df * 100).toFixed(0)}% damage`;
                            })()}
                          </div>
                        ) : lead.assessed_value ? (
                          <div>
                            ${Number(lead.assessed_value).toLocaleString()} assessed × 2% × {(() => {
                              const h = lead.hail_size_in ? parseFloat(lead.hail_size_in) : 0;
                              const w = lead.storm_wind_max ? parseFloat(lead.storm_wind_max) : 0;
                              let df = 0.3;
                              if (h >= 2.5) df = 1.0; else if (h >= 1.75) df = 0.8; else if (h >= 1.25) df = 0.6; else if (h >= 1.0) df = 0.45; else if (h >= 0.75) df = 0.35;
                              if (w >= 80) df = Math.min(df + 0.2, 1.0); else if (w >= 60) df = Math.min(df + 0.1, 1.0);
                              return `${(df * 100).toFixed(0)}% damage / 0.6`;
                            })()}
                          </div>
                        ) : (
                          <div>$8,500 default × damage factor (no roof or value data)</div>
                        )}
                        <div style={{ color: 'var(--accent-green)', fontWeight: 700, marginTop: 4 }}>= ${Number(value).toLocaleString()}</div>
                      </div>

                      <div style={{ fontWeight: 600, marginBottom: 4 }}>1. Cost per sqft by roof type</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 12px', marginBottom: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>Composition/Asphalt: $5.50</span><span>Metal: $8.00</span>
                        <span>Slate: $12.00</span><span>Tile: $9.50</span>
                        <span>Wood: $7.00</span><span>Built-up: $6.00</span>
                        <span>Unknown: $6.00</span>
                      </div>

                      <div style={{ fontWeight: 600, marginBottom: 4 }}>2. Damage factor (hail size)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 12px', marginBottom: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>≥2.5″ → 100%</span><span>≥1.75″ → 80%</span>
                        <span>≥1.25″ → 60%</span><span>≥1.0″ → 45%</span>
                        <span>≥0.75″ → 35%</span><span>Wind-only → 30%</span>
                      </div>

                      <div style={{ fontWeight: 600, marginBottom: 4 }}>3. Wind speed boost</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                        ≥80 mph → +20% &nbsp;|&nbsp; ≥60 mph → +10% &nbsp;(capped at 100%)
                      </div>

                      <div style={{ fontWeight: 600, marginBottom: 4 }}>4. Calculation</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        <div>① Roof sqft known → sqft × rate × damage%</div>
                        <div>② Assessed value → value × 2% × damage% / 0.6</div>
                        <div>③ No data → $8,500 × damage%</div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
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

          {/* Run Trace Button */}
          {leadId && lead.property_id && (
            <div style={{ marginTop: 'var(--space-sm)' }}>
              <button
                onClick={async () => {
                  setTracing(true);
                  setTraceError('');
                  try {
                    await submitTrace([lead.property_id]);
                    await refreshLead();
                  } catch (err) {
                    setTraceError(err.response?.data?.error || 'Trace failed. Check Settings > Skip Tracing.');
                  } finally {
                    setTracing(false);
                  }
                }}
                disabled={tracing}
                className="icon-spin-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 0', fontSize: 12, fontWeight: 600,
                  background: 'none', border: 'none',
                  color: (phone === '—' && email === '—') ? 'var(--accent-blue)' : 'var(--text-muted)',
                  cursor: tracing ? 'not-allowed' : 'pointer',
                  opacity: tracing ? 0.5 : 0.85,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { if (!tracing) e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = tracing ? '0.5' : '0.85'; }}
              >
                <img src={runTraceIcon} alt="" style={{ width: 16, height: 16 }} />
                {tracing ? 'Tracing...' : (phone === '—' && email === '—') ? 'Run Trace' : 'Re-trace'}
              </button>
              {traceError && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{traceError}</div>}
              <div style={{ fontSize: 10, color: 'var(--accent-red)', marginTop: 4, opacity: 0.5 }}>
                Each trace will be added to your monthly bill.
              </div>
            </div>
          )}

          {/* Measure Roof Button */}
          {leadId && lead.property_id && (
            <div style={{ marginTop: 'var(--space-sm)' }}>
              <button
                onClick={async () => {
                  setMeasuring(true);
                  setMeasureError('');
                  try {
                    await measureRoof(lead.property_id);
                    await refreshLead();
                  } catch (err) {
                    setMeasureError(err.response?.data?.error || 'Measurement failed. Check Settings > Add-Ons.');
                  } finally {
                    setMeasuring(false);
                  }
                }}
                disabled={measuring}
                className="icon-spin-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 0', fontSize: 12, fontWeight: 600,
                  background: 'none', border: 'none',
                  color: !lead.roof_pitch_degrees ? 'var(--accent-blue)' : 'var(--text-muted)',
                  cursor: measuring ? 'not-allowed' : 'pointer',
                  opacity: measuring ? 0.5 : 0.85,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { if (!measuring) e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = measuring ? '0.5' : '0.85'; }}
              >
                <img src={measureRoofIcon} alt="" style={{ width: 16, height: 16 }} />
                {measuring ? 'Measuring...' : lead.roof_pitch_degrees ? 'Re-measure' : 'Measure Roof'}
              </button>
              {measureError && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{measureError}</div>}
              <div style={{ fontSize: 10, color: 'var(--accent-red)', marginTop: 4, opacity: 0.5 }}>
                Each measurement will be added to your monthly bill.
              </div>
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Property Details */}
        <div className="detail-section">
          <div className="detail-section__title">Property</div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-item__label">Assessed Value</span>
              <span className="detail-item__value" style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                {lead.assessed_value ? `$${Number(lead.assessed_value).toLocaleString()}` : '—'}
              </span>
            </div>
            <div className="detail-item" style={{ position: 'relative' }}>
              <span className="detail-item__label">Roof Type</span>
              {leadId ? (
                <>
                  <button
                    onClick={() => setOpenRoofType(!openRoofType)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      color: roofType === '—' ? 'var(--text-muted)' : 'var(--text-primary)',
                      fontSize: 13, fontWeight: 500, textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {roofType === '—' ? 'Select type ▾' : <>{roofType} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▾</span></>}
                  </button>
                  {openRoofType && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpenRoofType(false)} />
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
                        background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
                        borderRadius: 8, padding: 4, minWidth: 140,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      }}>
                        {['Composition', 'Asphalt', 'Metal', 'Slate', 'Tile', 'Wood', 'Built-Up'].map(t => (
                          <button key={t} onClick={async () => {
                            setOpenRoofType(false);
                            setSaving(true);
                            try {
                              const res = await updateLeadRoofType(leadId, t.toLowerCase());
                              setLead(res.data);
                              onUpdated?.();
                            } catch { /* silent */ } finally {
                              setSaving(false);
                            }
                          }}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
                              fontSize: 12, fontWeight: 500, border: 'none', borderRadius: 6, cursor: 'pointer',
                              background: roofType.toLowerCase() === t.toLowerCase() ? 'oklch(0.25 0.03 260)' : 'transparent',
                              color: roofType.toLowerCase() === t.toLowerCase() ? 'var(--accent-blue)' : 'var(--text-secondary)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'oklch(0.25 0.03 260)'}
                            onMouseLeave={e => e.currentTarget.style.background = roofType.toLowerCase() === t.toLowerCase() ? 'oklch(0.25 0.03 260)' : 'transparent'}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <span className="detail-item__value">{roofType}</span>
              )}
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Roof Size</span>
              <span className="detail-item__value">{lead.roof_sqft ? `${Number(lead.roof_sqft).toLocaleString()} sq ft` : '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Roof Pitch</span>
              <span className="detail-item__value">{lead.roof_pitch_degrees ? `${Number(lead.roof_pitch_degrees).toFixed(1)}°` : '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Roof Segments</span>
              <span className="detail-item__value">{lead.roof_segments || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Property Size</span>
              <span className="detail-item__value">{lead.property_sqft ? `${Number(lead.property_sqft).toLocaleString()} sq ft` : '—'}</span>
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
          {address !== '—' && (
            <button
              onClick={() => setShowStreetView(true)}
              className="icon-spin-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, marginTop: 'var(--space-md)',
                padding: '6px 0', fontSize: 12, fontWeight: 600,
                background: 'none', border: 'none',
                color: 'var(--accent-blue)', cursor: 'pointer',
                opacity: 0.85, transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}
            >
              <img src={streetViewIcon} alt="" style={{ width: 16, height: 16 }} />
              Street View
            </button>
          )}
        </div>

        <div className="divider" />

        {/* Storm Context */}
        <div className="detail-section">
          <div className="detail-section__title">Storm & Insurance</div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-item__label">Storm Type</span>
              <span className="detail-item__value" style={{
                color: stormType === 'tornado' ? '#ff2d55' : stormType === 'hail' ? '#dcb428' : '#6c5ce7',
                fontWeight: 600, textTransform: 'capitalize',
              }}>
                {stormType || '—'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Storm Date</span>
              <span className="detail-item__value">{stormDate}</span>
            </div>
            {(stormType === 'hail' || hailSize !== '—') && (
              <div className="detail-item">
                <span className="detail-item__label">Hail Size</span>
                <span className="detail-item__value">{typeof hailSize === 'number' ? `${hailSize}"` : hailSize}</span>
              </div>
            )}
            {windSpeed && (
              <div className="detail-item">
                <span className="detail-item__label">Wind Speed</span>
                <span className="detail-item__value">{windSpeed} mph</span>
              </div>
            )}
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
              <img src={logActivityIcon} alt="" style={{ width: 18, height: 18 }} /> Log Activity...
            </button>
            <button className="quick-action-btn" onClick={() => setActiveModal('call')}>
              <img src={quickCallIcon} alt="" style={{ width: 18, height: 18 }} /> Quick Call
            </button>
            <button className="quick-action-btn" onClick={() => setActiveModal('email')}>
              <img src={quickEmailIcon} alt="" style={{ width: 18, height: 18 }} /> Quick Email
            </button>
            <button className="quick-action-btn" onClick={() => setActiveModal('sms')}>
              <img src={quickSmsIcon} alt="" style={{ width: 18, height: 18 }} /> Quick SMS
            </button>
            <button className="quick-action-btn" onClick={() => setActiveModal('visit')}>
              <img src={quickVisitIcon} alt="" style={{ width: 18, height: 18 }} /> Quick Visit
            </button>
          </div>
        </div>

        {/* Remove Lead */}
        {leadId && (
          <>
            <div className="divider" />
            <div className="detail-section">
              {!confirmRemove ? (
                <button
                  onClick={() => setConfirmRemove(true)}
                  style={{
                    width: '100%', padding: '10px 16px', fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: 'transparent', color: 'var(--accent-red)',
                    border: '1px solid oklch(0.68 0.22 25 / 0.25)', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  <img src={removeLeadIcon} alt="" style={{ width: 18, height: 18 }} /> Remove Lead
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Remove this lead from the pipeline?</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={async () => {
                        setSaving(true);
                        try {
                          await deleteLead(leadId);
                          onUpdated?.();
                          onClose();
                        } catch { /* silent */ } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                      style={{
                        flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 600,
                        background: 'var(--accent-red)', color: '#fff',
                        border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      }}
                    >
                      {saving ? 'Removing...' : 'Yes, Remove'}
                    </button>
                    <button
                      onClick={() => setConfirmRemove(false)}
                      style={{
                        flex: 1, padding: '8px 12px', fontSize: 12, fontWeight: 600,
                        background: 'oklch(0.28 0.03 260 / 0.5)', color: 'var(--text-secondary)',
                        border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

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

      {/* Email Modal — rendered outside slide-over for proper z-index */}
      {activeModal === 'email' && leadId && (
        <EmailModal
          leadId={leadId}
          lead={lead}
          onSave={() => {
            setActiveModal(null);
            refreshLead();
          }}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Quick Call Modal */}
      {activeModal === 'call' && lead && createPortal(
        <>
          <div className="slide-over-backdrop" onClick={() => setActiveModal(null)} style={{ zIndex: 200 }} />
          <div className="slide-over glass" style={{ width: 400, zIndex: 201 }}>
            <button className="slide-over__close" onClick={() => setActiveModal(null)}><IconX /></button>

            <div className="slide-over__header" style={{ paddingRight: 40 }}>
              <div className="slide-over__name">Quick Call</div>
            </div>

            <div className="divider" />

            {/* Contact Info */}
            <div className="detail-section">
              <div className="detail-section__title">Customer Name</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>{name}</div>

              {phone && phone !== '—' ? (
                <a
                  href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-sm)',
                    width: '100%', height: 48, borderRadius: 'var(--radius-md)', fontSize: 16, fontWeight: 700,
                    background: 'var(--accent-green)', color: 'oklch(0.12 0.02 260)',
                    textDecoration: 'none', cursor: 'pointer',
                  }}
                  onClick={() => {
                    doLogActivity({ type: 'call', subject: `Called ${name}`, notes: `Dialed ${phone}` }, { keepModal: true });
                  }}
                >
                  <img src={quickCallIcon} alt="" width="20" height="20" />
                  {phone}
                </a>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: 48, borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600,
                  background: 'oklch(0.18 0.02 260 / 0.6)', color: 'var(--text-muted)',
                  border: '1px solid var(--glass-border)',
                }}>
                  No phone number on file
                </div>
              )}
            </div>

            <div className="detail-section">
              <div className="detail-section__title">Address</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {address}{city && !address?.toUpperCase().includes(city?.toUpperCase()) ? `, ${city}` : ''}{state ? `, ${state}` : ''}
              </div>
            </div>

            {/* Property & Storm Details */}
            <div className="detail-section">
              <div className="detail-section__title">Property Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm) var(--space-lg)' }}>
                {lead.roof_sqft && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Roof Size</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{Number(lead.roof_sqft).toLocaleString()} sq ft</div>
                  </div>
                )}
                {lead.roof_type && lead.roof_type !== '—' && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Material</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'capitalize' }}>{lead.roof_type}</div>
                  </div>
                )}
                {lead.year_built && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Year Built</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{lead.year_built}</div>
                  </div>
                )}
                {lead.assessed_value && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assessed Value</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>${Number(lead.assessed_value).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-section__title">Storm & Estimate</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm) var(--space-lg)' }}>
                {lead.hail_size_in && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hail Size</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{lead.hail_size_in}"</div>
                  </div>
                )}
                {lead.storm_wind_max && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Wind Speed</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{lead.storm_wind_max} mph</div>
                  </div>
                )}
                {lead.estimated_value && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Est. Repair</div>
                    <div style={{ fontSize: 13, color: 'var(--accent-green)', fontWeight: 700 }}>${Number(lead.estimated_value).toLocaleString()}</div>
                  </div>
                )}
                {lead.priority && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Priority</div>
                    <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize', color: lead.priority === 'hot' ? 'var(--accent-red)' : lead.priority === 'warm' ? 'var(--accent-amber)' : 'var(--accent-blue)' }}>{lead.priority}</div>
                  </div>
                )}
              </div>
            </div>

            {email && email !== '—' && (
              <div className="detail-section">
                <div className="detail-section__title">Email</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{email}</div>
              </div>
            )}

            <div className="divider" />

            <button
              className="quick-action-btn"
              onClick={() => setActiveModal(null)}
              style={{ alignSelf: 'flex-end', padding: '8px 20px' }}
            >
              Close
            </button>
          </div>
        </>,
        document.body
      )}

      {/* Quick SMS Modal */}
      {activeModal === 'sms' && lead && createPortal(
        <>
          <div className="slide-over-backdrop" onClick={() => setActiveModal(null)} style={{ zIndex: 200 }} />
          <div className="slide-over glass" style={{ width: 420, zIndex: 201 }}>
            <button className="slide-over__close" onClick={() => setActiveModal(null)}><IconX /></button>

            <div className="slide-over__header" style={{ paddingRight: 40 }}>
              <div className="slide-over__name">Quick SMS</div>
            </div>

            <div className="divider" />

            <div className="detail-section">
              <div className="detail-section__title">Customer Name</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{name}</div>
            </div>

            <div className="detail-section">
              <div className="detail-section__title">Phone Number</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{phone !== '—' ? phone : 'No phone number on file'}</div>
            </div>

            <div className="detail-section">
              <div className="detail-section__title">Message</div>
              <SmsComposer name={name} phone={phone} lead={lead} address={address} city={city} state={state} />
            </div>

            <div className="divider" />

            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
              <button className="quick-action-btn" onClick={() => setActiveModal(null)} style={{ padding: '8px 20px' }}>
                Close
              </button>
              {phone && phone !== '—' && (
                <a
                  id="sms-send-link"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    const msgEl = document.getElementById('sms-message-input');
                    const msg = msgEl ? msgEl.value : '';
                    const cleanPhone = phone.replace(/[^\d+]/g, '');
                    window.open(`sms:${cleanPhone}${msg ? `?body=${encodeURIComponent(msg)}` : ''}`, '_self');
                    doLogActivity({ type: 'text', subject: `SMS to ${name}`, notes: msg || 'SMS sent' }, { keepModal: true });
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-xs)',
                    height: 36, padding: '0 20px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700,
                    background: 'var(--accent-blue)', color: 'oklch(0.12 0.02 260)',
                    textDecoration: 'none', cursor: 'pointer', border: 'none',
                  }}
                >
                  <img src={quickSmsIcon} alt="" width="16" height="16" /> Send SMS
                </a>
              )}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Quick Visit Modal */}
      {activeModal === 'visit' && lead && createPortal(
        <>
          <div className="slide-over-backdrop" onClick={() => setActiveModal(null)} style={{ zIndex: 200 }} />
          <div className="slide-over glass" style={{ width: 420, zIndex: 201 }}>
            <button className="slide-over__close" onClick={() => setActiveModal(null)}><IconX /></button>

            <div className="slide-over__header" style={{ paddingRight: 40 }}>
              <div className="slide-over__name">Quick Visit</div>
            </div>

            <div className="divider" />

            <div className="detail-section">
              <div className="detail-section__title">Customer Name</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{name}</div>
            </div>

            <div className="detail-section">
              <div className="detail-section__title">Address</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
                {address}{city && !address?.toUpperCase().includes(city?.toUpperCase()) ? `, ${city}` : ''}{state ? `, ${state}` : ''}{zip ? ` ${zip}` : ''}
              </div>
              {lead.property_geometry?.coordinates && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${lead.property_geometry.coordinates[1]},${lead.property_geometry.coordinates[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-sm)',
                    width: '100%', height: 40, borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700,
                    background: 'var(--accent-blue)', color: 'oklch(0.12 0.02 260)',
                    textDecoration: 'none', cursor: 'pointer',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                  Get Directions
                </a>
              )}
            </div>

            {(lead.roof_sqft || lead.roof_type || lead.year_built) && (
              <div className="detail-section">
                <div className="detail-section__title">Property Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm) var(--space-lg)' }}>
                  {lead.roof_sqft && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Roof Size</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{Number(lead.roof_sqft).toLocaleString()} sq ft</div>
                    </div>
                  )}
                  {lead.roof_type && lead.roof_type !== '—' && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Material</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'capitalize' }}>{lead.roof_type}</div>
                    </div>
                  )}
                  {lead.year_built && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Year Built</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{lead.year_built}</div>
                    </div>
                  )}
                  {lead.assessed_value && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assessed Value</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>${Number(lead.assessed_value).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="detail-section">
              <div className="detail-section__title">Storm & Estimate</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm) var(--space-lg)' }}>
                {lead.hail_size_in && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hail Size</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{lead.hail_size_in}"</div>
                  </div>
                )}
                {lead.estimated_value && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Est. Repair</div>
                    <div style={{ fontSize: 13, color: 'var(--accent-green)', fontWeight: 700 }}>${Number(lead.estimated_value).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>

            {phone && phone !== '—' && (
              <div className="detail-section">
                <div className="detail-section__title">Phone</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{phone}</div>
              </div>
            )}

            <div className="divider" />

            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
              <button className="quick-action-btn" onClick={() => setActiveModal(null)} style={{ padding: '8px 20px' }}>
                Close
              </button>
              <button
                onClick={() => {
                  doLogActivity({ type: 'door_knock', subject: `Door knock at ${address}` }, { keepModal: true });
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
                  height: 36, padding: '0 20px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700,
                  background: 'var(--accent-blue)', color: 'oklch(0.12 0.02 260)',
                  border: 'none', cursor: 'pointer',
                }}
              >
                <img src={quickVisitIcon} alt="" width="16" height="16" /> Log Visit
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Street View Modal — portaled to document.body to escape sidebar stacking context */}
      {showStreetView && (() => {
        const geo = lead.property_geometry;
        const lat = geo?.coordinates?.[1];
        const lng = geo?.coordinates?.[0];
        const fullAddr = `${address}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}${zip ? ` ${zip}` : ''}`;
        const embedSrc = lat && lng
          ? `https://maps.google.com/maps?cbll=${lat},${lng}&cbp=12,0,,0,0&layer=c&output=svembed`
          : `https://maps.google.com/maps?q=${encodeURIComponent(fullAddr)}&layer=c&output=svembed`;
        const satelliteSrc = lat && lng
          ? `https://maps.google.com/maps?q=${lat},${lng}&t=k&z=19&output=embed`
          : `https://maps.google.com/maps?q=${encodeURIComponent(fullAddr)}&t=k&z=19&output=embed`;
        const mapsLink = lat && lng
          ? `https://www.google.com/maps/@${lat},${lng},3a,75y,0h,90t`
          : `https://www.google.com/maps/search/${encodeURIComponent(fullAddr)}`;

        return createPortal(
          <>
            <div onClick={() => { setShowStreetView(false); setMapMode('street'); }} style={{
              position: 'fixed', inset: 0, zIndex: 99998,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              zIndex: 99999, width: '90vw', maxWidth: 800, background: 'oklch(0.14 0.02 260)',
              border: '1px solid oklch(0.30 0.02 260)', borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid oklch(0.25 0.02 260)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {mapMode === 'street' ? 'Street View' : 'Satellite'} — {address}
                  </span>
                  <div style={{ display: 'flex', gap: 2, background: 'oklch(0.20 0.02 260)', borderRadius: 6, padding: 2 }}>
                    <button onClick={() => setMapMode('street')} style={{
                      padding: '3px 8px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer',
                      background: mapMode === 'street' ? 'var(--accent-blue)' : 'transparent',
                      color: mapMode === 'street' ? '#fff' : 'var(--text-muted)',
                    }}>Street</button>
                    <button onClick={() => setMapMode('satellite')} style={{
                      padding: '3px 8px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer',
                      background: mapMode === 'satellite' ? 'var(--accent-blue)' : 'transparent',
                      color: mapMode === 'satellite' ? '#fff' : 'var(--text-muted)',
                    }}>Satellite</button>
                  </div>
                </div>
                <button onClick={() => { setShowStreetView(false); setMapMode('street'); }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  fontSize: 18, lineHeight: 1, padding: '0 4px',
                }}>✕</button>
              </div>
              <iframe
                key={mapMode}
                src={mapMode === 'street' ? embedSrc : satelliteSrc}
                style={{ width: '100%', height: '55vh', border: 'none', display: 'block' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div style={{
                padding: '8px 16px', borderTop: '1px solid oklch(0.25 0.02 260)',
                display: 'flex', justifyContent: 'flex-end',
              }}>
                <a href={mapsLink} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: 'var(--accent-blue)', textDecoration: 'none' }}>
                  Open in Google Maps ↗
                </a>
              </div>
            </div>
          </>,
          document.body
        );
      })()}
    </>
  );
}

const smsTemplates = [
  { label: 'Introduction', text: (name, rep, co) => `Hi ${name}, this is ${rep} from ${co} — we noticed recent storm activity in your area and wanted to check if your roof sustained any damage. Would you be open to a free inspection?` },
  { label: 'Follow-up', text: (name, rep, co) => `Hi ${name}, this is ${rep} from ${co} just following up on the storm damage in your neighborhood. We have availability this week for a free roof inspection. Let me know if you're interested!` },
  { label: 'Appointment', text: (name, rep, co) => `Hi ${name}, this is ${rep} from ${co} confirming your roof inspection appointment. Please let us know if you need to reschedule. Thanks!` },
];

function SmsComposer({ name }) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [companyName, setCompanyName] = useState('our company');
  const customerName = name !== '—' ? name.split(' ')[0] : 'there';
  const repName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'your rep' : 'your rep';

  useEffect(() => {
    client.get('/crm/tenant-settings')
      .then(res => { if (res.data.name) setCompanyName(res.data.name); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
        {smsTemplates.map((t, i) => (
          <button
            key={i}
            type="button"
            className="activity-type-btn"
            onClick={() => setMessage(t.text(customerName, repName, companyName))}
            style={{ fontSize: 11 }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        id="sms-message-input"
        className="form-input"
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message..."
        style={{ resize: 'vertical', fontSize: 13 }}
      />
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{message.length} / 160 characters</div>
    </div>
  );
}

