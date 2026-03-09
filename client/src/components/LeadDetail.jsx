import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getLeadDetail, updateLead, deleteLead, updateLeadRoofType, logActivity, getActivities, addContact } from '../api/crm';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { getDocuments, uploadDocument, deleteDocument } from '../api/documents';
import { submitTrace } from '../api/skipTrace';
import { measureRoof, manualRoofEntry, getSolarSegments } from '../api/roofMeasurement';
import { updatePropertyLocation } from '../api/storms';
import mapboxgl from 'mapbox-gl';
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
import insuranceReportIcon from '../assets/icons/Check-Badge--Streamline-Ultimate.svg';
import RoofDrawingTool from './RoofDrawingTool';
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
  const [showManualRoof, setShowManualRoof] = useState(false);
  const [manualRoofSqft, setManualRoofSqft] = useState('');
  const [manualRoofPitch, setManualRoofPitch] = useState('');
  const [savingManualRoof, setSavingManualRoof] = useState(false);
  const [showRoofDrawing, setShowRoofDrawing] = useState(false);
  const [solarSegments, setSolarSegments] = useState([]);
  const [roofOutline, setRoofOutline] = useState([]);
  const [showStreetView, setShowStreetView] = useState(false);
  const [mapMode, setMapMode] = useState('street'); // 'street' | 'satellite' | 'adjust'
  const [savingPin, setSavingPin] = useState(false);
  const adjustMapRef = useRef(null);
  const adjustMarkerRef = useRef(null);
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

  // Fetch solar segments when drawing tool opens
  useEffect(() => {
    if (!showRoofDrawing || !lead?.property_id || !lead?.roof_sqft) return;
    getSolarSegments(lead.property_id)
      .then(data => {
        setSolarSegments(data.segments || []);
        setRoofOutline(data.outline || []);
      })
      .catch(() => {});
  }, [showRoofDrawing, lead?.property_id, lead?.roof_sqft]);

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
              {measureError && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--accent-red)' }}>{measureError}</div>
                  <button
                    onClick={() => setShowRoofDrawing(true)}
                    style={{
                      background: 'none', border: 'none', color: 'var(--accent-blue)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline',
                    }}
                  >
                    Draw roof measurements on map
                  </button>
                </div>
              )}
              {!measureError && (
                <div style={{ fontSize: 10, color: 'var(--accent-red)', marginTop: 4, opacity: 0.5 }}>
                  Each measurement will be added to your monthly bill.
                </div>
              )}
              <button
                onClick={() => setShowRoofDrawing(true)}
                style={{
                  background: 'none', border: 'none', color: 'var(--accent-blue)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline',
                  marginTop: 2,
                }}
              >
                {lead.roof_sqft ? 'Draw to add missing edges' : 'Draw roof measurements on map'}
              </button>
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
            {lead.roof_ridge_ft > 0 && (
              <>
                <div className="detail-item">
                  <span className="detail-item__label">Ridge</span>
                  <span className="detail-item__value">{Number(lead.roof_ridge_ft).toLocaleString()} ft</span>
                </div>
                <div className="detail-item">
                  <span className="detail-item__label">Eave</span>
                  <span className="detail-item__value">{Number(lead.roof_eave_ft).toLocaleString()} ft</span>
                </div>
                <div className="detail-item">
                  <span className="detail-item__label">Rake</span>
                  <span className="detail-item__value">{Number(lead.roof_rake_ft).toLocaleString()} ft</span>
                </div>
                {lead.roof_valley_ft > 0 && (
                  <div className="detail-item">
                    <span className="detail-item__label">Valley</span>
                    <span className="detail-item__value">{Number(lead.roof_valley_ft).toLocaleString()} ft</span>
                  </div>
                )}
                {lead.roof_hip_ft > 0 && (
                  <div className="detail-item">
                    <span className="detail-item__label">Hip</span>
                    <span className="detail-item__value">{Number(lead.roof_hip_ft).toLocaleString()} ft</span>
                  </div>
                )}
                <div className="detail-item">
                  <span className="detail-item__label">Drip Edge</span>
                  <span className="detail-item__value">{Number(lead.roof_drip_edge_ft).toLocaleString()} ft</span>
                </div>
                <div className="detail-item">
                  <span className="detail-item__label">Flashing</span>
                  <span className="detail-item__value">{Number(lead.roof_flashing_ft).toLocaleString()} ft</span>
                </div>
              </>
            )}
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
            <button className="quick-action-btn" onClick={() => setActiveModal('insurance')}>
              <img src={insuranceReportIcon} alt="" style={{ width: 18, height: 18 }} /> Insurance Report
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

      {/* Insurance Report Modal — PDF-style preview */}
      {activeModal === 'insurance' && lead && (() => {
        const geo = lead.property_geometry;
        const lat = geo?.coordinates?.[1];
        const lng = geo?.coordinates?.[0];
        const fullAddr = `${address}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}${zip ? ` ${zip}` : ''}`;
        const h = lead.hail_size_in ? parseFloat(lead.hail_size_in) : 0;
        const w = lead.storm_wind_max ? parseFloat(lead.storm_wind_max) : 0;
        let df = 0.3;
        if (h >= 2.5) df = 1.0; else if (h >= 1.75) df = 0.8; else if (h >= 1.25) df = 0.6; else if (h >= 1.0) df = 0.45; else if (h >= 0.75) df = 0.35;
        if (w >= 80) df = Math.min(df + 0.2, 1.0); else if (w >= 60) df = Math.min(df + 0.1, 1.0);
        let severity = 'Assessment pending';
        if (h >= 2.5) severity = 'Severe — Full replacement likely';
        else if (h >= 1.75) severity = 'Significant — Major repairs needed';
        else if (h >= 1.25) severity = 'Moderate — Partial damage expected';
        else if (h >= 0.75) severity = 'Minor — Inspect for granule loss';
        const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const mapToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
        const roofSquares = lead.roof_sqft ? (lead.roof_sqft / 100).toFixed(1) : null;
        const measureSrc = lead.roof_measurement_source === 'google_solar' ? 'Google Solar API (satellite)' : lead.roof_measurement_source === 'manual' ? 'Manual measurement' : null;

        // Row helper for PDF table
        const R = (label, val, highlight) => (
          <tr>
            <td style={{ padding: '4px 8px', fontSize: 11, color: '#666', borderBottom: '1px solid #eee', width: '45%' }}>{label}</td>
            <td style={{ padding: '4px 8px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid #eee', color: highlight ? '#c0392b' : '#1a1a1a' }}>{val}</td>
          </tr>
        );

        const handlePrint = () => {
          // Capture the map as an image
          const reportMapEl = document.getElementById('insurance-report-map');
          let mapImgSrc = '';
          if (reportMapEl) {
            const canvas = reportMapEl.querySelector('canvas');
            if (canvas) mapImgSrc = canvas.toDataURL('image/png');
          }

          const win = window.open('', '_blank');
          win.document.write(`<!DOCTYPE html><html><head><title>Weather Damage Report - ${fullAddr}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px 40px; color: #1a1a1a; font-size: 12px; line-height: 1.5; }
              h1 { font-size: 18px; margin-bottom: 2px; }
              h2 { font-size: 12px; font-weight: 700; margin: 16px 0 6px; padding: 4px 8px; background: #f0f0f0; text-transform: uppercase; letter-spacing: 0.5px; }
              .header { border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
              .subtitle { font-size: 10px; color: #666; }
              table { width: 100%; border-collapse: collapse; }
              td { padding: 3px 8px; font-size: 11px; border-bottom: 1px solid #eee; }
              .label { color: #666; width: 45%; }
              .val { font-weight: 600; }
              .highlight { color: #c0392b; }
              .map-img { width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px; margin: 8px 0; }
              .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; }
              .disclaimer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 9px; color: #999; line-height: 1.4; }
              .sig-area { margin-top: 32px; display: flex; justify-content: space-between; }
              .sig-line { border-top: 1px solid #333; width: 200px; padding-top: 4px; font-size: 10px; color: #666; }
              @media print { body { padding: 16px 24px; } @page { margin: 0.5in; } }
            </style>
          </head><body>
            <div class="header">
              <div>
                <h1>Weather Damage Verification Report</h1>
                <div class="subtitle">For insurance claim documentation and adjuster review</div>
              </div>
              <div style="text-align:right;font-size:10px;color:#666;">
                <div>Report Date: ${reportDate}</div>
                <div>Date of Loss: ${stormDate}</div>
              </div>
            </div>

            <div class="two-col">
              <div>
                <h2>Property Information</h2>
                <table>
                  <tr><td class="label">Address</td><td class="val">${fullAddr}</td></tr>
                  <tr><td class="label">Property Owner</td><td class="val">${name}</td></tr>
                  <tr><td class="label">Year Built</td><td class="val">${lead.year_built || 'N/A'}</td></tr>
                  <tr><td class="label">Assessed Value</td><td class="val">${lead.assessed_value ? '$' + Number(lead.assessed_value).toLocaleString() : 'N/A'}</td></tr>
                  ${lead.county_parcel_id ? `<tr><td class="label">Parcel ID</td><td class="val">${lead.county_parcel_id}</td></tr>` : ''}
                </table>
              </div>
              <div>
                <h2>Weather Event</h2>
                <table>
                  <tr><td class="label">Date of Loss</td><td class="val">${stormDate}</td></tr>
                  <tr><td class="label">Storm Type</td><td class="val">${stormType ? stormType.charAt(0).toUpperCase() + stormType.slice(1) : 'N/A'}</td></tr>
                  <tr><td class="label">Max Hail Size</td><td class="val highlight">${hailSize !== '—' ? hailSize + '"' : 'N/A'}</td></tr>
                  <tr><td class="label">Max Wind Speed</td><td class="val">${windSpeed ? windSpeed + ' mph' : 'N/A'}</td></tr>
                </table>
                <div style="font-size:9px;color:#999;margin-top:4px;padding:0 8px;">Source: NOAA/NWS Storm Prediction Center</div>
              </div>
            </div>

            <h2>Storm Impact Area — Property Location</h2>
            ${mapImgSrc ? `<img src="${mapImgSrc}" class="map-img" alt="Storm swath map" />` : '<div style="height:200px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;color:#999;font-size:11px;">Map not available</div>'}

            <div class="two-col">
              <div>
                <h2>Roof Assessment</h2>
                <table>
                  <tr><td class="label">Total Roof Area</td><td class="val">${lead.roof_sqft ? Number(lead.roof_sqft).toLocaleString() + ' sq ft (' + roofSquares + ' squares)' : 'Not measured'}</td></tr>
                  <tr><td class="label">Roofing Material</td><td class="val">${roofType !== '—' ? roofType : 'Not assessed'}</td></tr>
                  <tr><td class="label">Roof Pitch</td><td class="val">${lead.roof_pitch_degrees ? Number(lead.roof_pitch_degrees).toFixed(1) + '°' : 'N/A'}</td></tr>
                  <tr><td class="label">Roof Facets</td><td class="val">${lead.roof_segments || 'N/A'}</td></tr>
                  ${lead.roof_ridge_ft > 0 ? `<tr><td class="label">Ridge</td><td class="val">${Number(lead.roof_ridge_ft).toLocaleString()} ft</td></tr>` : ''}
                  ${lead.roof_eave_ft > 0 ? `<tr><td class="label">Eave</td><td class="val">${Number(lead.roof_eave_ft).toLocaleString()} ft</td></tr>` : ''}
                  ${lead.roof_rake_ft > 0 ? `<tr><td class="label">Rake</td><td class="val">${Number(lead.roof_rake_ft).toLocaleString()} ft</td></tr>` : ''}
                  ${lead.roof_valley_ft > 0 ? `<tr><td class="label">Valley</td><td class="val">${Number(lead.roof_valley_ft).toLocaleString()} ft</td></tr>` : ''}
                  ${lead.roof_hip_ft > 0 ? `<tr><td class="label">Hip</td><td class="val">${Number(lead.roof_hip_ft).toLocaleString()} ft</td></tr>` : ''}
                  ${lead.roof_drip_edge_ft > 0 ? `<tr><td class="label">Drip Edge</td><td class="val">${Number(lead.roof_drip_edge_ft).toLocaleString()} ft</td></tr>` : ''}
                  ${lead.roof_flashing_ft > 0 ? `<tr><td class="label">Flashing</td><td class="val">${Number(lead.roof_flashing_ft).toLocaleString()} ft</td></tr>` : ''}
                  ${measureSrc ? `<tr><td class="label">Measurement</td><td class="val">${measureSrc}</td></tr>` : ''}
                </table>
              </div>
              <div>
                <h2>Damage Assessment</h2>
                <table>
                  <tr><td class="label">Damage Factor</td><td class="val">${(df * 100).toFixed(0)}%</td></tr>
                  <tr><td class="label">Severity</td><td class="val highlight">${severity}</td></tr>
                  <tr><td class="label">Est. Repair Cost</td><td class="val highlight">${value ? '$' + Number(value).toLocaleString() : 'N/A'}</td></tr>
                </table>
                ${damageNotes ? `<div style="margin-top:6px;padding:0 8px;font-size:11px;"><strong>Notes:</strong> ${damageNotes}</div>` : ''}
              </div>
            </div>

            ${insuranceCo !== '—' || claimNumber ? `
              <h2>Insurance Information</h2>
              <table style="width:50%">
                ${insuranceCo !== '—' ? `<tr><td class="label">Insurance Company</td><td class="val">${insuranceCo}</td></tr>` : ''}
                ${claimNumber ? `<tr><td class="label">Claim Number</td><td class="val">${claimNumber}</td></tr>` : ''}
              </table>
            ` : ''}

            <div class="sig-area">
              <div><div class="sig-line">Inspector Signature / Date</div></div>
              <div><div class="sig-line">Homeowner Signature / Date</div></div>
            </div>

            <div class="disclaimer">
              <strong>Disclaimer:</strong> This report is generated from publicly available weather data (NOAA/NWS Storm Prediction Center)
              and county property assessment records. Hail sizes and wind speeds represent maximum reported values for storm events
              affecting the property location. This report supports insurance claim documentation and does not constitute a professional
              engineering inspection. A licensed adjuster or inspector should verify all damage on-site. Repair estimates are preliminary,
              based on roof area, material type, and storm severity; actual costs may vary.
            </div>
          </body></html>`);
          win.document.close();
          setTimeout(() => win.print(), 500);
        };

        return createPortal(
          <>
            <div onClick={() => setActiveModal(null)} style={{
              position: 'fixed', inset: 0, zIndex: 99998,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              zIndex: 99999, width: '90vw', maxWidth: 700, maxHeight: '90vh',
              background: '#fff', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              overflow: 'auto', color: '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}>
              {/* Paper-style report */}
              <div style={{ padding: '28px 36px' }}>
                {/* Header */}
                <div style={{ borderBottom: '3px solid #000', paddingBottom: 10, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Weather Damage Verification Report</h1>
                    <div style={{ fontSize: 10, color: '#666' }}>For insurance claim documentation and adjuster review</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 10, color: '#666' }}>
                    <div>Report Date: {reportDate}</div>
                    <div>Date of Loss: {stormDate}</div>
                  </div>
                </div>

                {/* Two-column: Property + Weather */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <div>
                    <h2 style={{ fontSize: 11, fontWeight: 700, margin: '12px 0 6px', padding: '4px 8px', background: '#f0f0f0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Property Information</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {R('Address', fullAddr)}
                        {R('Property Owner', name)}
                        {R('Year Built', lead.year_built || 'N/A')}
                        {R('Assessed Value', lead.assessed_value ? `$${Number(lead.assessed_value).toLocaleString()}` : 'N/A')}
                        {lead.county_parcel_id && R('Parcel ID', lead.county_parcel_id)}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h2 style={{ fontSize: 11, fontWeight: 700, margin: '12px 0 6px', padding: '4px 8px', background: '#f0f0f0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weather Event</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {R('Date of Loss', stormDate)}
                        {R('Storm Type', stormType ? stormType.charAt(0).toUpperCase() + stormType.slice(1) : 'N/A')}
                        {R('Max Hail Size', hailSize !== '—' ? `${hailSize}"` : 'N/A', true)}
                        {R('Max Wind Speed', windSpeed ? `${windSpeed} mph` : 'N/A')}
                      </tbody>
                    </table>
                    <div style={{ fontSize: 9, color: '#999', marginTop: 4, padding: '0 8px' }}>Source: NOAA/NWS Storm Prediction Center</div>
                  </div>
                </div>

                {/* Map */}
                <h2 style={{ fontSize: 11, fontWeight: 700, margin: '16px 0 6px', padding: '4px 8px', background: '#f0f0f0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Storm Impact Area — Property Location</h2>
                <div
                  id="insurance-report-map"
                  ref={(el) => {
                    if (!el || el.dataset.init) return;
                    el.dataset.init = 'true';
                    const initLat = lat || 30.27;
                    const initLng = lng || -97.74;
                    const m = new mapboxgl.Map({
                      container: el,
                      style: 'mapbox://styles/mapbox/satellite-streets-v12',
                      center: [initLng, initLat],
                      zoom: 14,
                      preserveDrawingBuffer: true,
                    });
                    m.on('load', () => {
                      // Add storm swath if available
                      if (lead.storm_geometry) {
                        m.addSource('swath', { type: 'geojson', data: { type: 'Feature', geometry: lead.storm_geometry, properties: {} } });
                        m.addLayer({ id: 'swath-fill', type: 'fill', source: 'swath', paint: { 'fill-color': stormType === 'hail' ? '#dcb428' : '#6c5ce7', 'fill-opacity': 0.35 } });
                        m.addLayer({ id: 'swath-outline', type: 'line', source: 'swath', paint: { 'line-color': stormType === 'hail' ? '#dcb428' : '#6c5ce7', 'line-width': 2 } });
                      }
                      // Add property marker
                      new mapboxgl.Marker({ color: '#ef4444' }).setLngLat([initLng, initLat]).addTo(m);
                    });
                  }}
                  style={{ width: '100%', height: 220, borderRadius: 4, border: '1px solid #ccc' }}
                />

                {/* Two-column: Roof + Damage */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <div>
                    <h2 style={{ fontSize: 11, fontWeight: 700, margin: '16px 0 6px', padding: '4px 8px', background: '#f0f0f0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Roof Assessment</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {R('Total Roof Area', lead.roof_sqft ? `${Number(lead.roof_sqft).toLocaleString()} sq ft (${roofSquares} sq)` : 'Not measured')}
                        {R('Roofing Material', roofType !== '—' ? roofType : 'Not assessed')}
                        {R('Roof Pitch', lead.roof_pitch_degrees ? `${Number(lead.roof_pitch_degrees).toFixed(1)}°` : 'N/A')}
                        {R('Roof Facets', lead.roof_segments || 'N/A')}
                        {lead.roof_ridge_ft > 0 && R('Ridge Length', `${Number(lead.roof_ridge_ft).toLocaleString()} ft`)}
                        {lead.roof_eave_ft > 0 && R('Eave Length', `${Number(lead.roof_eave_ft).toLocaleString()} ft`)}
                        {lead.roof_rake_ft > 0 && R('Rake Length', `${Number(lead.roof_rake_ft).toLocaleString()} ft`)}
                        {lead.roof_valley_ft > 0 && R('Valley Length', `${Number(lead.roof_valley_ft).toLocaleString()} ft`)}
                        {lead.roof_hip_ft > 0 && R('Hip Length', `${Number(lead.roof_hip_ft).toLocaleString()} ft`)}
                        {lead.roof_drip_edge_ft > 0 && R('Drip Edge', `${Number(lead.roof_drip_edge_ft).toLocaleString()} ft`)}
                        {lead.roof_flashing_ft > 0 && R('Flashing', `${Number(lead.roof_flashing_ft).toLocaleString()} ft`)}
                        {measureSrc && R('Measurement', measureSrc)}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h2 style={{ fontSize: 11, fontWeight: 700, margin: '16px 0 6px', padding: '4px 8px', background: '#f0f0f0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Damage Assessment</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {R('Damage Factor', `${(df * 100).toFixed(0)}%`)}
                        {R('Severity', severity, true)}
                        {R('Est. Repair Cost', value ? `$${Number(value).toLocaleString()}` : 'N/A', true)}
                      </tbody>
                    </table>
                    {damageNotes && <div style={{ marginTop: 6, padding: '0 8px', fontSize: 11 }}><strong>Notes:</strong> {damageNotes}</div>}
                  </div>
                </div>

                {/* Insurance Info */}
                {(insuranceCo !== '—' || claimNumber) && (
                  <>
                    <h2 style={{ fontSize: 11, fontWeight: 700, margin: '16px 0 6px', padding: '4px 8px', background: '#f0f0f0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Insurance Information</h2>
                    <table style={{ width: '50%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {insuranceCo !== '—' && R('Insurance Company', insuranceCo)}
                        {claimNumber && R('Claim Number', claimNumber)}
                      </tbody>
                    </table>
                  </>
                )}

                {/* Signature Lines */}
                <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ borderTop: '1px solid #333', width: 200, paddingTop: 4, fontSize: 10, color: '#666' }}>Inspector Signature / Date</div>
                  <div style={{ borderTop: '1px solid #333', width: 200, paddingTop: 4, fontSize: 10, color: '#666' }}>Homeowner Signature / Date</div>
                </div>

                {/* Disclaimer */}
                <div style={{ marginTop: 20, paddingTop: 10, borderTop: '1px solid #ccc', fontSize: 9, color: '#999', lineHeight: 1.4 }}>
                  <strong>Disclaimer:</strong> This report is generated from publicly available weather data (NOAA/NWS Storm Prediction Center)
                  and county property assessment records. Hail sizes and wind speeds represent maximum reported values for storm events
                  affecting the property location. This report supports insurance claim documentation and does not constitute a professional
                  engineering inspection. A licensed adjuster or inspector should verify all damage on-site. Repair estimates are preliminary.
                </div>
              </div>

              {/* Action bar */}
              <div style={{
                position: 'sticky', bottom: 0, padding: '10px 36px',
                background: '#f8f8f8', borderTop: '1px solid #ddd',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <button onClick={() => setActiveModal(null)} style={{
                  padding: '8px 20px', fontSize: 12, fontWeight: 600, border: '1px solid #ccc',
                  borderRadius: 6, background: '#fff', color: '#333', cursor: 'pointer',
                }}>Close</button>
                <button onClick={handlePrint} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 24px', fontSize: 12, fontWeight: 700, border: 'none',
                  borderRadius: 6, background: '#0ea5e9', color: '#fff', cursor: 'pointer',
                }}>
                  Print / Save as PDF
                </button>
              </div>
            </div>
          </>,
          document.body
        );
      })()}

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
            <div onClick={() => {
              if (adjustMapRef.current) { adjustMapRef.current.remove(); adjustMapRef.current = null; adjustMarkerRef.current = null; }
              setShowStreetView(false); setMapMode('street');
            }} style={{
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
                    <button onClick={() => {
                      if (adjustMapRef.current) { adjustMapRef.current.remove(); adjustMapRef.current = null; adjustMarkerRef.current = null; }
                      setMapMode('street');
                    }} style={{
                      padding: '3px 8px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer',
                      background: mapMode === 'street' ? 'var(--accent-blue)' : 'transparent',
                      color: mapMode === 'street' ? '#fff' : 'var(--text-muted)',
                    }}>Street</button>
                    <button onClick={() => {
                      if (adjustMapRef.current) { adjustMapRef.current.remove(); adjustMapRef.current = null; adjustMarkerRef.current = null; }
                      setMapMode('satellite');
                    }} style={{
                      padding: '3px 8px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer',
                      background: mapMode === 'satellite' ? 'var(--accent-blue)' : 'transparent',
                      color: mapMode === 'satellite' ? '#fff' : 'var(--text-muted)',
                    }}>Satellite</button>
                  </div>
                </div>
                <button onClick={() => {
                  if (adjustMapRef.current) { adjustMapRef.current.remove(); adjustMapRef.current = null; adjustMarkerRef.current = null; }
                  setShowStreetView(false); setMapMode('street');
                }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  fontSize: 18, lineHeight: 1, padding: '0 4px',
                }}>✕</button>
              </div>
              {mapMode === 'street' ? (
                <iframe
                  src={embedSrc}
                  style={{ width: '100%', height: '55vh', border: 'none', display: 'block' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div style={{ position: 'relative' }}>
                  <div
                    ref={(el) => {
                      if (!el || adjustMapRef.current) return;
                      const initLat = lat || 30.27;
                      const initLng = lng || -97.74;
                      const map = new mapboxgl.Map({
                        container: el,
                        style: 'mapbox://styles/mapbox/satellite-streets-v12',
                        center: [initLng, initLat],
                        zoom: 18,
                      });
                      adjustMapRef.current = map;

                      const marker = new mapboxgl.Marker({ draggable: true, color: '#ff9500' })
                        .setLngLat([initLng, initLat])
                        .addTo(map);
                      adjustMarkerRef.current = marker;
                    }}
                    style={{ width: '100%', height: '55vh' }}
                  />
                  <div style={{
                    position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.75)', color: '#ff9500', padding: '6px 14px',
                    borderRadius: 8, fontSize: 12, fontWeight: 600, pointerEvents: 'none',
                  }}>
                    Drag pin to the roof to fix location
                  </div>
                </div>
              )}
              <div style={{
                padding: '8px 16px', borderTop: '1px solid oklch(0.25 0.02 260)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                {mapMode === 'satellite' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      disabled={savingPin}
                      onClick={async () => {
                        console.log('Save pin clicked', { marker: !!adjustMarkerRef.current, propertyId: lead.property_id });
                        if (!adjustMarkerRef.current || !lead.property_id) {
                          console.error('Save pin aborted: marker=', !!adjustMarkerRef.current, 'propertyId=', lead.property_id);
                          setSavingPin('error');
                          setTimeout(() => setSavingPin(false), 2000);
                          return;
                        }
                        setSavingPin(true);
                        try {
                          const pos = adjustMarkerRef.current.getLngLat();
                          console.log('Saving pin at', pos.lat, pos.lng);
                          await updatePropertyLocation(lead.property_id, pos.lat, pos.lng);
                          await refreshLead();
                          setSavingPin('done');
                          setTimeout(() => setSavingPin(false), 2000);
                        } catch (err) {
                          console.error('Save pin failed:', err.response?.data || err.message);
                          setSavingPin('error');
                          setTimeout(() => setSavingPin(false), 2000);
                        }
                      }}
                      style={{
                        background: savingPin === 'done' ? '#22c55e' : savingPin === 'error' ? '#ef4444' : '#ff9500',
                        border: 'none', color: '#fff',
                        padding: '6px 20px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        cursor: savingPin ? 'default' : 'pointer', opacity: savingPin === true ? 0.5 : 1,
                      }}
                    >
                      {savingPin === 'done' ? 'Saved ✓' : savingPin === 'error' ? 'Failed' : savingPin === true ? 'Saving...' : 'Save Pin Location'}
                    </button>
                  </div>
                ) : (
                  <div />
                )}
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

      {/* Roof Drawing Tool Modal */}
      {showRoofDrawing && (() => {
        const geo = lead.property_geometry;
        const drawLat = geo?.coordinates?.[1] || 30.27;
        const drawLng = geo?.coordinates?.[0] || -97.74;
        const fullAddr = `${address}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}${zip ? ` ${zip}` : ''}`;
        return (
          <RoofDrawingTool
            propertyId={lead.property_id}
            lat={drawLat}
            lng={drawLng}
            address={fullAddr}
            roofPitchDegrees={lead.roof_pitch_degrees}
            hasExistingData={!!lead.roof_sqft}
            existingEdges={{
              ridge: Number(lead.roof_ridge_ft) || 0,
              eave: Number(lead.roof_eave_ft) || 0,
              rake: Number(lead.roof_rake_ft) || 0,
              valley: Number(lead.roof_valley_ft) || 0,
              hip: Number(lead.roof_hip_ft) || 0,
              flashing: Number(lead.roof_flashing_ft) || 0,
            }}
            solarSegments={solarSegments}
            roofOutline={roofOutline}
            onSave={() => { refreshLead(); onUpdated?.(); }}
            onClose={() => setShowRoofDrawing(false)}
          />
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

