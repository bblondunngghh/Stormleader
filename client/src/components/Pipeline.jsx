import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { getLeads, getLeadDetail, getPipelineStages, updateLead, getTeamMembers } from '../api/crm';
import { getActivities } from '../api/crm';
import { showToast } from './Toast';
import { IconRefresh, IconPlusCircle, IconPhone, IconCalendar, IconFilter, IconX, IconChevronDown, IconEyeOff, IconEye, IconMail } from './Icons';
import CustomSelect from './CustomSelect';
import { UserCircleIcon, FireIcon, SunIcon, CloudIcon, ArrowsPointingOutIcon, CurrencyDollarIcon, WrenchScrewdriverIcon, BanknotesIcon, ArrowLeftIcon, ClockIcon, PaperClipIcon, PlusIcon } from '@heroicons/react/24/outline';
const LeadDetail = lazy(() => import('./LeadDetail'));
const CreateLeadModal = lazy(() => import('./CreateLeadModal'));

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

function formatCurrency(val) {
  const num = Number(val);
  if (!num) return null;
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num}`;
}

function daysInStage(lead) {
  // Use updated_at as proxy for last stage change; fallback to created_at
  const ref = lead.updated_at || lead.created_at;
  if (!ref) return null;
  const now = new Date();
  const then = new Date(ref);
  return Math.max(0, Math.floor((now - then) / 86400000));
}

function daysInStageBadge(days) {
  if (days === null || days === undefined) return null;
  if (days >= 14) return { label: `${days}d`, color: 'oklch(0.68 0.22 25)', bg: 'oklch(0.68 0.22 25 / 0.12)' };
  if (days >= 7) return { label: `${days}d`, color: 'oklch(0.78 0.17 85)', bg: 'oklch(0.78 0.17 85 / 0.12)' };
  if (days >= 1) return { label: `${days}d`, color: 'oklch(0.55 0.02 260)', bg: 'oklch(0.55 0.02 260 / 0.12)' };
  return { label: 'Today', color: 'oklch(0.75 0.18 155)', bg: 'oklch(0.75 0.18 155 / 0.12)' };
}

// Board definitions — Sales / Production / Billing (like JobNimbus)
const BOARD_DEFS = {
  sales: {
    label: 'Sales',
    icon: CurrencyDollarIcon,
    stageKeys: ['new', 'contacted', 'appt_set', 'inspected', 'estimate_sent', 'negotiating', 'sold'],
  },
  production: {
    label: 'Production',
    icon: WrenchScrewdriverIcon,
    stageKeys: ['sold', 'in_production', 'material_ordered', 'scheduled', 'completed'],
  },
  billing: {
    label: 'Billing',
    icon: BanknotesIcon,
    stageKeys: ['completed', 'invoiced', 'paid', 'collections'],
  },
};

function dueDateInfo(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  // Parse as local date to avoid UTC offset causing off-by-one
  const parts = dateStr.substring(0, 10).split('-');
  const due = parts.length === 3 ? new Date(+parts[0], +parts[1] - 1, +parts[2]) : new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - now) / 86400000);
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: 'oklch(0.68 0.22 25)', bg: 'oklch(0.68 0.22 25 / 0.12)' };
  if (diffDays === 0) return { label: 'Due today', color: 'oklch(0.78 0.17 85)', bg: 'oklch(0.78 0.17 85 / 0.12)' };
  if (diffDays <= 3) return { label: `Due in ${diffDays}d`, color: 'oklch(0.78 0.17 85)', bg: 'oklch(0.78 0.17 85 / 0.12)' };
  return { label: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'oklch(0.55 0.02 260)', bg: 'oklch(0.55 0.02 260 / 0.12)' };
}

const priorityClasses = {
  hot: 'bg-[oklch(0.68_0.22_25)] shadow-[0_0_8px_oklch(0.68_0.22_25/0.6)] animate-[pulse-hot_2s_ease-in-out_infinite]',
  warm: 'bg-[oklch(0.78_0.17_85)] shadow-[0_0_6px_oklch(0.78_0.17_85/0.4)]',
  cold: 'bg-[oklch(0.72_0.19_250)]',
};

const priorityTint = {
  hot: 'oklch(0.68 0.22 25 / 0.07)',
  warm: 'oklch(0.78 0.17 85 / 0.07)',
  cold: 'oklch(0.72 0.19 250 / 0.07)',
};

const PriorityIcon = {
  hot: FireIcon,
  warm: SunIcon,
  cold: CloudIcon,
};

const priorityOptions = [
  { value: '', label: 'All Priorities' },
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
];

const sourceOptions = [
  { value: '', label: 'All Sources' },
  { value: 'storm_auto', label: 'Storm' },
  { value: 'manual', label: 'Manual' },
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'door_knock', label: 'Door Knock' },
  { value: 'phone', label: 'Phone' },
  { value: 'other', label: 'Other' },
];

const fallbackColumns = [
  { key: 'new', label: 'New', color: 'oklch(0.72 0.19 250)', position: 0 },
  { key: 'contacted', label: 'Contacted', color: 'oklch(0.75 0.15 200)', position: 1 },
  { key: 'appt_set', label: 'Appt Set', color: 'oklch(0.78 0.17 85)', position: 2 },
  { key: 'inspected', label: 'Inspected', color: 'oklch(0.72 0.20 50)', position: 3 },
  { key: 'estimate_sent', label: 'Estimate Sent', color: 'oklch(0.70 0.18 330)', position: 4 },
  { key: 'negotiating', label: 'Negotiating', color: 'oklch(0.65 0.15 280)', position: 5 },
  { key: 'sold', label: 'Sold', color: 'oklch(0.75 0.18 155)', position: 6 },
];

// ─── SIDEBAR PREVIEW (JobNimbus-style click-to-preview) ───
function SidebarPreview({ leadId, allColumns, onClose, onOpenFull, onStageChange, onLeadUpdated }) {
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!leadId) return;
    setLoadingDetail(true);
    Promise.all([
      getLeadDetail(leadId).then(r => r.data?.lead || r.data),
      getActivities(leadId, { limit: 5 }).then(r => r.data?.activities || r.data || []).catch(() => []),
    ]).then(([leadData, actData]) => {
      setLead(leadData);
      setActivities(Array.isArray(actData) ? actData : []);
    }).catch(() => {
      showToast('Failed to load lead details', 'error');
    }).finally(() => setLoadingDetail(false));
  }, [leadId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    // Delay to avoid the click that opened the panel
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  const handleStageChange = async (newStage) => {
    if (!lead || lead.stage === newStage) return;
    const oldStage = lead.stage;
    setLead(prev => ({ ...prev, stage: newStage }));
    try {
      await updateLead(leadId, { stage: newStage });
      const toLabel = allColumns.find(c => c.key === newStage)?.label || newStage;
      showToast(`Moved to ${toLabel}`, 'success');
      onStageChange(leadId, newStage, oldStage);
    } catch {
      setLead(prev => ({ ...prev, stage: oldStage }));
      showToast('Failed to update stage', 'error');
    }
  };

  const stageColor = allColumns.find(c => c.key === lead?.stage)?.color || 'var(--text-muted)';

  return (
    <>
      <div className="slide-over-backdrop" onClick={onClose} />
      <div ref={panelRef} className="slide-over glass">
        <button className="slide-over__close" onClick={onClose}>
          <IconX />
        </button>

        <div className="slide-over__header">
          <div className="slide-over__priority-row">
            {lead && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px',
                borderRadius: 'var(--radius-pill)', textTransform: 'uppercase',
                background: lead.priority === 'hot' ? 'oklch(0.68 0.22 25 / 0.15)' : lead.priority === 'warm' ? 'oklch(0.78 0.17 85 / 0.15)' : 'oklch(0.72 0.19 250 / 0.15)',
                color: lead.priority === 'hot' ? 'var(--accent-red)' : lead.priority === 'warm' ? 'var(--accent-amber)' : 'var(--accent-blue)',
              }}>
                {lead.priority || 'cold'}
              </span>
            )}
            {lead && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px',
                borderRadius: 'var(--radius-pill)',
                background: `color-mix(in oklch, ${stageColor} 15%, transparent)`,
                color: stageColor,
              }}>
                {allColumns.find(c => c.key === lead.stage)?.label || lead.stage}
              </span>
            )}
          </div>

          <div className="slide-over__name">
            {loadingDetail ? 'Loading...' : lead ? (lead.contact_name ? formatOwner(lead.contact_name) : (lead.address ? titleCase(cleanAddr(lead.address)) : 'Unnamed Lead')) : 'Lead not found'}
          </div>
          {lead?.address && (
            <div className="slide-over__address">
              {titleCase(cleanAddr(lead.address))}
              {lead.city && `, ${titleCase(lead.city)}`}
              {(lead.property_state || lead.state) && ` ${lead.property_state || lead.state}`}
            </div>
          )}
          {lead && (
            <div className="slide-over__value">
              {lead.estimated_value ? formatCurrency(lead.estimated_value) : '$0'}
            </div>
          )}

          {/* Open Full Detail button */}
          {lead && (
            <button
              onClick={() => onOpenFull(leadId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                borderRadius: 'var(--radius-pill)', border: '1px solid oklch(0.72 0.19 250 / 0.3)',
                background: 'oklch(0.72 0.19 250 / 0.12)', color: 'oklch(0.72 0.19 250)',
                cursor: 'pointer',
              }}
            >
              <ArrowsPointingOutIcon width={14} height={14} />
              Open Full Detail
            </button>
          )}
        </div>

        {loadingDetail ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
        ) : lead ? (
          <>
            {/* Stage selector */}
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Pipeline Stage
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {allColumns.map(col => (
                  <button
                    key={col.key}
                    onClick={() => handleStageChange(col.key)}
                    style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 600,
                      borderRadius: 6, cursor: 'pointer',
                      border: lead.stage === col.key ? `2px solid ${col.color}` : '1px solid oklch(0.30 0.02 260)',
                      background: lead.stage === col.key ? `color-mix(in oklch, ${col.color} 15%, transparent)` : 'oklch(0.18 0.02 260)',
                      color: lead.stage === col.key ? col.color : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="glass" style={{ padding: '10px 12px', borderRadius: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>Lead Score</div>
                <div style={{
                  fontSize: 18, fontWeight: 700,
                  color: (lead.lead_score >= 80) ? 'oklch(0.85 0.18 145)' :
                         (lead.lead_score >= 60) ? 'oklch(0.85 0.15 85)' :
                         (lead.lead_score >= 40) ? 'oklch(0.85 0.15 60)' : 'oklch(0.70 0.02 260)',
                }}>
                  {lead.lead_score ?? '—'}<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/100</span>
                </div>
              </div>
              <div className="glass" style={{ padding: '10px 12px', borderRadius: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>Source</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {(lead.source || 'Unknown').replace(/_/g, ' ')}
                </div>
              </div>
            </div>

            {/* Contact info */}
            {(lead.contact_phone || lead.contact_email) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Contact</div>
                {lead.contact_phone && (
                  <a href={`tel:${lead.contact_phone}`} style={{
                    display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                    fontSize: 13, color: 'oklch(0.72 0.19 250)',
                  }}>
                    <IconPhone width={14} height={14} /> {lead.contact_phone}
                  </a>
                )}
                {lead.contact_email && (
                  <a href={`mailto:${lead.contact_email}`} style={{
                    display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                    fontSize: 13, color: 'oklch(0.72 0.19 250)',
                  }}>
                    <IconMail width={14} height={14} /> {lead.contact_email}
                  </a>
                )}
              </div>
            )}

            {/* Storm / hail info */}
            {(lead.hail_size_in || lead.storm_date) && (
              <div className="glass" style={{ padding: '10px 14px', borderRadius: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>Storm Data</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                  {lead.hail_size_in && <span style={{ color: 'var(--text-primary)' }}>🧊 {lead.hail_size_in}" hail</span>}
                  {lead.storm_date && <span style={{ color: 'var(--text-secondary)' }}>📅 {new Date(lead.storm_date).toLocaleDateString()}</span>}
                  {lead.wind_speed_mph && <span style={{ color: 'var(--text-secondary)' }}>💨 {lead.wind_speed_mph} mph</span>}
                </div>
              </div>
            )}

            {/* Assigned rep */}
            {lead.assigned_rep_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'oklch(0.35 0.08 250 / 0.5)', border: '1px solid oklch(0.50 0.10 250 / 0.2)',
                  fontSize: 11, fontWeight: 700, color: 'oklch(0.72 0.19 250)',
                }}>
                  {(lead.assigned_rep_name || '')[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Assigned Rep</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{lead.assigned_rep_name}</div>
                </div>
              </div>
            )}

            {/* Recent activity */}
            {activities.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Recent Activity</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activities.slice(0, 5).map((act, i) => (
                    <div key={act.id || i} style={{
                      padding: '8px 10px', borderRadius: 8,
                      background: 'oklch(0.18 0.02 260)', fontSize: 12,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {(act.type || act.activity_type || '').replace(/_/g, ' ')}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {act.created_at ? new Date(act.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes excerpt */}
            {lead.notes && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Notes</div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {lead.notes}
                </p>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>Lead not found</div>
        )}
      </div>
    </>
  );
}

export default function Pipeline() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768); useEffect(() => { const mq = window.matchMedia('(max-width: 768px)'); const h = (e) => setIsMobile(e.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, []);
  const [allColumns, setAllColumns] = useState(fallbackColumns);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBoard, setActiveBoard] = useState('sales');

  // Filter columns by active board
  const columns = useMemo(() => {
    const boardDef = BOARD_DEFS[activeBoard];
    if (!boardDef) return allColumns;
    return allColumns.filter(col => boardDef.stageKeys.includes(col.key));
  }, [allColumns, activeBoard]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [previewLeadId, setPreviewLeadId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStage, setSelectedStage] = useState(null);
  const [mobileViewMode, setMobileViewMode] = useState('board');

  // Grab-to-pan
  const panRef = useRef(null);
  const panState = useRef({ isPanning: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const handlePanDown = useCallback((e) => {
    // Only pan on middle-click or left-click on empty space (not on cards/buttons)
    if (e.button !== 0 && e.button !== 1) return;
    const tag = e.target.tagName;
    // Don't start pan if clicking interactive elements or card content
    if (e.target.closest('[draggable="true"]') || e.target.closest('button') || e.target.closest('a') || tag === 'INPUT' || tag === 'SELECT') return;
    const el = panRef.current;
    if (!el) return;
    panState.current = { isPanning: true, startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    el.style.cursor = 'grabbing';
    e.preventDefault();
  }, []);

  const handlePanMove = useCallback((e) => {
    if (!panState.current.isPanning) return;
    const el = panRef.current;
    if (!el) return;
    const dx = e.clientX - panState.current.startX;
    const dy = e.clientY - panState.current.startY;
    el.scrollLeft = panState.current.scrollLeft - dx;
    el.scrollTop = panState.current.scrollTop - dy;
  }, []);

  const handlePanUp = useCallback(() => {
    panState.current.isPanning = false;
    if (panRef.current) panRef.current.style.cursor = 'grab';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handlePanMove);
    document.addEventListener('mouseup', handlePanUp);
    return () => {
      document.removeEventListener('mousemove', handlePanMove);
      document.removeEventListener('mouseup', handlePanUp);
    };
  }, [handlePanMove, handlePanUp]);

  // Filters
  const [filterPriority, setFilterPriority] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterRep, setFilterRep] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);

  // Collapsible columns
  const [collapsedCols, setCollapsedCols] = useState(() => {
    try {
      const saved = localStorage.getItem('pipeline_collapsed');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const toggleCollapse = (key) => {
    setCollapsedCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem('pipeline_collapsed', JSON.stringify([...next]));
      return next;
    });
  };

  // Build rep options from team members
  const repOptions = useMemo(() => [
    { value: '', label: 'All Reps' },
    ...teamMembers.map(m => ({
      value: String(m.id),
      label: [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email,
    })),
  ], [teamMembers]);

  // Fetch team once
  useEffect(() => {
    getTeamMembers().then(res => setTeamMembers(res.data?.members || [])).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const params = { limit: 500, sort_by: 'created_at', sort_dir: 'DESC' };
      if (filterPriority) params.priority = filterPriority;
      if (filterSource) params.source = filterSource;
      if (filterRep) params.assigned_rep_id = filterRep;

      const [stagesRes, leadsRes] = await Promise.all([
        getPipelineStages().catch(() => null),
        getLeads(params),
      ]);

      const stageData = stagesRes?.data?.stages || stagesRes?.data;
      if (Array.isArray(stageData) && stageData.length) {
        setAllColumns(stageData.filter(s => s.key !== 'lost'));
      }

      setLeads(leadsRes.data.leads || []);
    } catch {
      // fallback columns already set
    } finally {
      setLoading(false);
    }
  }, [filterPriority, filterSource, filterRep]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Active filters for pills
  const activeFilters = useMemo(() => {
    const pills = [];
    if (filterPriority) pills.push({
      key: 'priority', label: `Priority: ${priorityOptions.find(o => o.value === filterPriority)?.label}`,
      clear: () => setFilterPriority(''),
    });
    if (filterSource) pills.push({
      key: 'source', label: `Source: ${sourceOptions.find(o => o.value === filterSource)?.label}`,
      clear: () => setFilterSource(''),
    });
    if (filterRep) pills.push({
      key: 'rep', label: `Rep: ${repOptions.find(o => o.value === filterRep)?.label}`,
      clear: () => setFilterRep(''),
    });
    return pills;
  }, [filterPriority, filterSource, filterRep, repOptions]);

  const clearAllFilters = () => {
    setFilterPriority('');
    setFilterSource('');
    setFilterRep('');
  };

  const handleDragStart = (e, lead) => {
    setDragState({ leadId: lead.id, fromStage: lead.stage });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lead.id);
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

  const handleDrop = async (e, toStage) => {
    e.preventDefault();
    if (!dragState || dragState.fromStage === toStage) return;

    const leadId = dragState.leadId;
    const lead = leads.find(l => l.id === leadId);
    const toLabel = columns.find(c => c.key === toStage)?.label || toStage;

    // Optimistic update
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, stage: toStage } : l
    ));

    // Toast
    const name = lead?.contact_name ? formatOwner(lead.contact_name) : (lead?.address ? titleCase(cleanAddr(lead.address)) : 'Lead');
    showToast(`${name} moved to ${toLabel}`, 'success');

    const fromStage = dragState.fromStage;
    try {
      await updateLead(leadId, { stage: toStage });
    } catch {
      showToast('Failed to move lead', 'error');
      // Revert only this lead, don't clobber other concurrent moves
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: fromStage } : l));
    }
    setDragState(null);
  };

  const handleLeadUpdated = () => { fetchData(); };

  // Initialize selectedStage to first column key once columns load
  const effectiveStage = selectedStage || (columns.length > 0 ? columns[0].key : null);

  // Mobile priority badge mapping
  const mobilePriorityBadge = (priority) => {
    switch (priority) {
      case 'hot':
        return {
          label: 'Emergency',
          bg: 'oklch(0.85 0.10 25)',
          color: 'oklch(0.35 0.18 25)',
          borderColor: 'var(--accent-cyan)',
          dotBg: 'oklch(0.35 0.18 25)',
          hasPulse: true,
        };
      case 'warm':
        return {
          label: 'High Wind',
          bg: 'var(--accent-amber)',
          color: 'oklch(0.30 0.10 85)',
          borderColor: 'var(--accent-amber)',
          dotBg: null,
          hasPulse: false,
        };
      default:
        return {
          label: 'Standard',
          bg: 'oklch(0.22 0.02 260)',
          color: 'var(--text-secondary)',
          borderColor: 'oklch(0.30 0.02 260)',
          dotBg: null,
          hasPulse: false,
        };
    }
  };

  if (loading) {
    return (
      <div className="main-content flex items-center justify-center">
        <span className="text-[oklch(0.55_0.02_260)]">Loading pipeline...</span>
      </div>
    );
  }

  // ─── MOBILE LAYOUT ───
  if (isMobile) {
    const stageLeads = leads.filter(l => l.stage === effectiveStage);

    return (
      <div style={{
        background: 'var(--bg-deep)',
        color: 'var(--text-primary)',
        fontFamily: 'Manrope, sans-serif',
        minHeight: '100vh',
        paddingBottom: 96,
      }}>
        {/* View Toggle & Filter */}
        <div style={{ padding: '0 16px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontFamily: 'inherit',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--accent-cyan)',
              }}>Project Status</span>
              <h2 style={{
                fontFamily: 'inherit',
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
              }}>Pipeline</h2>
            </div>
            <div style={{
              background: 'oklch(0.10 0.02 260)',
              padding: 4,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
            }}>
              <button
                onClick={() => setMobileViewMode('board')}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'all 0.2s',
                  background: mobileViewMode === 'board' ? 'var(--accent-cyan)' : 'transparent',
                  color: mobileViewMode === 'board' ? 'oklch(0.25 0.06 200)' : 'var(--text-muted)',
                }}
              >Board</button>
              <button
                onClick={() => setMobileViewMode('list')}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'all 0.2s',
                  background: mobileViewMode === 'list' ? 'var(--accent-cyan)' : 'transparent',
                  color: mobileViewMode === 'list' ? 'oklch(0.25 0.06 200)' : 'var(--text-muted)',
                }}
              >List</button>
            </div>
          </div>
        </div>

        {/* Horizontal Stage Pills */}
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          gap: 12,
          paddingBottom: 16,
          paddingLeft: 16,
          paddingRight: 16,
          marginBottom: 16,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {columns.map(col => {
            const colLeads = leads.filter(l => l.stage === col.key);
            const colTotal = colLeads.reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);
            const isActive = effectiveStage === col.key;
            return (
              <div
                key={col.key}
                onClick={() => setSelectedStage(col.key)}
                style={{
                  flexShrink: 0,
                  padding: '8px 16px',
                  borderRadius: 12,
                  background: isActive ? 'oklch(0.78 0.12 200 / 0.1)' : 'var(--bg-surface)',
                  borderLeft: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  fontFamily: 'inherit',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.02em',
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                }}>{col.label}</div>
                <div style={{
                  fontFamily: 'inherit',
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}>
                  {colLeads.length}{' '}
                  {colTotal > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.5 }}>
                      ({formatCurrency(colTotal)})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lead Cards or List */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: mobileViewMode === 'list' ? 2 : 16 }}>
          {stageLeads.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '48px 16px',
              color: 'var(--text-muted)',
              fontSize: 14,
            }}>
              No leads in this stage
            </div>
          )}
          {mobileViewMode === 'list' ? (
            /* ── COMPACT LIST VIEW ── */
            stageLeads.map(lead => {
              const days = daysInStage(lead);
              const daysBadge = daysInStageBadge(days);
              const displayName = lead.contact_name
                ? formatOwner(lead.contact_name)
                : (lead.address ? titleCase(cleanAddr(lead.address)) : 'Unknown Lead');
              const stageCol = columns.find(c => c.key === lead.stage);

              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  style={{
                    background: 'var(--bg-surface)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    borderLeft: `3px solid ${stageCol?.color || 'var(--accent-cyan)'}`,
                  }}
                >
                  {/* Priority dot */}
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: lead.priority === 'hot' ? 'oklch(0.68 0.22 25)' : lead.priority === 'warm' ? 'oklch(0.78 0.17 85)' : 'oklch(0.55 0.02 260)',
                  }} />
                  {/* Name + address */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {displayName}
                    </div>
                    {lead.address && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {titleCase(cleanAddr(lead.address))}
                      </div>
                    )}
                  </div>
                  {/* Task progress */}
                  {lead.task_total > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                      color: lead.task_done === lead.task_total ? 'oklch(0.75 0.18 155)' : 'oklch(0.65 0.12 250)',
                    }}>
                      ✓{lead.task_done}/{lead.task_total}
                    </span>
                  )}
                  {/* Days badge */}
                  {daysBadge && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, flexShrink: 0,
                      color: daysBadge.color, background: daysBadge.bg,
                    }}>
                      {daysBadge.label}
                    </span>
                  )}
                  {/* Value */}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-cyan)', flexShrink: 0 }}>
                    {lead.estimated_value ? formatCurrency(lead.estimated_value) : '—'}
                  </span>
                </div>
              );
            })
          ) : (
            /* ── BOARD/CARD VIEW (existing) ── */
            stageLeads.map(lead => {
            const badge = mobilePriorityBadge(lead.priority);
            const city = lead.city?.trim() || '';
            const st = (lead.property_state || lead.state || '').trim();
            const zip = (lead.property_zip || lead.zip || '').trim();
            const locationParts = [
              lead.address ? titleCase(cleanAddr(lead.address)) : '',
              city ? titleCase(city) : '',
              st,
            ].filter(Boolean).join(', ');
            const displayName = lead.contact_name
              ? formatOwner(lead.contact_name)
              : (lead.address ? titleCase(cleanAddr(lead.address)) : 'Unknown Lead');

            return (
              <div
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 12,
                  padding: 16,
                  position: 'relative',
                  overflow: 'hidden',
                  borderLeft: `2px solid ${badge.borderColor}`,
                  cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}
              >
                {/* Priority Badge */}
                <div style={{ position: 'absolute', top: 0, right: 0, padding: 12 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    background: badge.bg,
                    color: badge.color,
                    fontSize: 10,
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {badge.hasPulse && (
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: badge.dotBg,
                        boxShadow: '0 0 0 0 oklch(0.45 0.22 25 / 0.7)',
                        animation: 'pulse 2s infinite',
                      }} />
                    )}
                    {badge.label}
                  </div>
                </div>

                {/* Name & Location */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                  <h3 style={{
                    fontFamily: 'inherit',
                    fontSize: 18,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    lineHeight: 1.2,
                    margin: 0,
                    paddingRight: 90,
                  }}>{displayName}</h3>
                  {locationParts && (
                    <p style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      margin: 0,
                    }}>
                      <UserCircleIcon width={20} height={20} style={{ opacity: 0.9 }} />
                      {locationParts}
                    </p>
                  )}
                </div>

                {/* Financing Badge (mobile) */}
                {lead.financing_status && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '0.7rem', padding: '2px 6px', borderRadius: '999px',
                    marginBottom: 8,
                    background: ['approved','funded'].includes(lead.financing_status) ? 'oklch(0.45 0.12 145 / 0.3)' :
                                ['declined'].includes(lead.financing_status) ? 'oklch(0.45 0.12 25 / 0.3)' :
                                'oklch(0.55 0.12 85 / 0.3)',
                    color: ['approved','funded'].includes(lead.financing_status) ? 'oklch(0.8 0.15 145)' :
                           ['declined'].includes(lead.financing_status) ? 'oklch(0.8 0.15 25)' :
                           'oklch(0.8 0.15 85)',
                  }}>
                    <BanknotesIcon style={{ width: 14, height: 14 }} />
                    {lead.financing_status}
                  </span>
                )}

                {/* Footer: Value + Due/Files/Rep */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{
                      fontFamily: 'inherit',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--text-muted)',
                    }}>Project Value</span>
                    <p style={{
                      fontFamily: 'inherit',
                      fontSize: 20,
                      fontWeight: 700,
                      color: 'var(--accent-cyan)',
                      margin: 0,
                    }}>{lead.estimated_value ? formatCurrency(lead.estimated_value) : '$0'}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {lead.due_date && (() => {
                      const info = dueDateInfo(lead.due_date);
                      return info ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ClockIcon style={{ width: 16, height: 16, color: info.color || 'var(--text-muted)' }} />
                          <span style={{ fontSize: 10, fontFamily: 'inherit', fontWeight: 700, color: info.color || 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{info.text}</span>
                        </div>
                      ) : null;
                    })()}
                    {lead.document_count > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <PaperClipIcon style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: 10, fontFamily: 'inherit', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{lead.document_count} files</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', marginLeft: 4 }}>
                      {lead.rep_first_name && (
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--bg-surface)',
                          background: 'oklch(0.22 0.02 260)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: 'var(--text-primary)',
                        }}>
                          {lead.rep_first_name[0]}{lead.rep_last_name?.[0] || ''}
                        </div>
                      )}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--bg-surface)',
                        background: 'oklch(0.22 0.02 260)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginLeft: lead.rep_first_name ? -8 : 0,
                      }}>
                        <PlusIcon style={{ width: 12, height: 12, color: 'var(--text-primary)' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            position: 'fixed',
            bottom: 96,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, oklch(0.78 0.12 200), oklch(0.80 0.12 200))',
            color: 'oklch(0.25 0.06 200)',
            border: 'none',
            boxShadow: '0 4px 20px oklch(0.78 0.12 200 / 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 40,
            fontSize: 30,
            transition: 'transform 0.15s',
          }}
        >
          <PlusIcon style={{ width: 30, height: 30 }} />
        </button>

        {/* Pulse animation keyframes */}
        <style>{`
          @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 oklch(0.45 0.22 25 / 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px oklch(0.45 0.22 25 / 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 oklch(0.45 0.22 25 / 0); }
          }
        `}</style>

        {selectedLeadId && (
          <Suspense fallback={null}>
            <LeadDetail
              leadId={selectedLeadId}
              onClose={() => setSelectedLeadId(null)}
              onUpdated={handleLeadUpdated}
            />
          </Suspense>
        )}

        {showCreateModal && (
          <Suspense fallback={null}>
            <CreateLeadModal
              onClose={() => setShowCreateModal(false)}
              onCreated={() => { fetchData(); }}
            />
          </Suspense>
        )}
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───
  return (
    <div className="main-content pb-0 !overflow-hidden !gap-0" style={{ padding: 0 }}>
      {/* Header: Single-line toolbar */}
      <div
        className="glass px-4 py-2.5 mt-[var(--space-lg)] flex items-center gap-3 shadow-[0_8px_32px_oklch(0_0_0/0.25),inset_0_1px_0_oklch(1_0_0/0.05)]"
        style={{ borderRadius: '20px / 18px', whiteSpace: 'nowrap', flexShrink: 0, zIndex: 20, position: 'relative' }}
      >
        {/* Board Tabs — Sales / Production / Billing (JobNimbus style) */}
        <div className="flex items-center shrink-0" style={{ background: 'oklch(0.12 0.02 260 / 0.5)', borderRadius: 10, padding: 2 }}>
          {Object.entries(BOARD_DEFS).map(([key, def]) => (
            <button
              key={key}
              onClick={() => setActiveBoard(key)}
              className="shrink-0"
              style={{
                padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
                transition: 'all 0.15s',
                background: activeBoard === key ? 'var(--accent-cyan)' : 'transparent',
                color: activeBoard === key ? 'oklch(0.15 0.04 200)' : 'var(--text-muted)',
              }}
            >
              <def.icon width={13} height={13} style={{ marginRight: 4, display: 'inline', verticalAlign: '-2px' }} />{def.label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="shrink-0" style={{ width: 1, height: 22, background: 'var(--glass-border)' }} />

        {/* Filters */}
        <IconFilter width="13" height="13" className="shrink-0" style={{ color: 'var(--text-muted)' }} />
        <CustomSelect value={filterPriority} onChange={setFilterPriority} options={priorityOptions} placeholder="Priority" style={{ minWidth: 110 }} />
        <CustomSelect value={filterSource} onChange={setFilterSource} options={sourceOptions} placeholder="Source" style={{ minWidth: 110 }} />
        <CustomSelect value={filterRep} onChange={setFilterRep} options={repOptions} placeholder="Sales Rep" style={{ minWidth: 120 }} />

        {/* Separator */}
        <div className="shrink-0" style={{ width: 1, height: 22, background: 'var(--glass-border)' }} />

        {/* Refresh */}
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          title="Refresh"
          className="shrink-0"
          style={{
            background: 'oklch(0.22 0.02 260 / 0.45)', border: '1px solid var(--glass-border)',
            cursor: 'pointer', color: 'var(--text-muted)',
            width: 36, height: 36, padding: 0, boxSizing: 'border-box',
            borderRadius: '14px / 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(12px)',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <IconRefresh width="14" height="14" />
        </button>

        {/* Add Lead */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="auth-btn shrink-0"
          style={{ gap: 6 }}
        >
          <IconPlusCircle width={14} height={14} />
          Add Lead
        </button>

        {/* Active filter pills */}
        {activeFilters.length > 0 && (
          <>
            {activeFilters.map(f => (
              <span key={f.key} className="filter-pill shrink-0">
                {f.label}
                <button onClick={f.clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 0 0 6px', fontSize: 12, lineHeight: 1 }}>&times;</button>
              </span>
            ))}
            {activeFilters.length > 1 && (
              <button onClick={clearAllFilters} className="shrink-0" style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--accent-blue)', fontSize: 11, fontWeight: 600,
              }}>
                Clear All
              </button>
            )}
          </>
        )}
      </div>

      {/* Scrollable Pipeline Area — grab to pan */}
      <div
        ref={panRef}
        className="overflow-auto pb-4 pt-2"
        style={{ flex: 1, minHeight: 0, cursor: 'grab', userSelect: 'none' }}
        onMouseDown={handlePanDown}
      >
        <div className="flex items-stretch" style={{ minWidth: '100%' }}>
        {columns.map((col, idx) => {
          const colLeads = leads.filter((l) => l.stage === col.key);
          const isDropTarget = dragState && dragState.fromStage !== col.key;
          const isCollapsed = collapsedCols.has(col.key);
          const colTotal = colLeads.reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);

          return (
            <React.Fragment key={col.key}>
              {/* Column: header + cards */}
              <div
                className={`flex flex-col gap-2 ${isCollapsed ? 'min-w-[48px] max-w-[48px]' : 'min-w-[280px] w-[280px]'}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.key)}
                style={isDropTarget ? { outline: `2px dashed ${col.color}`, outlineOffset: -2, borderRadius: 12 } : undefined}
              >
                {/* Column Header */}
                <div
                  className="
                    glass flex items-center gap-2 px-4 py-3 sticky top-0 z-10
                    shadow-[0_8px_32px_oklch(0_0_0/0.25),inset_0_1px_0_oklch(1_0_0/0.05)]
                  "
                  style={{ borderRadius: '20px / 18px', whiteSpace: 'nowrap', cursor: isCollapsed ? 'pointer' : 'default', justifyContent: isCollapsed ? 'center' : undefined }}
                  onClick={isCollapsed ? () => toggleCollapse(col.key) : undefined}
                >
                  {isCollapsed ? (
                    <div className="flex flex-col items-center gap-1.5 py-1 w-full">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.color }} />
                      <span className="text-[11px] font-bold" style={{ color: col.color }}>
                        {colLeads.length}
                      </span>
                      <IconEye width="12" height="12" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  ) : (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.color }} />
                      <span className="text-[13px] font-bold flex-1 truncate" style={{ color: col.color }}>{col.label}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: col.color, background: `color-mix(in oklch, ${col.color} 12%, transparent)` }}>
                        {colLeads.length}
                      </span>
                      <span className="text-[14px] font-bold" style={{ color: 'oklch(0.75 0.18 155)' }}>
                        {formatCurrency(colTotal)}
                      </span>
                      <button
                        onClick={() => toggleCollapse(col.key)}
                        title="Collapse column"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}
                      >
                        <IconEyeOff width="13" height="13" />
                      </button>
                      {idx < columns.length - 1 && (
                        <ArrowLeftIcon width={16} height={16} className="shrink-0 ml-1" style={{ opacity: 0.45, transform: 'scaleX(-1)', color: col.color }} />
                      )}
                    </>
                  )}
                </div>

                {/* Cards (hidden when collapsed) */}
                {!isCollapsed && (
                  <div className="flex flex-col gap-2 pr-1">
                    {colLeads.length === 0 && (
                      <div style={{
                        textAlign: 'center', padding: '32px 12px',
                        color: 'var(--text-muted)', fontSize: 12, opacity: 0.6,
                      }}>
                        No leads in this stage
                      </div>
                    )}
                    {colLeads.map((lead) => {
                      const dueInfo = dueDateInfo(lead.next_follow_up);
                      return (
                        <div
                          key={lead.id}
                          className="
                            glass p-4 flex flex-col gap-2 cursor-pointer
                            shadow-[0_8px_32px_oklch(0_0_0/0.25),inset_0_1px_0_oklch(1_0_0/0.05)]
                          "
                          style={{ borderRadius: '20px / 18px', background: priorityTint[lead.priority] || undefined }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, lead)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setPreviewLeadId(lead.id)}
                        >
                          {/* Top Row: Priority + Tasks + Value */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {PriorityIcon[lead.priority]
                                ? React.createElement(PriorityIcon[lead.priority], { width: 16, height: 16, className: 'shrink-0' })
                                : <span className={`w-2 h-2 rounded-full shrink-0 ${priorityClasses[lead.priority] || ''}`} />
                              }
                              {lead.task_total > 0 && (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                                  style={{
                                    color: lead.task_done === lead.task_total ? 'oklch(0.75 0.18 155)' : 'oklch(0.65 0.12 250)',
                                    background: lead.task_done === lead.task_total ? 'oklch(0.75 0.18 155 / 0.12)' : 'oklch(0.65 0.12 250 / 0.12)',
                                  }}
                                  title={`${lead.task_done}/${lead.task_total} tasks completed`}
                                >
                                  ✓ {lead.task_done}/{lead.task_total}
                                </span>
                              )}
                            </div>
                            {lead.estimated_value && (
                              <span className="text-[13px] font-bold text-[oklch(0.75_0.18_155)]">
                                {formatCurrency(lead.estimated_value)}
                              </span>
                            )}
                          </div>

                          {/* Financing Badge */}
                          {lead.financing_status && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              fontSize: '0.7rem', padding: '2px 6px', borderRadius: '999px',
                              background: ['approved','funded'].includes(lead.financing_status) ? 'oklch(0.45 0.12 145 / 0.3)' :
                                          ['declined'].includes(lead.financing_status) ? 'oklch(0.45 0.12 25 / 0.3)' :
                                          'oklch(0.55 0.12 85 / 0.3)',
                              color: ['approved','funded'].includes(lead.financing_status) ? 'oklch(0.8 0.15 145)' :
                                     ['declined'].includes(lead.financing_status) ? 'oklch(0.8 0.15 25)' :
                                     'oklch(0.8 0.15 85)',
                            }}>
                              <BanknotesIcon style={{ width: 14, height: 14 }} />
                              {lead.financing_status}
                            </span>
                          )}

                          {/* Address */}
                          {lead.address && (() => {
                            const city = lead.city?.trim() || '';
                            const st = (lead.property_state || lead.state || '').trim();
                            const zip = (lead.property_zip || lead.zip || '').trim();
                            const cityLine = [city ? titleCase(city) : '', st, zip && zip !== '0' ? zip : ''].filter(Boolean).join(', ').replace(/, (\d)/, ' $1');
                            return (
                              <div className="text-[13px] font-semibold leading-snug">
                                <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[oklch(0.55_0.02_260)]">Address</div>
                                <div>{titleCase(cleanAddr(lead.address))}</div>
                                {cityLine && <div className="text-[11px] text-[oklch(0.55_0.02_260)]">{cityLine}</div>}
                              </div>
                            );
                          })()}

                          {/* Owner */}
                          {lead.contact_name && (
                            <div className="text-[12px] text-[oklch(0.70_0.02_260)]">
                              <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[oklch(0.55_0.02_260)]">Owner</div>
                              {formatOwner(lead.contact_name)}
                            </div>
                          )}

                          {/* Phone */}
                          {lead.contact_phone && (
                            <a
                              href={`tel:${lead.contact_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-[11px] text-[oklch(0.72_0.19_250)] hover:text-[oklch(0.80_0.19_250)]"
                              style={{ textDecoration: 'none' }}
                            >
                              <IconPhone width="11" height="11" />
                              {lead.contact_phone}
                            </a>
                          )}

                          {/* Footer: Days-in-stage + Score + Hail + Due date + Rep */}
                          <div className="flex items-center justify-between mt-1 gap-1 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              {(() => {
                                const days = daysInStage(lead);
                                const badge = daysInStageBadge(days);
                                return badge ? (
                                  <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ color: badge.color, background: badge.bg }}
                                    title={`${days} day${days !== 1 ? 's' : ''} in this stage`}
                                  >
                                    {badge.label}
                                  </span>
                                ) : null;
                              })()}
                              {lead.lead_score != null && lead.lead_score > 0 && (
                                <span
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{
                                    color: lead.lead_score >= 80 ? 'oklch(0.85 0.18 145)'
                                      : lead.lead_score >= 60 ? 'oklch(0.85 0.15 85)'
                                      : lead.lead_score >= 40 ? 'oklch(0.85 0.15 60)'
                                      : 'oklch(0.70 0.02 260)',
                                    background: lead.lead_score >= 80 ? 'oklch(0.35 0.12 145 / 0.4)'
                                      : lead.lead_score >= 60 ? 'oklch(0.35 0.1 85 / 0.4)'
                                      : lead.lead_score >= 40 ? 'oklch(0.35 0.1 60 / 0.4)'
                                      : 'oklch(0.25 0 0 / 0.3)',
                                  }}
                                  title={`Lead score: ${lead.lead_score}/100`}
                                >
                                  {lead.lead_score}
                                </span>
                              )}
                              {lead.source && (
                                <span
                                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                                  style={{
                                    color: 'oklch(0.6 0.02 260)',
                                    background: 'oklch(0.2 0.01 260 / 0.5)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                  }}
                                  title={`Source: ${lead.source}`}
                                >
                                  {lead.source.replace(/_/g, ' ')}
                                </span>
                              )}
                              {lead.hail_size_in && (
                                <span className="
                                  text-[11px] font-semibold px-2 py-0.5 rounded-full
                                  bg-[oklch(0.30_0.04_260/0.5)] text-[oklch(0.70_0.02_260)]
                                  backdrop-blur-sm border border-[oklch(0.40_0.02_260/0.15)]
                                ">
                                  {`\u{1F9CA} ${lead.hail_size_in}"`}
                                </span>
                              )}
                              {dueInfo && (
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                                  style={{ color: dueInfo.color, background: dueInfo.bg }}
                                >
                                  <IconCalendar width="9" height="9" />
                                  {dueInfo.label}
                                </span>
                              )}
                            </div>
                            {lead.rep_first_name && (
                              <span className="
                                w-[26px] h-[26px] rounded-full flex items-center justify-center
                                text-[10px] font-bold text-[oklch(0.72_0.19_250)]
                                bg-[oklch(0.35_0.08_250/0.5)] border border-[oklch(0.50_0.10_250/0.2)]
                              ">
                                {lead.rep_first_name[0]}{lead.rep_last_name?.[0] || ''}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Collapsed — header is the expand trigger, no extra button needed */}
              </div>

              {/* Divider line with conversion rate */}
              {idx < columns.length - 1 && !isCollapsed && (() => {
                const nextCol = columns[idx + 1];
                const nextLeads = leads.filter(l => l.stage === nextCol.key);
                const convRate = colLeads.length > 0 ? Math.round((nextLeads.length / colLeads.length) * 100) : 0;
                return (
                  <div className="shrink-0 w-[40px] self-stretch flex flex-col items-center" style={{ marginTop: 52 }}>
                    {colLeads.length > 0 && nextLeads.length > 0 && (
                      <span
                        className="text-[9px] font-bold py-0.5 px-1.5 rounded-full mb-1 whitespace-nowrap"
                        style={{
                          color: convRate >= 50 ? 'oklch(0.75 0.18 155)' : convRate >= 25 ? 'oklch(0.78 0.17 85)' : 'oklch(0.68 0.22 25)',
                          background: convRate >= 50 ? 'oklch(0.75 0.18 155 / 0.12)' : convRate >= 25 ? 'oklch(0.78 0.17 85 / 0.12)' : 'oklch(0.68 0.22 25 / 0.12)',
                        }}
                        title={`${convRate}% of ${col.label} leads are in ${nextCol.label}`}
                      >
                        {convRate}%
                      </span>
                    )}
                    <div className="w-[2px] flex-1" style={{ background: `linear-gradient(to bottom, color-mix(in oklch, ${col.color} 30%, transparent), color-mix(in oklch, ${col.color} 6%, transparent))` }} />
                  </div>
                );
              })()}
              {idx < columns.length - 1 && isCollapsed && (
                <div className="shrink-0 w-[4px]" />
              )}
            </React.Fragment>
          );
        })}
        </div>
      </div>

      {/* Sidebar preview — JobNimbus-style click-to-preview */}
      {previewLeadId && (
        <SidebarPreview
          leadId={previewLeadId}
          allColumns={allColumns}
          onClose={() => setPreviewLeadId(null)}
          onOpenFull={(id) => { setPreviewLeadId(null); setSelectedLeadId(id); }}
          onStageChange={(id, newStage, oldStage) => {
            setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: newStage } : l));
          }}
          onLeadUpdated={handleLeadUpdated}
        />
      )}

      {selectedLeadId && (
        <Suspense fallback={null}>
          <LeadDetail
            leadId={selectedLeadId}
            onClose={() => setSelectedLeadId(null)}
            onUpdated={handleLeadUpdated}
          />
        </Suspense>
      )}

      {showCreateModal && (
        <Suspense fallback={null}>
          <CreateLeadModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => { fetchData(); }}
          />
        </Suspense>
      )}
    </div>
  );
}
