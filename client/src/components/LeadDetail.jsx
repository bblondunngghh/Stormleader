import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getLeadDetail, updateLead, deleteLead, updateLeadRoofType, logActivity, getActivities, addContact, getCustomFieldDefinitions } from '../api/crm';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { getDocuments, uploadDocument, deleteDocument } from '../api/documents';
import { submitTrace } from '../api/skipTrace';
import { getDisasterDeclarations } from '../api/storms';
import { measureRoof, manualRoofEntry, getSolarSegments, getSolarPotential } from '../api/roofMeasurement';
import { formatCurrency } from '../utils/currency';
import mapboxgl from 'mapbox-gl';
import { IconX, IconPhone, IconMail, IconCalendar, IconClipboard, IconDollar, IconCamera, IconSend, IconTrash } from './Icons';
import {
  EyeIcon,
  MagnifyingGlassIcon,
  PhoneArrowUpRightIcon,
  EnvelopeOpenIcon,
  ChatBubbleLeftRightIcon,
  HomeIcon,
  PencilSquareIcon,
  UserMinusIcon,
  ArrowsPointingOutIcon,
  CheckBadgeIcon,
  CloudIcon,
  ArrowDownTrayIcon,
  SunIcon,
  DocumentTextIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import PhotoAnnotator from './PhotoAnnotator';
import DatePicker from './DatePicker';
import { showToast } from './Toast';

function cleanAddr(str) {
  if (!str) return '';
  return str.replace(/[\s,]+$/, '').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
}
function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
function formatOwner(raw) {
  if (!raw?.trim()) return '';
  const upper = raw.toUpperCase();
  const bizWords = ['LLC', 'INC', 'CORP', 'TRUST', 'ESTATE', 'LTD', 'PARTNERSHIP', 'LP', 'LLP', 'CHURCH', 'ASSOCIATION'];
  if (bizWords.some(w => upper.includes(w))) return titleCase(raw);
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 2) {
    const lastName = parts[0];
    const rest = parts.slice(1).join(' ');
    return titleCase(rest + ' ' + lastName);
  }
  return titleCase(raw);
}

const SEVERITY_COLORS = {
  extreme: 'oklch(0.62 0.26 15)',
  severe: 'oklch(0.68 0.20 45)',
  moderate: 'oklch(0.78 0.17 85)',
  minor: 'oklch(0.75 0.18 170)',
};
function severityColor(rating) {
  if (!rating) return 'oklch(0.55 0 0)';
  return SEVERITY_COLORS[rating.toLowerCase()] || 'oklch(0.55 0 0)';
}

// Convert roof pitch degrees to standard X/12 format (always rounds up)
function formatPitch(degrees) {
  if (!degrees) return '—';
  const rise = Math.ceil(12 * Math.tan((Number(degrees) * Math.PI) / 180));
  const roundedDeg = Math.round(Math.atan(rise / 12) * (180 / Math.PI));
  return `${roundedDeg}°\u00a0\u00a0\u00a0·\u00a0\u00a0\u00a0${rise}/12`;
}
import RoofDrawingTool from './RoofDrawingTool';
import ActivityModal from './ActivityModal';
import EmailModal from './EmailModal';
import { calcMonthlyPayment, formatMoney } from '../utils/financing';
import CustomSelect from './CustomSelect';

function FinancingStatusBadge({ status }) {
  const colors = {
    pending: { bg: 'oklch(0.55 0.12 85 / 0.3)', fg: 'oklch(0.8 0.15 85)' },
    redirected: { bg: 'oklch(0.55 0.12 85 / 0.3)', fg: 'oklch(0.8 0.15 85)' },
    applied: { bg: 'oklch(0.55 0.12 85 / 0.3)', fg: 'oklch(0.8 0.15 85)' },
    approved: { bg: 'oklch(0.45 0.12 145 / 0.3)', fg: 'oklch(0.8 0.15 145)' },
    funded: { bg: 'oklch(0.45 0.12 145 / 0.3)', fg: 'oklch(0.8 0.15 145)' },
    declined: { bg: 'oklch(0.45 0.12 25 / 0.3)', fg: 'oklch(0.8 0.15 25)' },
    expired: { bg: 'oklch(0.4 0.05 250 / 0.3)', fg: 'oklch(0.7 0.05 250)' },
  };
  const c = colors[status] || colors.pending;
  return (
    <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', background: c.bg, color: c.fg }}>
      {status}
    </span>
  );
}

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
  const [financingApps, setFinancingApps] = useState([]);
  const [leadContracts, setLeadContracts] = useState([]);
  const [leadExpenses, setLeadExpenses] = useState([]);
  const [jobCostSummary, setJobCostSummary] = useState(null);
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
  const [billingModal, setBillingModal] = useState(null); // 'measure' | 'trace' | null
  const [billingDontAsk, setBillingDontAsk] = useState(false);
  const [showManualRoof, setShowManualRoof] = useState(false);
  const [manualRoofSqft, setManualRoofSqft] = useState('');
  const [manualRoofPitch, setManualRoofPitch] = useState('');
  const [savingManualRoof, setSavingManualRoof] = useState(false);
  const [showRoofDrawing, setShowRoofDrawing] = useState(false);
  const [solarSegments, setSolarSegments] = useState([]);
  const [solarPotential, setSolarPotential] = useState(null);
  const [roofOutline, setRoofOutline] = useState([]);
  const [showStreetView, setShowStreetView] = useState(false);
  const [mapMode, setMapMode] = useState('street'); // 'street' | 'satellite' | 'adjust'
  const [showWeatherHistory, setShowWeatherHistory] = useState(false);
  const [weatherEvents, setWeatherEvents] = useState([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [noaaHistory, setNoaaHistory] = useState(null);
  const [customFieldDefs, setCustomFieldDefs] = useState([]);
  const [annotatingDoc, setAnnotatingDoc] = useState(null); // doc object being annotated
  const [disasterData, setDisasterData] = useState(null);
  const [disasterLoading, setDisasterLoading] = useState(false);
  const adjustMapRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch full lead detail from API
  useEffect(() => {
    if (!leadId && !legacyLead) return;

    if (leadId) {
      setLoading(true);
      getLeadDetail(leadId)
        .then(async res => {
          setLead(res.data);
          setActivities(res.data.activities || []);
          // Fetch financing applications
          try {
            const { data: apps } = await client.get('/crm/financing/applications', { params: { leadId: res.data.id } });
            setFinancingApps(apps);
          } catch (err) {
            console.error('Failed to load financing apps:', err);
          }
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

  // Fetch contracts for this lead
  useEffect(() => {
    if (!leadId) return;
    client.get('/crm/contracts', { params: { lead_id: leadId } })
      .then(res => setLeadContracts(res.data.contracts || res.data || []))
      .catch(() => {});
  }, [leadId]);

  // Fetch expenses and job cost summary for this lead
  useEffect(() => {
    if (!leadId) return;
    client.get('/crm/expenses', { params: { lead_id: leadId, limit: 20 } })
      .then(res => setLeadExpenses(res.data.expenses || []))
      .catch(() => {});
    client.get(`/crm/expenses/summary/${leadId}`)
      .then(res => setJobCostSummary(res.data))
      .catch(() => {});
  }, [leadId]);

  // Fetch custom field definitions
  useEffect(() => {
    getCustomFieldDefinitions('lead')
      .then(res => setCustomFieldDefs(res.data || []))
      .catch(() => {});
  }, []);

  // Close slide-over on Escape — but only when no nested overlay is open
  // (nested modals like RoofDrawingTool/PhotoAnnotator manage their own Esc).
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (activeModal || showEstimateInfo || billingModal || showManualRoof ||
          showRoofDrawing || showStreetView || showWeatherHistory || annotatingDoc) return;
      onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, activeModal, showEstimateInfo, billingModal, showManualRoof,
      showRoofDrawing, showStreetView, showWeatherHistory, annotatingDoc]);

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

  // Fetch solar potential data when lead has roof measurement
  useEffect(() => {
    if (!lead?.property_id || !lead?.roof_sqft) return;
    getSolarPotential(lead.property_id)
      .then(data => setSolarPotential(data))
      .catch(() => setSolarPotential(null));
  }, [lead?.property_id, lead?.roof_sqft]);

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
  const rawName = lead.contact_name || lead.name || '';
  const name = formatOwner(rawName) || '—';
  const rawAddress = lead.address || lead.address_line1 || '';
  const address = titleCase(cleanAddr(rawAddress)) || '—';
  const city = lead.city?.trim() || lead.property_city?.trim() || '';
  const state = lead.state?.trim() || '';
  const zip = (lead.zip?.trim() && lead.zip.trim() !== '0') ? lead.zip.trim() : '';
  const phone = lead.contact_phone || lead.phone || '—';
  const email = lead.contact_email || lead.email || '—';
  const value = lead.estimated_value || lead.value || 0;
  const priority = lead.priority || 'warm';
  const stage = lead.stage || 'new';
  const roofType = lead.roof_type || lead.roofType || '—';
  const sqft = lead.roof_sqft || lead.property_sqft || lead.sqft || 0;
  const rawMaxHail = lead.storm_raw_data?.maxHailSize ? parseFloat(lead.storm_raw_data.maxHailSize) : null;
  const rawMaxWind = lead.storm_raw_data?.maxWindGust
    ? parseFloat(lead.storm_raw_data.maxWindGust.replace(/[^0-9.]/g, ' ').trim().split(/\s+/).pop())
    : null;
  const hailSize = lead.hail_size_in || lead.storm_hail_max || rawMaxHail || lead.hailSize || '—';
  const windSpeed = lead.storm_wind_max || rawMaxWind || null;
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

  const doMeasure = async () => {
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
  };

  const doTrace = async () => {
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
  };

  const fetchDisasterDeclarations = async () => {
    let st = lead?.state?.trim() || lead?.property_state?.trim() || '';
    let county = lead?.property_county?.trim() || '';

    // If state/county missing but we have coordinates, reverse-geocode to get them
    if ((!st || !county) && lead?.property_geometry?.coordinates) {
      const [lng, lat] = lead.property_geometry.coordinates;
      try {
        const { data: geo } = await client.get('/properties/reverse-geocode', { params: { lat, lng } });
        if (geo.matched) {
          if (!st && geo.state) st = geo.state;
          if (!county && geo.county) county = geo.county;
        }
      } catch {}
    }

    // Still try to extract state from address if missing (e.g. "Hardin, TX 77657")
    if (!st) {
      const addr = lead?.address || lead?.address_line1 || '';
      const stMatch = addr.match(/,\s*([A-Z]{2})\s+\d{5}/);
      if (stMatch) st = stMatch[1];
    }

    if (!st || !county) {
      setDisasterData({ error: 'Could not determine state and county for this address.' });
      return;
    }
    setDisasterLoading(true);
    try {
      const { data } = await getDisasterDeclarations(st, county);
      setDisasterData(data);
    } catch {
      setDisasterData({ error: 'Could not load disaster data.' });
    } finally {
      setDisasterLoading(false);
    }
  };

  const fetchWeatherHistory = async () => {
    if (!lead?.property_id) return;
    setWeatherLoading(true);
    setWeatherError('');
    try {
      const { data } = await client.get(`/properties/${lead.property_id}/weather-history`);
      setWeatherEvents(data);
      setShowWeatherHistory(true);
    } catch (err) {
      setWeatherError(err.response?.data?.error || 'Failed to load weather history');
    } finally {
      setWeatherLoading(false);
    }
  };

  const downloadWeatherPdf = async () => {
    if (!lead?.property_id) return;
    try {
      const response = await client.get(`/properties/${lead.property_id}/weather-history/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = response.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] || 'weather-history.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('Failed to download weather history', 'error');
    }
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
    } catch { showToast('Failed to upload document', 'error'); } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await deleteDocument(docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch { showToast('Failed to delete document', 'error'); }
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
      showToast('Failed to save changes', 'error');
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
      showToast('Failed to log activity', 'error');
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
                  boxShadow: '0 8px 24px oklch(0 0 0 / 0.5)',
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
                  boxShadow: '0 8px 24px oklch(0 0 0 / 0.5)',
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
            {/* Lead Score Badge + Factor Breakdown */}
            {lead && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    if (lead.lead_score != null && lead.lead_score_factors) {
                      setLead(prev => ({
                        ...prev,
                        _showScoreBreakdown: !prev._showScoreBreakdown,
                        _scoreBtnRect: { top: rect.bottom + 6, left: Math.max(8, rect.right - 240) },
                      }));
                      return;
                    }
                    try {
                      const resp = await client.post(`/crm/leads/${leadId}/score`);
                      setLead(prev => ({
                        ...prev,
                        lead_score: resp.data.score,
                        lead_score_factors: resp.data.factors,
                        _showScoreBreakdown: true,
                        _scoreBtnRect: { top: rect.bottom + 6, left: Math.max(8, rect.right - 240) },
                      }));
                    } catch (err) {
                      console.error('Score failed:', err?.response?.status, err?.response?.data?.error);
                    }
                  }}
                  title={lead.lead_score != null ? `Score: ${lead.lead_score}/100 — Click to see breakdown` : 'Click to compute lead score'}
                  style={{
                    background: lead.lead_score >= 80 ? 'oklch(0.35 0.12 145 / 0.4)'
                      : lead.lead_score >= 60 ? 'oklch(0.35 0.1 85 / 0.4)'
                      : lead.lead_score >= 40 ? 'oklch(0.35 0.1 60 / 0.4)'
                      : lead.lead_score >= 20 ? 'oklch(0.35 0.1 30 / 0.4)'
                      : 'oklch(0.25 0.05 260 / 0.3)',
                    color: lead.lead_score >= 80 ? 'oklch(0.85 0.18 145)'
                      : lead.lead_score >= 60 ? 'oklch(0.85 0.15 85)'
                      : lead.lead_score >= 40 ? 'oklch(0.85 0.15 60)'
                      : lead.lead_score >= 20 ? 'oklch(0.75 0.15 30)'
                      : 'var(--text-muted)',
                    border: 'none', borderRadius: 'var(--radius-pill)', padding: '4px 10px',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {lead.lead_score != null ? `⚡ ${lead.lead_score}` : '⚡ Score'}
                </button>
              </div>
            )}
            {lead?._showScoreBreakdown && lead?.lead_score_factors && lead?._scoreBtnRect && createPortal(
              (() => {
                const f = lead.lead_score_factors;
                const pos = lead._scoreBtnRect;
                const scoreColor = (val, max) => {
                  const pct = val / max;
                  if (pct >= 0.7) return 'oklch(0.75 0.18 145)';
                  if (pct >= 0.4) return 'oklch(0.75 0.15 85)';
                  if (pct > 0) return 'oklch(0.75 0.15 60)';
                  return 'var(--text-muted)';
                };
                const bar = (val, max) => `${Math.round((val / max) * 100)}%`;
                const factorList = [
                  { label: 'Storm Damage', score: f.stormDamageScore || 0, max: 20 },
                  { label: 'Hail Risk (10yr)', score: f.hailRiskScore || 0, max: 15 },
                  { label: 'FEMA Disaster Zone', score: f.disasterZoneScore || 0, max: 10 },
                  { label: 'Property Profile', score: f.propertyProfileScore || 0, max: 15 },
                  { label: 'Recency', score: f.recencyScore || 0, max: 15 },
                  { label: 'Engagement', score: f.engagementScore || 0, max: 15 },
                  { label: 'Data Quality', score: f.dataQualityScore || 0, max: 10 },
                ];
                return (
                  <>
                    <div onClick={() => setLead(prev => ({ ...prev, _showScoreBreakdown: false }))}
                      style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
                    <div style={{
                      position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
                      background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(1 0 0 / 0.1)',
                      borderRadius: 10, padding: '12px 14px', width: 240, backdropFilter: 'blur(20px)',
                      boxShadow: '0 8px 24px oklch(0 0 0 / 0.4)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Score Breakdown</span>
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const resp = await client.post(`/crm/leads/${leadId}/score`);
                            setLead(prev => ({ ...prev, lead_score: resp.data.score, lead_score_factors: resp.data.factors }));
                          } catch {}
                        }} style={{ background: 'none', border: 'none', color: 'oklch(0.70 0.15 230)', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>↻ Refresh</button>
                      </div>
                      {factorList.map(({ label, score: s, max }) => (
                        <div key={label} style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                            <span style={{ color: scoreColor(s, max), fontWeight: 600 }}>{s}/{max}</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: 'oklch(0.25 0.01 260)' }}>
                            <div style={{ height: '100%', borderRadius: 2, background: scoreColor(s, max), width: bar(s, max), transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      ))}
                      {(f.hailRiskLevel || f.homeAge || f.ownerOccupiedRate != null || f.femaRiskScore != null) && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, borderTop: '1px solid oklch(1 0 0 / 0.06)', paddingTop: 6, lineHeight: 1.6 }}>
                          {f.hailRiskLevel && (<div>Hail Risk: <span style={{ fontWeight: 600, textTransform: 'capitalize', color: f.hailRiskLevel === 'extreme' ? 'oklch(0.65 0.25 25)' : f.hailRiskLevel === 'high' ? 'oklch(0.70 0.20 40)' : 'var(--text-secondary)' }}>{f.hailRiskLevel}</span>
                            {f.hailHistoryCount > 0 && ` · ${f.hailHistoryCount} events`}
                            {f.maxHistoricalHailIn > 0 && ` · max ${f.maxHistoricalHailIn}"`}
                          </div>)}
                          {f.femaRiskScore != null && <div>FEMA Disaster: <span style={{ fontWeight: 600 }}>{f.femaRiskScore}/100</span></div>}
                          {f.homeAge != null && <div>Neighborhood Age: <span style={{ fontWeight: 600 }}>{f.homeAge}yr</span> median</div>}
                          {f.ownerOccupiedRate != null && <div>Owner-Occupied: <span style={{ fontWeight: 600 }}>{Math.round(f.ownerOccupiedRate * 100)}%</span></div>}
                        </div>
                      )}
                    </div>
                  </>
                );
              })(),
              document.body
            )}
          </div>
          <div className="slide-over__name">{name}</div>
          <div className="slide-over__address">{address}{city && !address?.toUpperCase().includes(city?.toUpperCase()) ? `, ${titleCase(city)}` : ''}{state && !address?.includes(state) ? `, ${state}` : ''}{zip && !address?.includes(zip) ? ` ${zip}` : ''}</div>
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
                    <QuestionMarkCircleIcon width={12} height={12} style={{ stroke: 'var(--text-muted)' }} />
                  </button>
                </span>
                {showEstimateInfo && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowEstimateInfo(false)} />
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 100,
                      background: 'oklch(0.14 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
                      borderRadius: 10, padding: '16px 18px', width: 340,
                      boxShadow: '0 12px 40px oklch(0 0 0 / 0.6)', fontSize: 12, lineHeight: 1.6,
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

          {/* Action Buttons Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginTop: 'var(--space-sm)' }}>
          {/* Street View Button */}
          {address !== '—' && (
            <button
              onClick={() => setShowStreetView(true)}
              className="icon-spin-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 0', fontSize: 12, fontWeight: 600,
                background: 'none', border: 'none',
                color: 'var(--accent-blue)', cursor: 'pointer',
                opacity: 0.85, transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}
            >
              <EyeIcon width={16} height={16} />
              View House
            </button>
          )}

          {/* Measure Roof Button */}
          {leadId && lead.property_id && (
            <div>
              <button
                onClick={() => {
                  if (localStorage.getItem('billing_dismiss_measure')) {
                    doMeasure();
                  } else {
                    setBillingModal('measure');
                    setBillingDontAsk(false);
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
                <ArrowsPointingOutIcon width={16} height={16} />
                {measuring ? 'Measuring...' : lead.roof_pitch_degrees ? 'Re-measure Roof' : 'Measure Roof'}
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
              {lead.roof_sqft && (() => {
                const hasAllEdges = lead.roof_ridge_ft > 0 && lead.roof_eave_ft > 0 && lead.roof_rake_ft > 0
                  && lead.roof_valley_ft > 0 && lead.roof_drip_edge_ft > 0 && lead.roof_flashing_ft > 0;
                return (
                  <button
                    onClick={() => setShowRoofDrawing(true)}
                    style={{
                      background: 'none', border: 'none', color: 'var(--accent-blue)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline',
                      marginTop: 2,
                    }}
                  >
                    {hasAllEdges ? 'Edit Roof Measurement' : 'Draw to add missing edges'}
                  </button>
                );
              })()}
            </div>
          )}

          {/* Run Trace Button */}
          {leadId && lead.property_id && (
            <div>
              <button
                onClick={() => {
                  if (localStorage.getItem('billing_dismiss_trace')) {
                    doTrace();
                  } else {
                    setBillingModal('trace');
                    setBillingDontAsk(false);
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
                <MagnifyingGlassIcon width={16} height={16} />
                {tracing ? 'Tracing...' : (phone === '—' && email === '—') ? 'Run Trace' : 'Re-trace'}
              </button>
              {traceError && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{traceError}</div>}
            </div>
          )}

          {/* Storm History Button */}
          {leadId && lead.property_id && (
            <div>
              <button
                onClick={fetchWeatherHistory}
                disabled={weatherLoading}
                className="icon-spin-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 0', fontSize: 12, fontWeight: 600,
                  background: 'none', border: 'none',
                  color: 'var(--accent-blue)',
                  cursor: weatherLoading ? 'not-allowed' : 'pointer',
                  opacity: weatherLoading ? 0.5 : 0.85,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { if (!weatherLoading) e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = weatherLoading ? '0.5' : '0.85'; }}
              >
                <CloudIcon width={16} height={16} />
                {weatherLoading ? 'Loading...' : 'Storm History'}
              </button>
              {weatherError && <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>{weatherError}</div>}
            </div>
          )}

          {/* Property Report PDF Button */}
          {lead?.property_id && (
            <div>
              <button
                onClick={async () => {
                  try {
                    const res = await client.get(`/properties/${lead.property_id}/report/pdf`, { responseType: 'blob' });
                    const url = URL.createObjectURL(res.data);
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                  } catch { showToast('Failed to generate property report', 'error'); }
                }}
                className="icon-spin-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 0', fontSize: 12, fontWeight: 600,
                  background: 'none', border: 'none',
                  color: 'oklch(0.75 0.12 200)',
                  cursor: 'pointer',
                  opacity: 0.85,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.85'; }}
              >
                <DocumentTextIcon width={16} height={16} />
                Property Report
              </button>
            </div>
          )}

          </div>{/* end Action Buttons Grid */}

          {/* Disaster Declarations Button */}
          {leadId && (
            <div style={{ marginTop: 'var(--space-sm)' }}>
              <button
                onClick={fetchDisasterDeclarations}
                disabled={disasterLoading}
                className="icon-spin-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 0', fontSize: 12, fontWeight: 600,
                  background: 'none', border: 'none',
                  color: 'oklch(0.75 0.15 60)',
                  cursor: disasterLoading ? 'not-allowed' : 'pointer',
                  opacity: disasterLoading ? 0.5 : 0.85,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { if (!disasterLoading) e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = disasterLoading ? '0.5' : '0.85'; }}
              >
                <ExclamationTriangleIcon width={16} height={16} />
                {disasterLoading ? 'Loading...' : disasterData?.error ? 'FEMA Disaster History' : disasterData ? `${disasterData.summary?.total || 0} Disaster Declarations` : 'FEMA Disaster History'}
              </button>
              {disasterData?.error && (
                <div style={{ marginTop: 4, fontSize: 11, color: 'oklch(0.75 0.15 60)', lineHeight: 1.4 }}>
                  {disasterData.error}
                </div>
              )}
              {disasterData && disasterData.summary?.total > 0 && (
                <div style={{
                  marginTop: 6, padding: '8px 10px',
                  background: 'oklch(0.20 0.02 260 / 0.5)',
                  borderRadius: 10, fontSize: 11, lineHeight: 1.6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>County Risk Score</span>
                    <span style={{
                      fontWeight: 700,
                      color: disasterData.riskScore >= 60 ? 'oklch(0.65 0.20 30)' : disasterData.riskScore >= 30 ? 'oklch(0.75 0.15 85)' : 'oklch(0.75 0.18 145)',
                    }}>
                      {disasterData.riskScore}/100
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Declarations</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{disasterData.summary.total}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last 5 Years</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{disasterData.summary.recentCount}</span>
                  </div>
                  {Object.entries(disasterData.summary.byType || {}).slice(0, 4).map(([type, count]) => (
                    <div key={type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{type}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Property Details */}
        <div className="detail-section">
          <div className="detail-section__title">Property</div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-item__label">Est. Value</span>
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
                        boxShadow: '0 8px 24px oklch(0 0 0 / 0.5)',
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
              <span className="detail-item__value">{formatPitch(lead.roof_pitch_degrees)}</span>
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
            {lead.fema_bldg_type && (
              <div className="detail-item">
                <span className="detail-item__label">Structure</span>
                <span className="detail-item__value">{{ W: 'Wood', M: 'Masonry', H: 'Manufactured', S: 'Steel' }[lead.fema_bldg_type] || lead.fema_bldg_type}{lead.fema_num_stories ? ` / ${lead.fema_num_stories} story` : ''}</span>
              </div>
            )}
            {lead.fema_foundation_type && (
              <div className="detail-item">
                <span className="detail-item__label">Foundation</span>
                <span className="detail-item__value">{{ S: 'Slab', C: 'Crawlspace', B: 'Basement', P: 'Pier', I: 'Pile', F: 'Fill', W: 'Solid Wall' }[lead.fema_foundation_type] || lead.fema_foundation_type}</span>
              </div>
            )}
            <div className="detail-item">
              <span className="detail-item__label">Rep</span>
              <span className="detail-item__value">{repName}</span>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Storm Context */}
        <div className="detail-section">
          <div className="detail-section__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Weather Event</span>
            {(stormType || windSpeed || hailSize !== '—') && (() => {
              const label = (windSpeed && hailSize !== '—') ? 'Wind / Hail'
                : stormType || (windSpeed ? 'Wind' : hailSize !== '—' ? 'Hail' : null);
              const color = stormType === 'tornado' ? 'oklch(0.62 0.26 15)' : stormType === 'hail' ? 'oklch(0.78 0.17 85)' : 'oklch(0.70 0.18 330)';
              return label ? (
                <span style={{ color, fontWeight: 600, textTransform: 'capitalize', fontSize: 12 }}>
                  {label}
                </span>
              ) : null;
            })()}
          </div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-item__label">Storm Date</span>
              <span className="detail-item__value">{stormDate}</span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Hail Size</span>
              <span className="detail-item__value" style={{ color: hailSize !== '—' && typeof hailSize === 'number' ? 'oklch(0.78 0.17 85)' : undefined }}>
                {typeof hailSize === 'number' ? `${hailSize}"` : hailSize}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">Wind Speed</span>
              <span className="detail-item__value" style={{ color: windSpeed ? 'oklch(0.70 0.18 330)' : undefined }}>
                {windSpeed ? `${windSpeed} mph` : '—'}
              </span>
            </div>
            {lead.storm_raw_data?.severity && (
              <div className="detail-item">
                <span className="detail-item__label">Rating</span>
                <span className="detail-item__value" style={{ color: severityColor(lead.storm_raw_data.severity) }}>{lead.storm_raw_data.severity}</span>
              </div>
            )}
            {lead.storm_raw_data?.certainty && (
              <div className="detail-item">
                <span className="detail-item__label">Certainty</span>
                <span className="detail-item__value">{lead.storm_raw_data.certainty}</span>
              </div>
            )}
            {lead.storm_raw_data?.areaDesc && (
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                <span className="detail-item__label">Area</span>
                <span className="detail-item__value">{lead.storm_raw_data.areaDesc}</span>
              </div>
            )}
          </div>
        </div>

        <div className="divider" />

        {/* Insurance */}
        <div className="detail-section">
          <div className="detail-section__title">Insurance</div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-item__label">Company</span>
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

        {/* Custom Fields */}
        <div className="detail-section">
          <div className="detail-section__title">Custom Fields</div>
          {customFieldDefs.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 'var(--space-sm) 0' }}>
              No custom fields configured. Add them in Settings.
            </div>
          ) : (
            <div className="detail-grid">
              {customFieldDefs.map(def => {
                const val = lead.custom_fields?.[def.field_key] ?? '';
                const handleChange = async (newVal) => {
                  const updated = { ...(lead.custom_fields || {}), [def.field_key]: newVal };
                  try {
                    await updateLead(lead.id, { custom_fields: updated });
                    setLead(prev => ({ ...prev, custom_fields: updated }));
                    onUpdated?.();
                  } catch { /* silent */ }
                };
                return (
                  <div key={def.id} className="detail-item">
                    <span className="detail-item__label">
                      {def.field_label}
                      {def.is_required && <span style={{ color: 'oklch(0.7 0.2 25)', marginLeft: 4 }}>*</span>}
                    </span>
                    {def.field_type === 'boolean' ? (
                      <button
                        onClick={() => handleChange(!val)}
                        style={{
                          width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative',
                          background: val ? 'oklch(0.55 0.18 145)' : 'oklch(0.3 0.02 260)',
                          transition: 'background 0.15s',
                        }}>
                        <span style={{
                          position: 'absolute', top: 2, left: val ? 18 : 2,
                          width: 16, height: 16, borderRadius: '50%', background: 'oklch(1 0 0)',
                          transition: 'left 0.15s',
                        }} />
                      </button>
                    ) : def.field_type === 'select' ? (
                      <CustomSelect
                        value={String(val || '')}
                        onChange={v => handleChange(v)}
                        options={[
                          { value: '', label: '-- Select --' },
                          ...(def.options || []).map(opt => ({ value: String(opt), label: String(opt) }))
                        ]}
                      />
                    ) : def.field_type === 'date' ? (
                      <DatePicker
                        value={val || ''}
                        onChange={v => handleChange(v)}
                      />
                    ) : (
                      <input
                        className="form-input"
                        type={def.field_type === 'number' ? 'number' : 'text'}
                        value={val || ''}
                        onChange={e => handleChange(def.field_type === 'number' ? (e.target.value ? Number(e.target.value) : '') : e.target.value)}
                        placeholder={def.field_label}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
                        <div style={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 2 }}>
                          {isImage && (
                            <button onClick={() => setAnnotatingDoc(doc)} title="Annotate photo" style={{
                              background: 'oklch(0.12 0.02 260 / 0.8)',
                              border: 'none', borderRadius: 4, cursor: 'pointer', padding: 2, lineHeight: 0,
                            }}>
                              <PencilSquareIcon style={{ width: 12, height: 12, color: 'var(--accent-blue)' }} />
                            </button>
                          )}
                          <button onClick={() => handleDeleteDoc(doc.id)} style={{
                            background: 'oklch(0.12 0.02 260 / 0.8)',
                            border: 'none', borderRadius: 4, cursor: 'pointer', padding: 2, lineHeight: 0,
                          }}>
                            <IconTrash style={{ width: 12, height: 12, color: 'var(--accent-red)' }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="divider" />
          </>
        )}

        {/* Financing Applications */}
        {financingApps.length > 0 && (
          <>
            <div className="detail-section">
              <h4 style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: 14, fontWeight: 700, margin: '0 0 var(--space-md) 0' }}>
                <BanknotesIcon style={{ width: 18, height: 18 }} />
                Financing
              </h4>
              {financingApps.map(app => (
                <div key={app.id} className="glass" style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{app.plan_name}</span>
                    <FinancingStatusBadge status={app.status} />
                  </div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '4px' }}>
                    {app.term_months}mo @ {app.apr}% APR
                    {app.approved_amount ? ` — Approved: ${formatMoney(app.approved_amount)}` : ''}
                    {app.monthly_payment ? ` — ${formatMoney(app.monthly_payment)}/mo` : ''}
                  </div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>
                    {app.applied_at && `Applied ${new Date(app.applied_at).toLocaleDateString()}`}
                    {app.decided_at && ` → Decision ${new Date(app.decided_at).toLocaleDateString()}`}
                    {app.funded_at && ` → Funded ${new Date(app.funded_at).toLocaleDateString()}`}
                  </div>
                </div>
              ))}
            </div>
            <div className="divider" />
          </>
        )}

        {/* Contracts */}
        {leadId && (
          <>
            <div className="detail-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="detail-section__title" style={{ margin: 0 }}>Contracts ({leadContracts.length})</div>
                <button className="quick-action-btn" onClick={() => { window.location.href = `/contracts?leadId=${leadId}`; }}
                  style={{ fontSize: 11, padding: '4px 10px' }}>
                  + Generate Contract
                </button>
              </div>
              {leadContracts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                  {leadContracts.map(c => {
                    const cColors = { draft: 'var(--text-muted)', sent: 'var(--accent-blue)', viewed: 'oklch(0.8 0.15 85)', signed: 'var(--accent-green)', voided: 'var(--accent-red)' };
                    return (
                      <div key={c.id} className="glass" style={{ padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{c.template_type || c.template_name || 'Contract'}</span>
                          <span style={{
                            padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
                            background: `color-mix(in oklch, ${cColors[c.status] || 'var(--text-muted)'} 15%, transparent)`,
                            color: cColors[c.status] || 'var(--text-muted)', textTransform: 'uppercase',
                          }}>{c.status}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>
                          {c.created_at && new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="divider" />
          </>
        )}

        {/* Expenses / Job Costing */}
        {leadId && (
          <>
            <div className="detail-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="detail-section__title" style={{ margin: 0 }}>Expenses ({leadExpenses.length})</div>
                <button className="quick-action-btn" onClick={() => { window.location.href = `/expenses?leadId=${leadId}`; }}
                  style={{ fontSize: 11, padding: '4px 10px' }}>
                  + Add Expense
                </button>
              </div>
              {/* Profit Summary Card */}
              {jobCostSummary && (jobCostSummary.estimateTotal > 0 || jobCostSummary.totalExpenses > 0) && (
                <div className="glass" style={{
                  padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-md)',
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-sm)', textAlign: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Estimate Total</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'oklch(0.78 0.14 250)' }}>
                      {formatCurrency(jobCostSummary.estimateTotal)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Expenses</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'oklch(0.78 0.14 25)' }}>
                      {formatCurrency(jobCostSummary.totalExpenses)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Profit</div>
                    <div style={{
                      fontSize: 16, fontWeight: 700,
                      color: jobCostSummary.profit >= 0 ? 'oklch(0.78 0.14 145)' : 'oklch(0.78 0.14 25)',
                    }}>
                      {formatCurrency(jobCostSummary.profit)}
                      <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4 }}>
                        ({Number(jobCostSummary.profitPercent).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {/* Expense list */}
              {leadExpenses.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                  {leadExpenses.map(exp => {
                    const catColors = {
                      materials: 'oklch(0.78 0.14 250)', labor: 'oklch(0.78 0.14 145)',
                      subcontractor: 'oklch(0.78 0.14 300)', permit: 'oklch(0.78 0.14 85)',
                      dumpster: 'oklch(0.78 0.14 25)', other: 'oklch(0.7 0.02 250)',
                    };
                    return (
                      <div key={exp.id} className="glass" style={{ padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
                              background: `color-mix(in oklch, ${catColors[exp.category] || 'var(--text-muted)'} 15%, transparent)`,
                              color: catColors[exp.category] || 'var(--text-muted)', textTransform: 'capitalize',
                            }}>{exp.category}</span>
                            {exp.notes && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{exp.notes}</span>}
                          </div>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>
                            {formatCurrency(exp.amount)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>
                          {exp.date && new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="divider" />
          </>
        )}

        {/* Share Status Page */}
        {leadId && (
          <>
            <div className="detail-section">
              <div className="detail-section__title">Client Status Page</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-md) 0' }}>
                Share a live status page with your customer so they can track job progress.
              </p>
              <button
                className="quick-action-btn"
                style={{ fontSize: 12, padding: '6px 14px' }}
                onClick={async () => {
                  try {
                    const res = await client.post(`/leads/${leadId}/status-token`);
                    const fullUrl = `${window.location.origin}${res.data.url}`;
                    await navigator.clipboard.writeText(fullUrl);
                    showToast('Status page link copied to clipboard!', 'success');
                  } catch {
                    showToast('Failed to generate status link', 'error');
                  }
                }}
              >
                Share Status Page
              </button>
            </div>
            <div className="divider" />
          </>
        )}

        {/* Review Request — show when job is completed */}
        {leadId && stage === 'completed' && (
          <>
            <div className="detail-section">
              <div className="detail-section__title">Request Review</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-md) 0' }}>
                Generate a Google review link to send to your customer after job completion.
              </p>
              <ReviewRequestSection lead={lead} />
            </div>
            <div className="divider" />
          </>
        )}

        {/* Solar Potential */}
        {lead.roof_sqft && (
          <>
            <div className="detail-section">
              <h4 style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: 14, fontWeight: 700, margin: '0 0 var(--space-md) 0' }}>
                <SunIcon width={18} height={18} style={{ color: 'oklch(0.8 0.18 85)' }} />
                Solar Potential
              </h4>
              {solarPotential?.available ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-sm)' }}>
                  {[
                    { label: 'Panel Count', value: solarPotential.maxPanels.toLocaleString(), unit: 'panels', color: 'oklch(0.75 0.12 250)' },
                    { label: 'Annual Production', value: solarPotential.yearlyEnergyKwh.toLocaleString(), unit: 'kWh', color: 'oklch(0.8 0.18 85)' },
                    { label: 'Est. Annual Savings', value: `$${solarPotential.annualSavings.toLocaleString()}`, unit: '/yr', color: 'oklch(0.75 0.18 145)' },
                    { label: 'Payback Period', value: solarPotential.paybackYears, unit: 'years', color: 'oklch(0.75 0.12 250)' },
                    { label: '25-Year Savings', value: `$${solarPotential.twentyFiveYearSavings.toLocaleString()}`, unit: '', color: 'oklch(0.75 0.18 145)' },
                    { label: 'CO\u2082 Offset', value: solarPotential.co2OffsetTons, unit: 'tons/yr', color: 'oklch(0.75 0.15 165)' },
                  ].map((card, i) => (
                    <div key={i} className="glass" style={{
                      padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, lineHeight: 1.2 }}>{card.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: card.color, lineHeight: 1.2 }}>
                        {card.value}
                      </div>
                      {card.unit && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{card.unit}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', padding: 'var(--space-sm) 0' }}>
                  Run a roof measurement to see solar potential
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
              <PencilSquareIcon width={18} height={18} /> Log Activity...
            </button>
            <button className="quick-action-btn" onClick={() => setActiveModal('call')}>
              <PhoneArrowUpRightIcon width={18} height={18} /> Quick Call
            </button>
            <button className="quick-action-btn" onClick={() => setActiveModal('email')}>
              <EnvelopeOpenIcon width={18} height={18} /> Quick Email
            </button>
            <button className="quick-action-btn" onClick={() => setActiveModal('sms')}>
              <ChatBubbleLeftRightIcon width={18} height={18} /> Quick SMS
            </button>
            <button className="quick-action-btn" onClick={() => setActiveModal('visit')}>
              <HomeIcon width={18} height={18} /> Quick Visit
            </button>
            <button className="quick-action-btn" onClick={() => setActiveModal('insurance')}>
              <CheckBadgeIcon width={18} height={18} /> Insurance Report
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
                  <UserMinusIcon width={18} height={18} /> Remove Lead
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
                        background: 'var(--accent-red)', color: 'oklch(1 0 0)',
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

      {/* Storm History Modal */}
      {showWeatherHistory && createPortal(
        <>
          <div className="slide-over-backdrop" onClick={() => setShowWeatherHistory(false)} style={{ zIndex: 200 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            zIndex: 201, width: 560, maxWidth: '90vw', maxHeight: '80vh',
            borderRadius: 16, overflow: 'hidden',
            background: 'oklch(0.18 0.01 260)', border: '1px solid oklch(1 0 0 / 0.1)',
            boxShadow: '0 24px 48px oklch(0 0 0 / 0.5)',
            display: 'flex', flexDirection: 'column',
            animation: 'modal-scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
          }}>
            <div style={{ padding: '20px 24px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  <CloudIcon width={18} height={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                  Storm History
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {weatherEvents.length} event{weatherEvents.length !== 1 ? 's' : ''} within 5 miles
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={downloadWeatherPdf}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'var(--accent-blue)', border: 'none',
                    color: 'oklch(1 0 0)', cursor: 'pointer',
                  }}
                >
                  <ArrowDownTrayIcon width={14} height={14} />
                  Download PDF
                </button>
                <button
                  onClick={() => setShowWeatherHistory(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                >
                  <IconX />
                </button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: '0 24px 20px', flex: 1 }}>
              {weatherEvents.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No storm events found near this property.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid oklch(1 0 0 / 0.08)' }}>
                      <th style={{ padding: '8px 8px 8px 0', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Date</th>
                      <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Type</th>
                      <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Hail Size</th>
                      <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Wind Speed</th>
                      <th style={{ padding: '8px 0 8px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11 }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weatherEvents.map(ev => {
                      const hail = ev.hail_size_max_in ? Number(ev.hail_size_max_in) : 0;
                      const wind = ev.wind_speed_max_mph ? Number(ev.wind_speed_max_mph) : 0;
                      const isTornado = ev.raw_data?.event_type?.toLowerCase().includes('tornado');
                      const types = [];
                      if (hail > 0) types.push('Hail');
                      if (wind > 0) types.push('Wind');
                      if (isTornado) types.push('Tornado');
                      if (types.length === 0) types.push(ev.source || 'Storm');

                      // Severity color based on hail size
                      let severityBg = 'transparent';
                      let severityFg = 'var(--text-secondary)';
                      if (isTornado) {
                        severityBg = 'oklch(0.45 0.18 25 / 0.2)';
                        severityFg = 'oklch(0.75 0.18 25)';
                      } else if (hail >= 2) {
                        severityBg = 'oklch(0.45 0.18 25 / 0.2)';
                        severityFg = 'oklch(0.75 0.18 25)';
                      } else if (hail >= 1) {
                        severityBg = 'oklch(0.5 0.15 60 / 0.2)';
                        severityFg = 'oklch(0.8 0.15 60)';
                      } else if (hail > 0) {
                        severityBg = 'oklch(0.55 0.15 95 / 0.2)';
                        severityFg = 'oklch(0.82 0.15 95)';
                      } else if (wind >= 75) {
                        severityBg = 'oklch(0.45 0.18 25 / 0.2)';
                        severityFg = 'oklch(0.75 0.18 25)';
                      } else if (wind >= 58) {
                        severityBg = 'oklch(0.5 0.15 60 / 0.2)';
                        severityFg = 'oklch(0.8 0.15 60)';
                      }

                      return (
                        <tr key={ev.id} style={{ borderBottom: '1px solid oklch(1 0 0 / 0.05)' }}>
                          <td style={{ padding: '10px 8px 10px 0', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {ev.event_start ? new Date(ev.event_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                              fontSize: 11, fontWeight: 600,
                              background: severityBg, color: severityFg,
                            }}>
                              {types.join(' + ')}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: hail > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: hail >= 1 ? 600 : 400 }}>
                            {hail > 0 ? `${hail}"` : '—'}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: wind > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: wind >= 58 ? 600 : 400 }}>
                            {wind > 0 ? `${wind} mph` : '—'}
                          </td>
                          <td style={{ padding: '10px 0 10px 8px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>
                            {ev.source?.replace(/_/g, ' ') || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Billing Confirmation Modal */}
      {billingModal && createPortal(
        <>
          <div className="slide-over-backdrop" onClick={() => setBillingModal(null)} style={{ zIndex: 200 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            zIndex: 201, width: 360, padding: 24, borderRadius: 16,
            background: 'oklch(0.18 0.01 260)', border: '1px solid oklch(1 0 0 / 0.1)',
            boxShadow: '0 24px 48px oklch(0 0 0 / 0.5)',
            animation: 'modal-scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Billing Notice
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              {billingModal === 'measure'
                ? 'Each roof measurement will be charged to your monthly billing plan.'
                : 'Each skip trace will be charged to your monthly billing plan.'}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={billingDontAsk}
                onChange={e => setBillingDontAsk(e.target.checked)}
                style={{ accentColor: 'var(--accent-blue)' }}
              />
              I understand, do not show me this message again.
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setBillingModal(null)}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'oklch(1 0 0 / 0.08)', border: '1px solid oklch(1 0 0 / 0.1)',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (billingDontAsk) {
                    localStorage.setItem(`billing_dismiss_${billingModal}`, '1');
                  }
                  const action = billingModal === 'measure' ? doMeasure : doTrace;
                  setBillingModal(null);
                  action();
                }}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'var(--accent-blue)', border: 'none',
                  color: 'oklch(1 0 0)', cursor: 'pointer',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </>,
        document.body
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
                  <PhoneArrowUpRightIcon width={20} height={20} />
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
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Est. Value</div>
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
                  <ChatBubbleLeftRightIcon width={16} height={16} /> Send SMS
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
                  <PaperAirplaneIcon width={16} height={16} />
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
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Est. Value</div>
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
                <HomeIcon width={16} height={16} /> Log Visit
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
                  <tr><td class="label">Est. Value</td><td class="val">${lead.assessed_value ? '$' + Number(lead.assessed_value).toLocaleString() : 'N/A'}</td></tr>
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
                  <tr><td class="label">Roof Pitch</td><td class="val">${lead.roof_pitch_degrees ? (() => { const r = Math.ceil(12 * Math.tan(Number(lead.roof_pitch_degrees) * Math.PI / 180)); return Math.round(Math.atan(r/12)*180/Math.PI) + '°\u00a0\u00a0\u00a0·\u00a0\u00a0\u00a0' + r + '/12'; })() : 'N/A'}</td></tr>
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
            <div className="modal-backdrop" onClick={() => setActiveModal(null)} style={{
              position: 'fixed', inset: 0, zIndex: 99998,
              background: 'oklch(0 0 0 / 0.75)', backdropFilter: 'blur(4px)',
            }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              zIndex: 99999, width: '90vw', maxWidth: 700, maxHeight: '90vh',
              background: 'oklch(1 0 0)', borderRadius: 8, boxShadow: '0 20px 60px oklch(0 0 0 / 0.6)',
              overflow: 'auto', color: 'oklch(0.12 0.01 260)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
                        {R('Est. Value', lead.assessed_value ? `$${Number(lead.assessed_value).toLocaleString()}` : 'N/A')}
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
                        {R('Roof Pitch', lead.roof_pitch_degrees ? (() => { const r = Math.ceil(12 * Math.tan(Number(lead.roof_pitch_degrees) * Math.PI / 180)); return `${r}/12 (${Math.round(Math.atan(r/12)*180/Math.PI)}°)`; })() : 'N/A')}
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
                  borderRadius: 6, background: 'var(--accent-blue)', color: 'oklch(1 0 0)', cursor: 'pointer',
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
          <div onClick={() => {
            if (adjustMapRef.current) { adjustMapRef.current.remove(); adjustMapRef.current = null; }
            setShowStreetView(false); setMapMode('street');
          }} className="modal-backdrop" style={{
            position: 'fixed', inset: 0, zIndex: 99998,
            background: 'oklch(0 0 0 / 0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div className="glass" onClick={e => e.stopPropagation()} style={{
              width: '90vw', maxWidth: 800,
              borderRadius: 12,
              boxShadow: '0 20px 60px oklch(0 0 0 / 0.6)', overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid oklch(0.25 0.02 260)',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {address}
                  </span>
                  <span style={{ fontSize: 11, color: 'oklch(0.60 0.01 260)' }}>
                    {city}{state ? `, ${state}` : ''}{zip ? ` ${zip}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 2, background: 'oklch(0.20 0.02 260)', borderRadius: 8, padding: 3 }}>
                    <button onClick={() => {
                      if (adjustMapRef.current) { adjustMapRef.current.remove(); adjustMapRef.current = null; }
                      setMapMode('street');
                    }} style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer',
                      background: mapMode === 'street' ? 'var(--accent-blue)' : 'transparent',
                      color: mapMode === 'street' ? 'oklch(1 0 0)' : 'var(--text-muted)',
                    }}>Street</button>
                    <button onClick={() => {
                      if (adjustMapRef.current) { adjustMapRef.current.remove(); adjustMapRef.current = null; }
                      setMapMode('satellite');
                    }} style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer',
                      background: mapMode === 'satellite' ? 'var(--accent-blue)' : 'transparent',
                      color: mapMode === 'satellite' ? 'oklch(1 0 0)' : 'var(--text-muted)',
                    }}>Satellite</button>
                  </div>
                  <button onClick={() => {
                    if (adjustMapRef.current) { adjustMapRef.current.remove(); adjustMapRef.current = null; }
                    setShowStreetView(false); setMapMode('street');
                  }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    fontSize: 18, lineHeight: 1, padding: '0 4px',
                  }}>✕</button>
                </div>
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

                      const markerEl = document.createElement('div');
                      markerEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;';
                      const dot = document.createElement('div');
                      dot.style.cssText = 'width:20px;height:20px;border-radius:50%;background:oklch(0.78 0.12 200);border:2.5px solid rgba(255,255,255,0.9);box-shadow:0 0 8px oklch(0.78 0.12 200 / 0.6), 0 2px 6px rgba(0,0,0,0.3);';
                      const addrLabel = document.createElement('div');
                      addrLabel.textContent = address;
                      addrLabel.style.cssText = 'margin-top:4px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,0.7);color:#fff;font-size:11px;font-weight:600;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.5);';
                      markerEl.appendChild(dot);
                      markerEl.appendChild(addrLabel);
                      new mapboxgl.Marker({ element: markerEl, anchor: 'top' })
                        .setLngLat([initLng, initLat])
                        .addTo(map);
                    }}
                    style={{ width: '100%', height: '55vh' }}
                  />
                </div>
              )}
              <div style={{
                padding: '8px 16px', borderTop: '1px solid oklch(0.25 0.02 260)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div />
                <a href={mapsLink} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: 'var(--accent-blue)', textDecoration: 'none' }}>
                  Open in Google Maps ↗
                </a>
              </div>
            </div>
          </div>,
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

      {/* Photo Annotation Modal */}
      {annotatingDoc && createPortal(
        <PhotoAnnotator
          imageUrl={annotatingDoc.file_url}
          onSave={async (blob) => {
            const formData = new FormData();
            formData.append('file', blob, `annotated-${annotatingDoc.filename}`);
            formData.append('lead_id', leadId);
            formData.append('type', 'photo');
            formData.append('description', `Annotated: ${annotatingDoc.filename}`);
            await uploadDocument(formData);
            const res = await getDocuments({ lead_id: leadId });
            setDocuments(res.data || []);
            setAnnotatingDoc(null);
          }}
          onClose={() => setAnnotatingDoc(null)}
        />,
        document.body
      )}
    </>
  );
}

function ReviewRequestSection({ lead }) {
  const [settings, setSettings] = useState({ googlePlaceId: '', reviewMessageTemplate: '', name: '' });
  const [copied, setCopied] = useState(null); // 'link' | 'sms' | 'email'

  useEffect(() => {
    client.get('/crm/tenant-settings')
      .then(res => setSettings({
        ...res.data,
        googlePlaceId: typeof res.data.googlePlaceId === 'string' ? res.data.googlePlaceId : '',
        reviewMessageTemplate: typeof res.data.reviewMessageTemplate === 'string' ? res.data.reviewMessageTemplate : '',
      }))
      .catch(() => {});
  }, []);

  const customerFirst = lead.contact_name && lead.contact_name !== '—' ? lead.contact_name.split(' ')[0] : 'there';
  const companyName = settings.name || 'our company';
  const googleReviewUrl = settings.googlePlaceId
    ? `https://search.google.com/local/writereview?placeid=${settings.googlePlaceId}`
    : '';

  const defaultMessage = settings.reviewMessageTemplate
    || `Hi {{name}}, thank you for choosing {{company}}! We'd love to hear about your experience. Would you mind leaving us a quick Google review? {{link}}`;

  const resolvedMessage = defaultMessage
    .replace(/\{\{name\}\}/g, customerFirst)
    .replace(/\{\{company\}\}/g, companyName)
    .replace(/\{\{link\}\}/g, googleReviewUrl || '(Set your Google Place ID in Settings)');

  const handleCopy = async (type) => {
    let text = resolvedMessage;
    if (type === 'link') text = googleReviewUrl || '(No Google Place ID configured)';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  };

  if (!settings.googlePlaceId) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Set your Google Place ID in Settings &rarr; Reviews to enable review requests.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div style={{
        padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
        background: 'oklch(0.25 0.04 145 / 0.15)', border: '1px solid oklch(0.5 0.12 145 / 0.2)',
        fontSize: 12, color: 'oklch(0.78 0.14 145)', lineHeight: 1.5,
      }}>
        {resolvedMessage}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <button className="quick-action-btn" style={{ fontSize: 12, padding: '6px 14px' }}
          onClick={() => handleCopy('link')}>
          {copied === 'link' ? 'Copied!' : 'Copy Review Link'}
        </button>
        <button className="quick-action-btn" style={{ fontSize: 12, padding: '6px 14px' }}
          onClick={() => handleCopy('message')}>
          {copied === 'message' ? 'Copied!' : 'Copy Message'}
        </button>
        {lead.phone && (
          <a href={`sms:${lead.phone}?body=${encodeURIComponent(resolvedMessage)}`}
            className="quick-action-btn"
            style={{ fontSize: 12, padding: '6px 14px', textDecoration: 'none' }}>
            Send SMS
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}?subject=${encodeURIComponent(`Review Request — ${companyName}`)}&body=${encodeURIComponent(resolvedMessage)}`}
            className="quick-action-btn"
            style={{ fontSize: 12, padding: '6px 14px', textDecoration: 'none' }}>
            Send Email
          </a>
        )}
      </div>
    </div>
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

