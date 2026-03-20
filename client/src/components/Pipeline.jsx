import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { getLeads, getPipelineStages, updateLead, getTeamMembers } from '../api/crm';
import { showToast } from './Toast';
import { IconRefresh, IconPlusCircle, IconPhone, IconCalendar, IconFilter, IconX, IconChevronDown, IconEyeOff, IconEye } from './Icons';
import CustomSelect from './CustomSelect';
import useIsMobile from '../hooks/useIsMobile';
import { HomeIcon, FireIcon, SunIcon, CloudIcon } from '@heroicons/react/24/outline';
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

export default function Pipeline() {
  const isMobile = useIsMobile();
  const [columns, setColumns] = useState(fallbackColumns);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
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
        setColumns(stageData.filter(s => s.key !== 'lost'));
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
          bg: '#ffc1c0',
          color: '#b4002b',
          borderColor: '#00daf3',
          dotBg: '#b4002b',
          hasPulse: true,
        };
      case 'warm':
        return {
          label: 'High Wind',
          bg: '#feb300',
          color: '#432c00',
          borderColor: '#feb300',
          dotBg: null,
          hasPulse: false,
        };
      default:
        return {
          label: 'Standard',
          bg: '#2f3444',
          color: '#bac9cc',
          borderColor: '#334155',
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
        background: '#0d1321',
        color: '#dde2f6',
        fontFamily: 'Manrope, sans-serif',
        minHeight: '100vh',
        paddingBottom: 96,
      }}>
        {/* View Toggle & Filter */}
        <div style={{ padding: '0 16px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#00daf3',
              }}>Project Status</span>
              <h2 style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: 24,
                fontWeight: 700,
                color: '#dde2f6',
                margin: 0,
              }}>Pipeline</h2>
            </div>
            <div style={{
              background: '#080e1c',
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
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'all 0.2s',
                  background: mobileViewMode === 'board' ? '#00e5ff' : 'transparent',
                  color: mobileViewMode === 'board' ? '#00363d' : '#94a3b8',
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
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'all 0.2s',
                  background: mobileViewMode === 'list' ? '#00e5ff' : 'transparent',
                  color: mobileViewMode === 'list' ? '#00363d' : '#94a3b8',
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
                  background: isActive ? 'rgba(0, 229, 255, 0.1)' : '#161b2a',
                  borderLeft: isActive ? '2px solid #00e5ff' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.02em',
                  color: isActive ? '#00e5ff' : '#64748b',
                }}>{col.label}</div>
                <div style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#dde2f6',
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

        {/* Lead Cards */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {stageLeads.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '48px 16px',
              color: '#64748b',
              fontSize: 14,
            }}>
              No leads in this stage
            </div>
          )}
          {stageLeads.map(lead => {
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
                  background: '#161b2a',
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
                    fontFamily: 'Space Grotesk, sans-serif',
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
                        boxShadow: '0 0 0 0 rgba(180, 0, 43, 0.7)',
                        animation: 'pulse 2s infinite',
                      }} />
                    )}
                    {badge.label}
                  </div>
                </div>

                {/* Name & Location */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                  <h3 style={{
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#dde2f6',
                    lineHeight: 1.2,
                    margin: 0,
                    paddingRight: 90,
                  }}>{displayName}</h3>
                  {locationParts && (
                    <p style={{
                      fontSize: 12,
                      color: '#bac9cc',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      margin: 0,
                    }}>
                      <HomeIcon width={20} height={20} style={{ opacity: 0.9 }} />
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
                    <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>payments</span>
                    {lead.financing_status}
                  </span>
                )}

                {/* Footer: Value + Due/Files/Rep */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: '#849396',
                    }}>Project Value</span>
                    <p style={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#00daf3',
                      margin: 0,
                    }}>{lead.estimated_value ? formatCurrency(lead.estimated_value) : '$0'}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {lead.due_date && (() => {
                      const info = dueDateInfo(lead.due_date);
                      return info ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: info.color || '#64748b' }}>schedule</span>
                          <span style={{ fontSize: 10, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: info.color || '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{info.text}</span>
                        </div>
                      ) : null;
                    })()}
                    {lead.document_count > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#64748b' }}>attach_file</span>
                        <span style={{ fontSize: 10, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{lead.document_count} files</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', marginLeft: 4 }}>
                      {lead.rep_first_name && (
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', border: '2px solid #161b2a',
                          background: '#2f3444', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: '#dde2f6',
                        }}>
                          {lead.rep_first_name[0]}{lead.rep_last_name?.[0] || ''}
                        </div>
                      )}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', border: '2px solid #161b2a',
                        background: '#2f3444', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginLeft: lead.rep_first_name ? -8 : 0,
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#dde2f6' }}>add</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
            background: 'linear-gradient(135deg, #00daf3, #00e5ff)',
            color: '#00363d',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 229, 255, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 40,
            fontSize: 30,
            transition: 'transform 0.15s',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 30 }}>add</span>
        </button>

        {/* Pulse animation keyframes */}
        <style>{`
          @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(180, 0, 43, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(180, 0, 43, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(180, 0, 43, 0); }
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
    <div className="main-content pb-0 !overflow-hidden !gap-0" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', padding: 0 }}>
      {/* Header: Single-line toolbar */}
      <div
        className="glass px-4 py-2.5 mx-[var(--space-2xl)] mt-[var(--space-lg)] flex items-center gap-3 shadow-[0_8px_32px_oklch(0_0_0/0.25),inset_0_1px_0_oklch(1_0_0/0.05)]"
        style={{ borderRadius: '20px / 18px', whiteSpace: 'nowrap', flexShrink: 0, zIndex: 20, position: 'relative' }}
      >
        <h1 className="text-[15px] font-bold text-[var(--text-primary)] shrink-0">Sales Pipeline</h1>

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
          className="shrink-0"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            height: 36, padding: '0 14px', fontSize: 12, fontWeight: 600, boxSizing: 'border-box',
            borderRadius: '14px / 12px', border: '1px solid oklch(0.72 0.19 250 / 0.3)',
            cursor: 'pointer', backdropFilter: 'blur(12px)',
            background: 'oklch(0.72 0.19 250 / 0.15)', color: 'var(--accent-blue)',
          }}
        >
          <IconPlusCircle width="13" height="13" />
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
        className="overflow-auto px-[var(--space-2xl)] pb-4 pt-2"
        style={{ gridRow: '2 / 3', cursor: 'grab', userSelect: 'none' }}
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
                      {colTotal > 0 && (
                        <span className="text-[10px] font-bold" style={{ color: 'oklch(0.75 0.18 155)' }}>
                          {formatCurrency(colTotal)}
                        </span>
                      )}
                      <button
                        onClick={() => toggleCollapse(col.key)}
                        title="Collapse column"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}
                      >
                        <IconEyeOff width="13" height="13" />
                      </button>
                      {idx < columns.length - 1 && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={col.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 ml-1" style={{ opacity: 0.45, transform: 'scaleX(-1)' }}>
                          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                        </svg>
                      )}
                    </>
                  )}
                </div>

                {/* Cards (hidden when collapsed) */}
                {!isCollapsed && (
                  <div className="flex flex-col gap-2 pr-1">
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
                          onClick={() => setSelectedLeadId(lead.id)}
                        >
                          {/* Top Row: Priority + Value */}
                          <div className="flex items-center justify-between">
                            {PriorityIcon[lead.priority]
                              ? React.createElement(PriorityIcon[lead.priority], { width: 16, height: 16, className: 'shrink-0' })
                              : <span className={`w-2 h-2 rounded-full shrink-0 ${priorityClasses[lead.priority] || ''}`} />
                            }
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
                              <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>payments</span>
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

                          {/* Footer: Hail + Due date + Rep */}
                          <div className="flex items-center justify-between mt-1 gap-1 flex-wrap">
                            <div className="flex items-center gap-1.5">
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

              {/* Divider line */}
              {idx < columns.length - 1 && !isCollapsed && (
                <div className="shrink-0 w-[16px] self-stretch flex justify-center" style={{ marginTop: 52 }}>
                  <div className="w-[2px] h-full" style={{ background: `linear-gradient(to bottom, color-mix(in oklch, ${col.color} 30%, transparent), color-mix(in oklch, ${col.color} 6%, transparent))` }} />
                </div>
              )}
              {idx < columns.length - 1 && isCollapsed && (
                <div className="shrink-0 w-[4px]" />
              )}
            </React.Fragment>
          );
        })}
        </div>
      </div>

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
