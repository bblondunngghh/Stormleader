import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as estimatesApi from '../api/estimates';
import client from '../api/client';
import { calcMonthlyPayment, formatMoney } from '../utils/financing';
import { formatCurrency } from '../utils/currency';
import { IconX, IconFileText, IconDollar, IconSend, IconClipboard, IconTrash, IconPlusCircle, IconArrowLeft, IconEye, IconEyeOff, IconChevronDown, IconRefresh } from './Icons';
import CustomSelect from './CustomSelect';
import DatePicker from './DatePicker';
import { showToast } from './Toast';
import { SRSCatalogModal } from './MaterialsView';
import * as materialsApi from '../api/materials';
import { CloudIcon, ClockIcon, CheckCircleIcon, BanknotesIcon, ClipboardDocumentListIcon, ShieldCheckIcon, Squares2X2Icon, ListBulletIcon, NumberedListIcon, LinkIcon, PrinterIcon, DocumentArrowDownIcon, PhotoIcon, QuestionMarkCircleIcon, PlusCircleIcon, PencilSquareIcon, TrashIcon, EyeIcon, EnvelopeIcon, DocumentDuplicateIcon, ArrowUpCircleIcon } from '@heroicons/react/24/outline';

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const statusColors = {
  draft: 'var(--text-muted)',
  sent: 'var(--accent-blue)',
  viewed: 'var(--accent-amber)',
  accepted: 'var(--accent-green)',
  declined: 'var(--accent-red)',
  expired: 'var(--text-muted)',
};

export default function EstimatesView() {
  const [estimates, setEstimates] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [editingEstimate, setEditingEstimate] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  const fetchEstimates = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await estimatesApi.getEstimates(params);
      setEstimates(res.data.estimates || []);
      setTotal(res.data.total || 0);
      setStats(res.data.stats || null);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchEstimates(); }, [fetchEstimates]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768); useEffect(() => { const mq = window.matchMedia('(max-width: 768px)'); const h = (e) => setIsMobile(e.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, []);

  const totalValue = estimates.reduce((s, e) => s + Number(e.total || 0), 0);
  // Roll-ups come from the server so they cover the whole filtered set, not just the
  // page of 50 fetched above; the page-local reduce stays as the fallback for the
  // first paint and for any response that predates the stats field.
  const draftCount = stats ? stats.draft_count : estimates.filter(e => e.status === 'draft').length;
  const draftValue = stats ? stats.draft_value : estimates.filter(e => e.status === 'draft').reduce((s, e) => s + Number(e.total || 0), 0);
  const sentCount = stats ? stats.sent_count : estimates.filter(e => e.status === 'sent' || e.status === 'viewed').length;
  const sentValue = stats ? stats.sent_value : estimates.filter(e => e.status === 'sent' || e.status === 'viewed').reduce((s, e) => s + Number(e.total || 0), 0);
  const acceptedCount = stats ? stats.accepted_count : estimates.filter(e => e.status === 'accepted').length;
  const acceptedValue = stats ? stats.accepted_value : estimates.filter(e => e.status === 'accepted').reduce((s, e) => s + Number(e.total || 0), 0);

  const handleNew = () => {
    setEditingEstimate(null);
    setShowBuilder(true);
  };

  const handleEdit = (est) => {
    setEditingEstimate(est);
    setShowBuilder(true);
  };

  const handleSaved = () => {
    setShowBuilder(false);
    setEditingEstimate(null);
    fetchEstimates();
  };

  const handleDuplicate = async (est) => {
    try {
      await estimatesApi.duplicateEstimate(est.id);
      fetchEstimates();
    } catch { /* silent */ }
  };

  const handleSend = async (est) => {
    try {
      await estimatesApi.sendEstimate(est.id);
      fetchEstimates();
    } catch { /* silent */ }
  };

  const handleDelete = async (est) => {
    try {
      await estimatesApi.deleteEstimate(est.id);
      fetchEstimates();
    } catch { /* silent */ }
  };

  const handleDownloadPdf = async (est) => {
    try {
      const response = await client.get(`/api/estimates/${est.id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${est.estimate_number || 'estimate'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('PDF downloaded', 'success');
    } catch {
      showToast('Failed to generate PDF', 'error');
    }
  };

  const handleGenerateTiers = async (est) => {
    try {
      const { data } = await estimatesApi.generateTiers(est.id);
      showToast(`Generated ${data.tiers?.length || 3} tier variants`, 'success');
      fetchEstimates();
    } catch {
      showToast('Failed to generate tiers', 'error');
    }
  };

  // Detect tier label from notes field (e.g. "[Good Tier] ...")
  const getTierLabel = (est) => {
    if (!est.notes) return null;
    const m = est.notes.match(/^\[(Good|Better|Best) Tier\]/);
    return m ? m[1] : null;
  };

  if (showBuilder) {
    return <EstimateBuilder estimate={editingEstimate} onSave={handleSaved} onCancel={() => setShowBuilder(false)} />;
  }

  // ============================================================
  // MOBILE VIEW — matches Stitch P1_screen_3.html design
  // ============================================================
  const formatValue = (v) => {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
    return `$${v.toFixed(0)}`;
  };

  const mobileStatusIcon = (status) => {
    if (status === 'accepted') return 'verified';
    if (status === 'sent' || status === 'viewed') return 'send';
    return 'description';
  };

  const mobileStatusColor = (status) => {
    if (status === 'accepted') return 'oklch(0.85 0.10 25)';
    if (status === 'sent' || status === 'viewed') return 'var(--accent-cyan)';
    return 'var(--accent-amber)';
  };

  const mobileStatusBadgeBg = (status) => {
    const c = mobileStatusColor(status);
    return `${c}1a`; // 10% opacity hex
  };

  const mobileStatusLabel = (status) => {
    if (status === 'accepted') return 'APPROVED';
    if (status === 'sent') return 'SENT';
    if (status === 'viewed') return 'VIEWED';
    if (status === 'declined') return 'DECLINED';
    if (status === 'expired') return 'EXPIRED';
    return 'DRAFT';
  };

  const mobileFilterTabs = [
    { key: '', label: 'ALL PROJECTS' },
    { key: 'draft', label: 'DRAFTS' },
    { key: 'sent', label: 'SENT' },
    { key: 'accepted', label: 'APPROVED' },
  ];

  if (isMobile) {
    return (
      <div style={{
        background: 'var(--bg-deep)',
        minHeight: '100vh',
        color: 'var(--text-primary)',
        fontFamily: 'Manrope, sans-serif',
        paddingBottom: 80,
      }}>
        <div style={{ padding: '24px 20px 0' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-cyan)',
              boxShadow: '0 0 0 0 oklch(0.78 0.12 200 / 0.7)',
              animation: 'mobileEstPulse 2s infinite',
              display: 'inline-block',
            }} />
            <span style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'oklch(0.90 0.06 200)',
            }}>Mission Control / Estimates</span>
          </div>
          <style>{`
            @keyframes mobileEstPulse {
              0% { transform: scale(0.95); box-shadow: 0 0 0 0 oklch(0.78 0.12 200 / 0.7); }
              70% { transform: scale(1); box-shadow: 0 0 0 10px oklch(0.78 0.12 200 / 0); }
              100% { transform: scale(0.95); box-shadow: 0 0 0 0 oklch(0.78 0.12 200 / 0); }
            }
          `}</style>

          {/* Heading */}
          <h2 style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 36, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: '-0.02em', margin: '0 0 20px',
          }}>Project Pipeline</h2>

          {/* Create Button */}
          <button
            onClick={handleNew}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, oklch(0.90 0.06 200), oklch(0.78 0.12 200))',
              color: 'oklch(0.25 0.06 200)',
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: 14,
              padding: '14px 24px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 0 20px oklch(0.78 0.12 200 / 0.2)',
              marginBottom: 24,
            }}
          >
            <PlusCircleIcon style={{ width: 20, height: 20 }} />
            CREATE NEW ESTIMATE
          </button>

          {/* Stat Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {/* Draft Volume */}
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 12, padding: '20px 24px',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'var(--accent-amber)' }} />
              <p style={{
                fontFamily: '"Space Grotesk", sans-serif', fontSize: 11,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--text-secondary)', marginBottom: 6,
              }}>Draft Volume</p>
              <h3 style={{
                fontFamily: '"Space Grotesk", sans-serif', fontSize: 30,
                fontWeight: 700, color: 'var(--accent-amber)', margin: 0,
              }}>{formatValue(draftValue)}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                {draftCount} Pending Estimate{draftCount !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Sent Value */}
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 12, padding: '20px 24px',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'var(--accent-cyan)' }} />
              <p style={{
                fontFamily: '"Space Grotesk", sans-serif', fontSize: 11,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--text-secondary)', marginBottom: 6,
              }}>Sent Value</p>
              <h3 style={{
                fontFamily: '"Space Grotesk", sans-serif', fontSize: 30,
                fontWeight: 700, color: 'var(--accent-cyan)', margin: 0,
              }}>{formatValue(sentValue)}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                {sentCount} Active Proposal{sentCount !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Approved Month */}
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 12, padding: '20px 24px',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'oklch(0.85 0.10 25)' }} />
              <p style={{
                fontFamily: '"Space Grotesk", sans-serif', fontSize: 11,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--text-secondary)', marginBottom: 6,
              }}>Approved Month</p>
              <h3 style={{
                fontFamily: '"Space Grotesk", sans-serif', fontSize: 30,
                fontWeight: 700, color: 'oklch(0.85 0.10 25)', margin: 0,
              }}>{formatValue(acceptedValue)}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                {acceptedCount} Approved Estimate{acceptedCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div style={{
            display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8,
            marginBottom: 16, WebkitOverflowScrolling: 'touch',
          }}>
            {mobileFilterTabs.map(tab => {
              const isActive = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontFamily: '"Space Grotesk", sans-serif',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                    border: isActive ? '1px solid oklch(0.78 0.12 200 / 0.3)' : '1px solid transparent',
                    background: isActive ? 'oklch(0.18 0.02 260)' : 'transparent',
                    color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s',
                    fontWeight: 500,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Estimate Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading && estimates.length === 0 ? (
              <div style={{
                background: 'oklch(0.10 0.02 260)', borderRadius: 12, padding: 40,
                textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14,
              }}>Loading...</div>
            ) : estimates.length === 0 ? (
              <div style={{
                background: 'oklch(0.10 0.02 260)', borderRadius: 12, padding: 40,
                textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14,
              }}>No estimates yet — create your first one</div>
            ) : estimates.map(est => {
              const sColor = mobileStatusColor(est.status);
              return (
                <div key={est.id}
                  onClick={() => handleEdit(est)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'oklch(0.10 0.02 260)'}
                  style={{
                    background: 'oklch(0.10 0.02 260)', borderRadius: 12, padding: 20,
                    borderLeft: `2px solid ${sColor}`,
                    display: 'flex', flexDirection: 'column', gap: 12,
                    cursor: 'pointer', transition: 'background 0.2s',
                  }}>
                  {/* Top row: icon + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 6,
                      background: 'oklch(0.18 0.02 260)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <ClipboardDocumentListIcon width={20} height={20} style={{ opacity: 0.9 }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontWeight: 700, fontSize: 18, color: 'var(--text-primary)',
                        margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{est.customer_name || est.lead_name || '—'}</h4>
                      <p style={{
                        fontSize: 14, color: 'var(--text-secondary)', margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{est.customer_address || est.lead_address || ''}</p>
                    </div>
                  </div>

                  {/* Bottom row: value + status + actions */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr auto',
                    gap: 12, alignItems: 'center',
                  }}>
                    <div>
                      <p style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: 'var(--text-secondary)', margin: '0 0 2px',
                      }}>Project Value</p>
                      <p style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0,
                      }}>${Number(est.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: 4,
                        background: mobileStatusBadgeBg(est.status),
                        color: sColor,
                        fontSize: 10,
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                      }}>{mobileStatusLabel(est.status)}</span>
                      {getTierLabel(est) && (() => {
                        const tl = getTierLabel(est);
                        return (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                            background: tl === 'Best' ? 'oklch(0.35 0.12 155 / 0.4)' :
                                        tl === 'Better' ? 'oklch(0.35 0.12 250 / 0.4)' :
                                        'oklch(0.35 0.08 260 / 0.4)',
                            color: tl === 'Best' ? 'oklch(0.80 0.15 155)' :
                                   tl === 'Better' ? 'oklch(0.80 0.15 250)' :
                                   'oklch(0.70 0.05 260)',
                          }}>
                            {tl}
                          </span>
                        );
                      })()}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {est.status === 'draft' ? (
                          <>
                            <PencilSquareIcon
                              onClick={() => handleEdit(est)}
                              style={{ width: 18, height: 18, color: 'var(--text-secondary)', cursor: 'pointer' }}
                              title="Edit"
                            />
                            <DocumentArrowDownIcon
                              onClick={() => handleDownloadPdf(est)}
                              style={{ width: 18, height: 18, color: 'var(--text-secondary)', cursor: 'pointer' }}
                              title="Download PDF"
                            />
                            <TrashIcon
                              onClick={() => handleDelete(est)}
                              style={{ width: 18, height: 18, color: 'var(--text-secondary)', cursor: 'pointer' }}
                              title="Delete"
                            />
                          </>
                        ) : est.status === 'sent' || est.status === 'viewed' ? (
                          <>
                            <EyeIcon
                              onClick={() => handleEdit(est)}
                              style={{ width: 18, height: 18, color: 'var(--text-secondary)', cursor: 'pointer' }}
                              title="View"
                            />
                            <DocumentArrowDownIcon
                              onClick={() => handleDownloadPdf(est)}
                              style={{ width: 18, height: 18, color: 'var(--text-secondary)', cursor: 'pointer' }}
                              title="Download PDF"
                            />
                            <EnvelopeIcon
                              onClick={() => handleSend(est)}
                              style={{ width: 18, height: 18, color: 'var(--text-secondary)', cursor: 'pointer' }}
                              title="Resend"
                            />
                          </>
                        ) : (
                          <>
                            <DocumentArrowDownIcon
                              onClick={() => handleDownloadPdf(est)}
                              style={{ width: 18, height: 18, color: 'var(--text-secondary)', cursor: 'pointer' }}
                              title="Download PDF"
                            />
                            <DocumentDuplicateIcon
                              onClick={() => handleDuplicate(est)}
                              style={{ width: 18, height: 18, color: 'var(--text-secondary)', cursor: 'pointer' }}
                              title="Duplicate"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Automated Field Intelligence Promo */}
          <div style={{
            marginTop: 40,
            background: 'var(--bg-surface)',
            borderRadius: 16,
            padding: 32,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <ShieldCheckIcon width={32} height={32} style={{ opacity: 0.9 }} />
              <h3 style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: 24, fontWeight: 700, color: 'var(--text-primary)',
                margin: 0,
              }}>Automated Field Intelligence</h3>
            </div>
            <p style={{
              color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6,
              margin: '0 0 20px',
            }}>
              Upload site photos or aerial measurements to generate instant tactical estimates using our ROOF-X AI core. Accuracy rated at 98.4%.
            </p>
            <button
              onClick={() => showToast('Open a lead from Pipeline → use Roof Measurement tool to generate measurements, then create an estimate from there.', 'info')}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-cyan)'; e.currentTarget.style.color = 'oklch(0.25 0.06 200)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-cyan)'; }}
              style={{
                width: '100%',
                padding: '16px 24px',
                borderRadius: 12,
                border: '2px solid var(--accent-cyan)',
                background: 'transparent',
                color: 'var(--accent-cyan)',
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
              LAUNCH MEASUREMENT TOOL
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)' }}>
      {/* KPIs */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { Icon: CloudIcon, value: total, label: 'Total Estimates', color: '330' },
          { Icon: ClockIcon, value: sentCount, label: 'Awaiting Response', color: '250' },
          { Icon: CheckCircleIcon, value: acceptedCount, label: 'Accepted', color: '155' },
          { Icon: BanknotesIcon, value: `$${(acceptedValue / 1000).toFixed(1)}K`, label: 'Revenue Accepted', color: '155' },
        ].map(s => (
          <div key={s.label} className="stat-card glass" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <s.Icon width={28} height={28} />
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + New */}
      <div className="glass" style={{
        borderRadius: '20px / 18px', padding: 'var(--space-lg) var(--space-xl)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-lg)',
        overflow: 'visible', position: 'relative', zIndex: 20,
      }}>
        <CustomSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          placeholder="All Statuses"
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'sent', label: 'Sent' },
            { value: 'viewed', label: 'Viewed' },
            { value: 'accepted', label: 'Accepted' },
            { value: 'declined', label: 'Declined' },
          ]}
          style={{ minWidth: 160 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{total} estimate{total !== 1 ? 's' : ''}</span>
        {/* Compare Tiers button — shows when there are tier estimates */}
        {estimates.filter(e => getTierLabel(e)).length >= 2 && (
          <button
            className="quick-action-btn"
            onClick={() => setShowCompare(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, height: 36, padding: '0 16px' }}
          >
            <Squares2X2Icon width={14} height={14} />
            Compare Tiers
          </button>
        )}
        <button className="auth-btn" onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IconPlusCircle style={{ width: 14, height: 14 }} /> New Estimate</button>
      </div>

      {/* Table */}
      <div className="glass" style={{ borderRadius: '20px / 18px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="lead-table">
            <thead>
              <tr>
                <th>Estimate #</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
                <th>Created</th>
                <th>Valid Until</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && estimates.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : estimates.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>
                  No estimates yet — create your first one
                </td></tr>
              ) : estimates.map(est => (
                <tr key={est.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{est.estimate_number}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{est.customer_name || est.lead_name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{est.customer_address || est.lead_address || ''}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                        background: `color-mix(in oklch, ${statusColors[est.status]} 15%, transparent)`,
                        color: statusColors[est.status], textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>{est.status}</span>
                      {getTierLabel(est) && (() => {
                        const tl = getTierLabel(est);
                        return (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                            background: tl === 'Best' ? 'oklch(0.35 0.12 155 / 0.4)' :
                                        tl === 'Better' ? 'oklch(0.35 0.12 250 / 0.4)' :
                                        'oklch(0.35 0.08 260 / 0.4)',
                            color: tl === 'Best' ? 'oklch(0.80 0.15 155)' :
                                   tl === 'Better' ? 'oklch(0.80 0.15 250)' :
                                   'oklch(0.70 0.05 260)',
                          }}>
                            {tl}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(est.total)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(est.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {est.valid_until ? new Date(est.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--space-xs)', justifyContent: 'center' }}>
                      <button className="quick-action-btn" onClick={() => handleEdit(est)} style={{ padding: '8px 14px', fontSize: 11 }}>
                        Edit
                      </button>
                      <button className="quick-action-btn" onClick={() => handleDelete(est)} style={{ padding: '8px 14px', fontSize: 11, color: 'var(--accent-red)' }}>
                        Delete
                      </button>
                      <button className="quick-action-btn" onClick={() => handleDuplicate(est)} style={{ padding: '8px 14px', fontSize: 11 }}>
                        Copy
                      </button>
                      {!getTierLabel(est) && (
                        <button className="quick-action-btn" onClick={(e) => { e.stopPropagation(); handleGenerateTiers(est); }} style={{ padding: '8px 14px', fontSize: 11 }}>
                          Tiers
                        </button>
                      )}
                      {est.status === 'accepted' && (
                        <button className="quick-action-btn" onClick={() => { window.location.href = `/contracts?fromEstimate=${est.id}`; }} style={{ padding: '8px 14px', fontSize: 11, color: 'var(--accent-blue)' }}>
                          Contract
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tier Comparison Modal */}
      {showCompare && (() => {
        // Group tier estimates by lead
        const tierEstimates = estimates.filter(e => getTierLabel(e));
        // Group by lead_id — if no lead_id, group by customer name
        const groups = {};
        tierEstimates.forEach(est => {
          const key = est.lead_id || est.customer_name || 'ungrouped';
          if (!groups[key]) groups[key] = [];
          groups[key].push(est);
        });
        // Use the largest group or first group with 2+ estimates
        const tierGroup = Object.values(groups).find(g => g.length >= 2)
          || Object.values(groups)[0]
          || tierEstimates;

        // Sort: Good, Better, Best
        const tierOrder = { Good: 0, Better: 1, Best: 2 };
        const sorted = [...tierGroup].sort((a, b) =>
          (tierOrder[getTierLabel(a)] ?? 9) - (tierOrder[getTierLabel(b)] ?? 9)
        );

        // Collect all line items across tiers for comparison
        const allItemDescriptions = new Set();
        sorted.forEach(est => {
          const items = Array.isArray(est.line_items) ? est.line_items : [];
          items.forEach(item => {
            if (item.description || item.name) allItemDescriptions.add(item.description || item.name);
          });
        });

        const tierColors = {
          Good: { bg: 'oklch(0.35 0.08 260 / 0.4)', color: 'oklch(0.70 0.05 260)', border: 'oklch(0.45 0.05 260 / 0.3)' },
          Better: { bg: 'oklch(0.35 0.12 250 / 0.4)', color: 'oklch(0.80 0.15 250)', border: 'oklch(0.55 0.15 250 / 0.3)' },
          Best: { bg: 'oklch(0.35 0.12 155 / 0.4)', color: 'oklch(0.80 0.15 155)', border: 'oklch(0.55 0.15 155 / 0.3)' },
        };

        return (
          <div className="modal-backdrop" onClick={() => setShowCompare(false)} style={{
            position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div className="glass no-scrollbar" onClick={e => e.stopPropagation()} style={{
              width: '95%', maxWidth: 900, maxHeight: '90vh', overflow: 'auto',
              borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)',
              boxShadow: '0 24px 80px oklch(0 0 0 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Compare Estimates</h2>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    {sorted[0]?.customer_name || sorted[0]?.lead_name || 'Side-by-side tier comparison'}
                  </p>
                </div>
                <button onClick={() => setShowCompare(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <IconX style={{ width: 20, height: 20 }} />
                </button>
              </div>

              {/* Tier Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sorted.length}, 1fr)`, gap: 16, marginBottom: 24 }}>
                {sorted.map(est => {
                  const tier = getTierLabel(est) || 'Standard';
                  const tc = tierColors[tier] || tierColors.Good;
                  const items = Array.isArray(est.line_items) ? est.line_items : [];
                  return (
                    <div key={est.id} style={{
                      padding: 20, borderRadius: 16,
                      background: tc.bg, border: `1px solid ${tc.border}`,
                      textAlign: 'center',
                    }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.08em', color: tc.color, marginBottom: 8,
                      }}>
                        {tier} Tier
                      </div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {formatCurrency(est.total)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {items.length} line item{items.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 8, padding: '3px 10px', borderRadius: 999, display: 'inline-block', background: `color-mix(in oklch, ${tc.color} 15%, transparent)`, color: tc.color, fontWeight: 600 }}>
                        {est.status}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Line Item Comparison Table */}
              {allItemDescriptions.size > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid oklch(1 0 0 / 0.06)' }}>
                          Line Item
                        </th>
                        {sorted.map(est => {
                          const tier = getTierLabel(est) || 'Standard';
                          const tc = tierColors[tier] || tierColors.Good;
                          return (
                            <th key={est.id} style={{
                              textAlign: 'right', padding: '10px 12px', color: tc.color,
                              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                              borderBottom: '1px solid oklch(1 0 0 / 0.06)',
                            }}>
                              {tier}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {[...allItemDescriptions].map(desc => (
                        <tr key={desc}>
                          <td style={{ padding: '8px 12px', color: 'var(--text-primary)', borderBottom: '1px solid oklch(1 0 0 / 0.04)' }}>
                            {desc}
                          </td>
                          {sorted.map(est => {
                            const items = Array.isArray(est.line_items) ? est.line_items : [];
                            const match = items.find(i => (i.description || i.name) === desc);
                            const lineTotal = match ? (Number(match.quantity) || 1) * (Number(match.unit_price) || 0) : 0;
                            return (
                              <td key={est.id} style={{
                                textAlign: 'right', padding: '8px 12px',
                                borderBottom: '1px solid oklch(1 0 0 / 0.04)',
                                color: match ? 'var(--text-primary)' : 'oklch(0.35 0 0)',
                                fontWeight: match ? 600 : 400,
                              }}>
                                {match ? formatCurrency(lineTotal) : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr>
                        <td style={{ padding: '12px 12px', fontWeight: 700, color: 'var(--text-primary)', borderTop: '2px solid oklch(1 0 0 / 0.1)' }}>
                          Total
                        </td>
                        {sorted.map(est => {
                          const tier = getTierLabel(est) || 'Standard';
                          const tc = tierColors[tier] || tierColors.Good;
                          return (
                            <td key={est.id} style={{
                              textAlign: 'right', padding: '12px 12px',
                              fontWeight: 800, fontSize: 15, color: tc.color,
                              borderTop: '2px solid oklch(1 0 0 / 0.1)',
                            }}>
                              {formatCurrency(est.total)}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20 }}>
                {sorted.map(est => {
                  const tier = getTierLabel(est) || 'Standard';
                  const tc = tierColors[tier] || tierColors.Good;
                  return (
                    <button key={est.id} onClick={() => { setShowCompare(false); handleEdit(est); }}
                      style={{
                        padding: '8px 16px', borderRadius: 10,
                        border: `1px solid ${tc.border}`, background: tc.bg,
                        color: tc.color, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      Edit {tier}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================
// ESTIMATE BUILDER — Full JobNimbus-style builder
// ============================================================

const DEFAULT_SECTIONS = [
  { id: 'title', name: 'Title', enabled: true, order: 0 },
  { id: 'introduction', name: 'Introduction', enabled: true, order: 1 },
  { id: 'scope', name: 'Scope of Work', enabled: true, order: 2 },
  { id: 'line_items', name: 'Roof Components', enabled: true, order: 3 },
  { id: 'inspection', name: 'Inspection Notes', enabled: true, order: 4 },
  { id: 'quote_details', name: 'Quote Details', enabled: true, order: 5 },
  { id: 'authorization', name: 'Authorization', enabled: true, order: 6 },
  { id: 'terms', name: 'Terms & Conditions', enabled: true, order: 7 },
  { id: 'warranty', name: 'Warranty', enabled: true, order: 8 },
  { id: 'notes', name: 'Notes', enabled: true, order: 9 },
];

const TAX_OPTIONS = [
  { value: 0, label: 'No Tax' },
  { value: 0.0625, label: '6.25%' },
  { value: 0.07, label: '7.0%' },
  { value: 0.075, label: '7.5%' },
  { value: 0.08, label: '8.0%' },
  { value: 0.0825, label: '8.25%' },
  { value: 0.085, label: '8.5%' },
  { value: 0.09, label: '9.0%' },
  { value: 0.1, label: '10.0%' },
];

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 34,
        height: 18,
        borderRadius: 9,
        border: 'none',
        padding: 2,
        cursor: 'pointer',
        background: checked ? 'var(--accent-blue)' : 'oklch(0.30 0.02 260)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        transition: 'background 0.2s, justify-content 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: checked ? 'oklch(1 0 0)' : 'oklch(0.55 0.02 260)',
        transition: 'background 0.2s',
      }} />
    </button>
  );
}

// ============================================================
// RICH TEXT EDITOR — contentEditable WYSIWYG
// ============================================================

const ESTIMATE_TOKENS = [
  { label: 'Customer Name', token: '{{customer_name}}' },
  { label: 'Customer Phone', token: '{{customer_phone}}' },
  { label: 'Customer Email', token: '{{customer_email}}' },
  { label: 'Customer Address', token: '{{customer_address}}' },
  { label: 'Estimate #', token: '{{estimate_number}}' },
  { label: 'Estimate Date', token: '{{estimate_date}}' },
  { label: 'Valid Until', token: '{{valid_until}}' },
  { label: 'Company Name', token: '{{company_name}}' },
  { label: 'Total', token: '{{total}}' },
  { label: 'Subtotal', token: '{{subtotal}}' },
];

function RichTextEditor({ value, onChange, placeholder, minHeight = 80, tokens }) {
  const editorDiv = useRef(null);
  const isInternalChange = useRef(false);
  const [showTokenMenu, setShowTokenMenu] = useState(false);
  const tokenBtnRef = useRef(null);

  useEffect(() => {
    if (editorDiv.current && !isInternalChange.current) {
      if (editorDiv.current.innerHTML !== (value || '')) {
        editorDiv.current.innerHTML = value || '';
      }
    }
    isInternalChange.current = false;
  }, [value]);

  const exec = (cmd, val = null) => {
    editorDiv.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const handleInput = () => {
    isInternalChange.current = true;
    onChange(editorDiv.current?.innerHTML || '');
  };

  const handleLink = () => {
    const url = prompt('Enter URL:');
    if (url) exec('createLink', url);
  };

  const btnStyle = (active) => ({
    background: active ? 'oklch(0.30 0.04 250 / 0.4)' : 'transparent',
    border: 'none', cursor: 'pointer', borderRadius: 4,
    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700,
  });

  return (
    <div style={{ border: '1px solid var(--glass-border)', borderRadius: '14px / 12px', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 2, padding: '4px 8px',
        borderBottom: '1px solid var(--glass-border)',
        background: 'oklch(0.16 0.02 260 / 0.5)',
      }}>
        <button type="button" style={btnStyle()} onMouseDown={e => { e.preventDefault(); exec('bold'); }} title="Bold"><b>B</b></button>
        <button type="button" style={btnStyle()} onMouseDown={e => { e.preventDefault(); exec('italic'); }} title="Italic"><i>I</i></button>
        <button type="button" style={btnStyle()} onMouseDown={e => { e.preventDefault(); exec('underline'); }} title="Underline"><u>U</u></button>
        <div style={{ width: 1, margin: '4px 4px', background: 'var(--glass-border)' }} />
        <button type="button" style={btnStyle()} onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }} title="Bullet List">
          <ListBulletIcon width={14} height={14} />
        </button>
        <button type="button" style={btnStyle()} onMouseDown={e => { e.preventDefault(); exec('insertOrderedList'); }} title="Numbered List">
          <NumberedListIcon width={14} height={14} />
        </button>
        <button type="button" style={btnStyle()} onMouseDown={e => { e.preventDefault(); handleLink(); }} title="Insert Link">
          <LinkIcon width={14} height={14} />
        </button>
        {tokens && tokens.length > 0 && (
          <>
            <div style={{ width: 1, margin: '4px 4px', background: 'var(--glass-border)' }} />
            <div style={{ position: 'relative' }}>
              <button
                ref={tokenBtnRef}
                type="button"
                style={{ ...btnStyle(showTokenMenu), fontSize: 10, fontWeight: 700, width: 'auto', padding: '0 8px', gap: 3, letterSpacing: '0.02em' }}
                onMouseDown={e => { e.preventDefault(); setShowTokenMenu(v => !v); }}
                title="Insert merge field"
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>{'{ }'}</span>
                <span>Token</span>
              </button>
              {showTokenMenu && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
                  background: 'oklch(0.18 0.02 260)', border: '1px solid var(--glass-border)',
                  borderRadius: 10, padding: 4, minWidth: 180,
                  boxShadow: '0 8px 24px oklch(0 0 0 / 0.5)',
                }}>
                  {tokens.map(t => (
                    <button
                      key={t.token}
                      type="button"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', padding: '6px 10px', border: 'none', borderRadius: 6,
                        background: 'transparent', color: 'var(--text-secondary)',
                        fontSize: 12, cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'oklch(0.25 0.03 250 / 0.4)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      onMouseDown={e => {
                        e.preventDefault();
                        editorDiv.current?.focus();
                        document.execCommand('insertText', false, t.token);
                        setShowTokenMenu(false);
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'oklch(0.72 0.19 250)', flexShrink: 0 }}>{t.token}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {/* Editable area */}
      <div
        ref={editorDiv}
        contentEditable
        onInput={handleInput}
        data-placeholder={placeholder}
        style={{
          minHeight, padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
          color: 'var(--text-primary)', outline: 'none',
          background: 'oklch(0.22 0.02 260 / 0.45)',
          overflowY: 'auto', maxHeight: 300,
        }}
        suppressContentEditableWarning
      />
      <style>{`
        [data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: var(--text-muted);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

function SectionHeader({ title, sectionId, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{title}</div>
      {sectionId && onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(sectionId); }} title="Remove section" style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          padding: 2, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10,
        }}>
          <IconEyeOff style={{ width: 12, height: 12 }} />
        </button>
      )}
    </div>
  );
}

function SectionImageBar({ sectionId, images, onAdd, onRemove }) {
  const inputRef = useRef(null);
  return (
    <div style={{ marginTop: 'var(--space-sm)' }}>
      {images && images.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: 'relative', borderRadius: '10px / 8px', overflow: 'hidden', width: 120, height: 80 }}>
              <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => onRemove(sectionId, i)} aria-label="Remove" style={{
                position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%',
                background: 'oklch(0 0 0 / 0.6)', border: 'none', color: 'oklch(1 0 0)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><IconX width={11} height={11} /></button>
            </div>
          ))}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
        const f = e.target.files?.[0];
        if (f) onAdd(sectionId, f);
        e.target.value = '';
      }} />
      <button onClick={() => inputRef.current?.click()} className="quick-action-btn" style={{ padding: '4px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
        <IconPlusCircle style={{ width: 12, height: 12 }} /> Add Image
      </button>
    </div>
  );
}

// ============================================================
// SEND FOR SIGNING MODAL
// ============================================================

function SendForSigningModal({ signers, customerEmail, onSend, onClose, sending }) {
  const [emailBody, setEmailBody] = useState(
    'Hi {{CUSTOMER_FIRST_NAME}},<br><br>Thanks for taking a few minutes to meet with me at your property. I\'ve prepared an estimate for the work we discussed. All details are included in the attached quote.<br><br>Please review and sign at your convenience.'
  );
  const [savedTemplates, setSavedTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('email_templates') || '[]'); } catch { return []; }
  });

  const insertToken = (token) => {
    setEmailBody(prev => prev + token);
  };

  const saveTemplate = () => {
    const name = prompt('Template name:');
    if (!name?.trim()) return;
    const updated = [...savedTemplates, { name: name.trim(), body: emailBody }];
    setSavedTemplates(updated);
    localStorage.setItem('email_templates', JSON.stringify(updated));
    showToast('Template saved', 'success');
  };

  const loadTemplate = (tmpl) => {
    setEmailBody(tmpl.body);
  };

  const recipients = signers.filter(s => s.email).map(s => `${s.first_name} ${s.last_name} <${s.email}>`);
  if (recipients.length === 0 && customerEmail) recipients.push(customerEmail);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400, background: 'oklch(0 0 0 / 0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="glass" onClick={e => e.stopPropagation()} style={{
        width: 520, maxHeight: '85vh', overflow: 'visible',
        borderRadius: '20px / 18px',
        padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Send for Signing</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX width={18} height={18} /></button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          This estimate will be sent to the following {recipients.length === 1 ? 'person' : 'people'} and a signature will be requested.
        </div>

        {/* Recipients */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'oklch(0.55 0.02 260)', marginBottom: 4 }}>Recipients</div>
          {recipients.length > 0 ? recipients.map((r, i) => (
            <div key={i} style={{ fontSize: 13, padding: '4px 0', color: 'var(--text-primary)' }}>{i + 1}. {r}</div>
          )) : (
            <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>No recipients — add signers in the Authorization section or enter a customer email.</div>
          )}
        </div>

        {/* Templates */}
        {savedTemplates.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--accent-blue)' }}>
            <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>Templates:</span>
            {savedTemplates.map((t, i) => (
              <button key={i} onClick={() => loadTemplate(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-blue)', fontSize: 11, textDecoration: 'underline', marginRight: 8 }}>
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Token insertion */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'oklch(0.55 0.02 260)' }}>Insert Token:</span>
          {['{{CUSTOMER_FIRST_NAME}}', '{{CUSTOMER_LAST_NAME}}', '{{ESTIMATE_TOTAL}}', '{{COMPANY_NAME}}', '{{ESTIMATE_NUMBER}}'].map(token => (
            <button key={token} onClick={() => insertToken(token)} style={{
              padding: '2px 8px', fontSize: 10, borderRadius: 4,
              background: 'oklch(0.25 0.03 250 / 0.5)', color: 'var(--accent-blue)',
              border: '1px solid oklch(0.40 0.05 250 / 0.3)', cursor: 'pointer',
            }}>
              {token.replace(/\{\{|\}\}/g, '')}
            </button>
          ))}
        </div>

        {/* Email body */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'oklch(0.55 0.02 260)', marginBottom: 4 }}>Note to Customer</div>
          <RichTextEditor value={emailBody} onChange={setEmailBody} placeholder="Write your message..." minHeight={120} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={saveTemplate} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-blue)', fontSize: 11, textDecoration: 'underline' }}>
            Save As Template
          </button>
          <button onClick={() => onSend(emailBody)} disabled={sending || recipients.length === 0} style={{
            padding: '10px 24px', fontSize: 13, fontWeight: 700,
            borderRadius: '14px / 12px', border: 'none', cursor: 'pointer',
            background: 'oklch(0.75 0.18 155)', color: 'oklch(0.15 0.02 155)',
            opacity: (sending || recipients.length === 0) ? 0.5 : 1,
          }}>
            {sending ? 'Sending...' : 'Send for Signing'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EstimateBuilder({ estimate, onSave, onCancel }) {
  const [form, setForm] = useState({
    customer_name: '',
    customer_address: '',
    customer_phone: '',
    customer_email: '',
    estimate_name: '',
    estimate_date: new Date().toISOString().split('T')[0],
    introduction: 'Thank you for choosing us for your roofing needs. We have conducted a thorough inspection of your property and prepared the following estimate for the recommended repairs.',
    line_items: [],
    tax_rate: 0,
    scope_of_work: '',
    terms: 'Payment due upon completion. All work guaranteed per manufacturer warranty specifications.',
    warranty_info: '',
    notes: '',
    valid_until: '',
    inspection_notes: '',
  });
  const [primaryImage, setPrimaryImage] = useState(null); // { file, preview }
  const imageInputRef = useRef(null);
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [sections, setSections] = useState(DEFAULT_SECTIONS.map(s => ({ ...s })));
  const [activeSection, setActiveSection] = useState('title');
  const [discounts, setDiscounts] = useState([]);
  const [signers, setSigners] = useState([{ first_name: '', last_name: '', email: '', isPrimary: true }]);
  const [profitMargin, setProfitMargin] = useState(30);
  const [dragIdx, setDragIdx] = useState(null);
  const [showSRSCatalog, setShowSRSCatalog] = useState(false);
  const [sectionImages, setSectionImages] = useState({}); // { sectionId: [{ file, preview }] }
  const [footerNotes, setFooterNotes] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState(''); // '', 'saving', 'saved'
  const [showSendModal, setShowSendModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [financingEnabled, setFinancingEnabled] = useState(estimate?.financing_enabled || false);
  const [selectedPlanIds, setSelectedPlanIds] = useState(estimate?.financing_plan_ids || []);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [hasLender, setHasLender] = useState(false);
  const [insuranceDetails, setInsuranceDetails] = useState({
    insurance_company: '', claim_number: '', date_of_loss: '',
    acv: '', rcv: '', depreciation: '', deductible: '', overhead_profit: '', proceeds_received: '',
  });
  const [insuranceEnabled, setInsuranceEnabled] = useState(false);
  const [upgrades, setUpgrades] = useState([]);
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [deposit, setDeposit] = useState({ amount: '', description: 'Due upon signing', type: 'flat' });
  const sectionImageInputRef = useRef(null);
  const [imageUploadTarget, setImageUploadTarget] = useState(null); // section id
  const editorRef = useRef(null);
  const sectionRefs = useRef({});

  useEffect(() => {
    estimatesApi.getTemplates()
      .then(res => setTemplates(res.data.templates || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (estimate) {
      setForm({
        customer_name: estimate.customer_name || '',
        customer_address: estimate.customer_address || '',
        customer_phone: estimate.customer_phone || '',
        customer_email: estimate.customer_email || '',
        estimate_name: estimate.estimate_name || '',
        estimate_date: estimate.estimate_date ? estimate.estimate_date.split('T')[0] : new Date().toISOString().split('T')[0],
        introduction: estimate.introduction || 'Thank you for choosing us for your roofing needs. We have conducted a thorough inspection of your property and prepared the following estimate for the recommended repairs.',
        // `|| []` guards a missing array but NOT a null/non-object ELEMENT inside it,
        // and every consumer below does a bare property read (`item.srs_product_id` at
        // :1491 runs in the render body, so a null element unmounts the whole SPA).
        // Sanitize once here at the state boundary — same fix shape as the invoice
        // line_items guard, and the same Array.isArray convention used at :1326/:1329.
        line_items: Array.isArray(estimate.line_items)
          ? estimate.line_items.filter(i => i && typeof i === 'object')
          : [],
        tax_rate: Number(estimate.tax_rate) || 0,
        scope_of_work: estimate.scope_of_work || '',
        terms: estimate.terms || '',
        warranty_info: estimate.warranty_info || '',
        notes: estimate.notes || '',
        valid_until: estimate.valid_until ? estimate.valid_until.split('T')[0] : '',
        inspection_notes: estimate.inspection_notes || '',
      });
      if (estimate.discounts && Array.isArray(estimate.discounts)) {
        setDiscounts(estimate.discounts);
      }
      if (estimate.signers && Array.isArray(estimate.signers)) {
        setSigners(estimate.signers.length > 0 ? estimate.signers : [{ first_name: '', last_name: '', email: '', isPrimary: true }]);
      }
      if (estimate.profit_margin != null) {
        setProfitMargin(Number(estimate.profit_margin));
      }
      if (estimate.insurance_details && Object.keys(estimate.insurance_details).length > 0) {
        setInsuranceDetails(prev => ({ ...prev, ...estimate.insurance_details }));
        setInsuranceEnabled(true);
      }
      if (estimate.upgrades && Array.isArray(estimate.upgrades) && estimate.upgrades.length > 0) {
        setUpgrades(estimate.upgrades);
      }
      if (estimate.deposit && estimate.deposit.amount) {
        setDeposit(prev => ({ ...prev, ...estimate.deposit }));
        setDepositEnabled(true);
      }
    }
  }, [estimate]);

  // Auto-save (debounced, only for existing estimates)
  useEffect(() => {
    if (!estimate?.id) return;
    setAutoSaveStatus('');
    const timer = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        await estimatesApi.updateEstimate(estimate.id, { ...form, financing_enabled: financingEnabled, financing_plan_ids: selectedPlanIds });
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus(''), 2000);
      } catch {
        setAutoSaveStatus('');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [form, estimate?.id]);

  // Fetch financing plans if tenant has a lender
  useEffect(() => {
    (async () => {
      try {
        const { data: lenders } = await client.get('/crm/financing/lenders');
        const active = lenders.find(l => l.is_active);
        if (active) {
          setHasLender(true);
          const { data: plans } = await client.get('/crm/financing/plans', { params: { lenderId: active.id } });
          setAvailablePlans(plans.filter(p => p.is_active));
          // Pre-select defaults if new estimate
          if (!estimate?.id) {
            setSelectedPlanIds(plans.filter(p => p.is_default).map(p => p.id));
          }
        }
      } catch (err) {
        console.error('Failed to load financing plans:', err);
      }
    })();
  }, []);

  // Section image handling
  const addSectionImage = (sectionId, file) => {
    const preview = URL.createObjectURL(file);
    setSectionImages(prev => ({
      ...prev,
      [sectionId]: [...(prev[sectionId] || []), { file, preview }],
    }));
  };
  const removeSectionImage = (sectionId, imgIdx) => {
    setSectionImages(prev => ({
      ...prev,
      [sectionId]: (prev[sectionId] || []).filter((_, i) => i !== imgIdx),
    }));
  };

  // Remove (hide) section
  const hideSection = (sectionId) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, enabled: false } : s));
  };

  // Add custom section
  const addCustomSection = () => {
    const name = prompt('Section name:');
    if (!name?.trim()) return;
    const id = 'custom_' + Date.now();
    setSections(prev => [...prev, { id, name: name.trim(), enabled: true, order: prev.length }]);
  };

  const updateField = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const addLineItem = (template) => {
    const item = template
      ? { description: template.name, details: '', quantity: 1, unit: template.unit, unit_price: Number(template.default_unit_price) || 0, section: template.section }
      : { description: '', details: '', quantity: 1, unit: 'each', unit_price: 0, section: 'Roof' };
    setForm(f => ({ ...f, line_items: [...f.line_items, item] }));
  };

  const addAllPresets = () => {
    const items = templates.map(t => ({
      description: t.name, quantity: 1, unit: t.unit,
      unit_price: Number(t.default_unit_price) || 0, section: t.section,
    }));
    setForm(f => ({ ...f, line_items: [...f.line_items, ...items] }));
  };

  const updateLineItem = (idx, field, value) => {
    setForm(f => ({
      ...f,
      line_items: f.line_items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const removeLineItem = (idx) => {
    setForm(f => ({ ...f, line_items: f.line_items.filter((_, i) => i !== idx) }));
  };

  // Line item drag reorder
  const [dragLineIdx, setDragLineIdx] = useState(null);
  const handleLineDragStart = (e, idx) => { setDragLineIdx(idx); e.dataTransfer.effectAllowed = 'move'; };
  const handleLineDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleLineDrop = (e, toIdx) => {
    e.preventDefault();
    if (dragLineIdx === null || dragLineIdx === toIdx) return;
    setForm(f => {
      const items = [...f.line_items];
      const [moved] = items.splice(dragLineIdx, 1);
      items.splice(toIdx, 0, moved);
      return { ...f, line_items: items };
    });
    setDragLineIdx(null);
  };

  const syncMaterialPrices = async () => {
    const linkedItems = form.line_items.filter(item => item.srs_product_id);
    if (linkedItems.length === 0) {
      showToast('No linked materials to sync', 'warning');
      return;
    }
    try {
      const res = await materialsApi.searchProducts({});
      const catalog = res.data?.products || [];
      const priceMap = {};
      catalog.forEach(p => { priceMap[p.id] = p.price; });

      let updated = 0;
      setForm(f => ({
        ...f,
        line_items: f.line_items.map(item => {
          if (item.srs_product_id && priceMap[item.srs_product_id] !== undefined) {
            const newPrice = priceMap[item.srs_product_id];
            if (Number(item.unit_price) !== newPrice) {
              updated++;
              return { ...item, unit_price: newPrice };
            }
          }
          return item;
        }),
      }));
      showToast(updated > 0 ? `${updated} price${updated > 1 ? 's' : ''} updated from catalog` : 'All prices are current', 'success');
    } catch {
      showToast('Failed to sync prices', 'error');
    }
  };

  const linkedCount = form.line_items.filter(item => item.srs_product_id).length;

  // Calculate totals
  const subtotal = form.line_items.reduce((s, item) => s + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0);
  const totalDiscountAmount = discounts.reduce((sum, d) => {
    if (d.type === 'percent') return sum + subtotal * (Number(d.value) || 0) / 100;
    return sum + (Number(d.value) || 0);
  }, 0);
  const taxable = Math.max(0, subtotal - totalDiscountAmount);
  const taxAmount = taxable * (Number(form.tax_rate) || 0);
  const total = taxable + taxAmount;

  // Profit margin calculation
  const estimatedCost = total > 0 ? total * (1 - (profitMargin / 100)) : 0;

  // Discount helpers
  const addDiscount = () => setDiscounts(d => [...d, { name: '', type: 'flat', value: 0 }]);
  const updateDiscount = (idx, field, value) => setDiscounts(d => d.map((disc, i) => i === idx ? { ...disc, [field]: value } : disc));
  const removeDiscount = (idx) => setDiscounts(d => d.filter((_, i) => i !== idx));

  // Signer helpers
  const addSigner = () => setSigners(s => [...s, { first_name: '', last_name: '', email: '', isPrimary: false }]);
  const updateSigner = (idx, field, value) => setSigners(s => s.map((sig, i) => i === idx ? { ...sig, [field]: value } : sig));
  const removeSigner = (idx) => setSigners(s => s.filter((_, i) => i !== idx));

  // Section reorder via drag
  const handleSectionDragStart = (idx) => setDragIdx(idx);
  const handleSectionDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setSections(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next.map((s, i) => ({ ...s, order: i }));
    });
    setDragIdx(idx);
  };
  const handleSectionDragEnd = () => setDragIdx(null);

  const toggleSection = (id) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const scrollToSection = (id) => {
    setActiveSection(id);
    const el = sectionRefs.current[id];
    if (el && editorRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, discounts, signers, profit_margin: profitMargin, financing_enabled: financingEnabled, financing_plan_ids: selectedPlanIds, insurance_details: insuranceEnabled ? insuranceDetails : {}, upgrades, deposit: depositEnabled ? deposit : null };
      if (estimate) {
        await estimatesApi.updateEstimate(estimate.id, payload);
      } else {
        await estimatesApi.createEstimate(payload);
      }
      showToast('Estimate saved', 'success');
      onSave();
    } catch {
      showToast('Failed to save estimate', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSend = async () => {
    setSending(true);
    try {
      const payload = { ...form, discounts, signers, profit_margin: profitMargin, financing_enabled: financingEnabled, financing_plan_ids: selectedPlanIds, insurance_details: insuranceEnabled ? insuranceDetails : {}, upgrades, deposit: depositEnabled ? deposit : null };
      let est;
      if (estimate) {
        await estimatesApi.updateEstimate(estimate.id, payload);
        est = estimate;
      } else {
        const res = await estimatesApi.createEstimate(payload);
        est = res.data;
      }
      await estimatesApi.sendEstimate(est.id);
      showToast('Estimate sent', 'success');
      onSave();
    } catch {
      showToast('Failed to send estimate', 'error');
    } finally {
      setSending(false);
    }
  };

  // ====================== REVIEW & SHARE MODE ======================
  if (reviewMode) {
    const companyName = estimate?.company_name || JSON.parse(localStorage.getItem('tenant') || '{}').tenantName || 'Your Company';
    const enabledSections = sections.filter(s => s.enabled);
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'oklch(0.10 0.02 260)', display: 'flex', flexDirection: 'column' }}>
        {/* Review top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-md) var(--space-xl)',
          borderBottom: '1px solid var(--glass-border)',
          background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <button className="quick-action-btn" onClick={() => setReviewMode(false)} style={{ padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconArrowLeft style={{ width: 14, height: 14 }} /> Back to Editor
            </button>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Review & Share</span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
            <button className="quick-action-btn" onClick={() => window.print()} style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }} title="Print">
              <PrinterIcon width={14} height={14} />
            </button>
            <button className="quick-action-btn" onClick={() => editingEstimate?.id && handleDownloadPdf(editingEstimate)} style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }} title="Download PDF">
              <DocumentArrowDownIcon width={14} height={14} />
              PDF
            </button>
            <button className="quick-action-btn" onClick={async () => {
              if (!estimate) {
                // Save first, then open signing
                setSaving(true);
                try {
                  const payload = { ...form, discounts, signers, profit_margin: profitMargin, financing_enabled: financingEnabled, financing_plan_ids: selectedPlanIds, insurance_details: insuranceEnabled ? insuranceDetails : {}, upgrades, deposit: depositEnabled ? deposit : null };
                  await estimatesApi.createEstimate(payload);
                  showToast('Estimate saved', 'success');
                } catch { showToast('Failed to save estimate', 'error'); setSaving(false); return; }
                setSaving(false);
              }
              setShowSignModal(true);
            }} disabled={saving} style={{ padding: '6px 18px', fontSize: 12 }}>
              Sign Now
            </button>
            <button className="quick-action-btn" onClick={() => { setReviewMode(false); setShowSendModal(true); }} style={{
              padding: '6px 18px', fontSize: 12, background: 'oklch(0.75 0.18 155)', color: 'oklch(0.15 0.02 155)', border: 'none', borderRadius: '14px / 12px',
            }}>
              <IconSend style={{ width: 12, height: 12 }} /> Send for Signing
            </button>
          </div>
        </div>

        {/* Review body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: 'var(--space-xl)' }}>
          <div style={{
            width: '100%', maxWidth: 680,
            background: 'oklch(1 0 0)', borderRadius: 12, padding: 48, color: 'oklch(0.15 0.02 260)',
            fontSize: 14, lineHeight: 1.6, boxShadow: '0 24px 48px oklch(0 0 0 / 0.4)',
          }}>
            {/* Company header */}
            <div style={{ borderBottom: '2px solid oklch(0.55 0.18 250)', paddingBottom: 16, marginBottom: 24 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'oklch(0.55 0.18 250)' }}>{companyName}</div>
              <div style={{ fontSize: 13, color: 'oklch(0.55 0 0)' }}>Professional Roofing Services</div>
            </div>

            {/* Title section */}
            {enabledSections.some(s => s.id === 'title') && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{form.estimate_name || 'ESTIMATE'}</div>
                  <div style={{ fontSize: 13, color: 'oklch(0.55 0 0)' }}>{estimate?.estimate_number || 'Draft'}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 13, color: 'oklch(0.55 0 0)' }}>
                  <div>Date: {form.estimate_date ? new Date(form.estimate_date + 'T00:00:00').toLocaleDateString() : new Date().toLocaleDateString()}</div>
                  {form.valid_until && <div>Valid until: {new Date(form.valid_until + 'T00:00:00').toLocaleDateString()}</div>}
                </div>
              </div>
            )}

            {/* Customer */}
            {form.customer_name && (
              <div style={{ marginBottom: 24, padding: '12px 16px', background: 'oklch(0.97 0 0)', borderRadius: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{form.customer_name}</div>
                {form.customer_address && <div style={{ fontSize: 13, color: 'oklch(0.55 0 0)' }}>{form.customer_address}</div>}
                {form.customer_phone && <div style={{ fontSize: 13, color: 'oklch(0.55 0 0)' }}>{form.customer_phone}</div>}
                {form.customer_email && <div style={{ fontSize: 13, color: 'oklch(0.55 0 0)' }}>{form.customer_email}</div>}
              </div>
            )}

            {/* Introduction */}
            {enabledSections.some(s => s.id === 'introduction') && form.introduction && (
              <div style={{ marginBottom: 24, fontSize: 13, color: 'oklch(0.35 0 0)', lineHeight: 1.7 }}>
                {form.introduction}
              </div>
            )}

            {/* Scope of Work */}
            {enabledSections.some(s => s.id === 'scope') && form.scope_of_work && (
              <div style={{ marginBottom: 24, padding: '12px 16px', background: 'oklch(0.97 0 0)', borderRadius: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', color: 'oklch(0.55 0 0)' }}>Scope of Work</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{form.scope_of_work}</div>
              </div>
            )}

            {/* Line items */}
            {enabledSections.some(s => s.id === 'line_items') && form.line_items.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 11, textTransform: 'uppercase', color: 'oklch(0.55 0 0)' }}>Roof Components</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid oklch(0.90 0 0)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'oklch(0.55 0 0)' }}>Item</th>
                      <th style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'oklch(0.55 0 0)' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'oklch(0.55 0 0)' }}>Price</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'oklch(0.55 0 0)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.line_items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid oklch(0.95 0 0)' }}>
                        <td style={{ padding: '8px 6px' }}>{item.description || '\u2014'}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>${Number(item.unit_price).toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>
                          ${((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Inspection Notes */}
            {enabledSections.some(s => s.id === 'inspection') && form.inspection_notes && (
              <div style={{ marginBottom: 24, padding: '12px 16px', background: 'oklch(0.97 0 0)', borderRadius: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', color: 'oklch(0.55 0 0)' }}>Inspection Notes</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{form.inspection_notes}</div>
              </div>
            )}

            {/* Quote Details / Totals */}
            {enabledSections.some(s => s.id === 'quote_details') && (
              <div style={{ borderTop: '2px solid oklch(0.90 0 0)', paddingTop: 16, marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, fontSize: 14 }}>
                <div style={{ display: 'flex', gap: 24 }}><span style={{ color: 'oklch(0.55 0 0)' }}>Subtotal:</span> <span style={{ fontWeight: 600 }}>${subtotal.toFixed(2)}</span></div>
                {discounts.map((d, i) => {
                  const amt = d.type === 'percent' ? subtotal * (Number(d.value) || 0) / 100 : Number(d.value) || 0;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 24 }}>
                      <span style={{ color: 'oklch(0.55 0 0)' }}>{d.name || `Discount ${i + 1}`}:</span>
                      <span style={{ color: 'oklch(0.55 0.15 25)' }}>-${amt.toFixed(2)}{d.type === 'percent' ? ` (${d.value}%)` : ''}</span>
                    </div>
                  );
                })}
                {taxAmount > 0 && <div style={{ display: 'flex', gap: 24 }}><span style={{ color: 'oklch(0.55 0 0)' }}>Tax ({(Number(form.tax_rate) * 100).toFixed(2)}%):</span> <span>${taxAmount.toFixed(2)}</span></div>}
                <div style={{ display: 'flex', gap: 24, fontSize: 22, fontWeight: 800, marginTop: 4, color: 'oklch(0.55 0.18 250)' }}>
                  <span>Total:</span> <span>${total.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Authorization */}
            {enabledSections.some(s => s.id === 'authorization') && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 11, textTransform: 'uppercase', color: 'oklch(0.55 0 0)' }}>Authorization</div>
                {signers.map((signer, i) => (
                  <div key={i} style={{ marginBottom: 16, padding: '12px 16px', background: 'oklch(0.97 0 0)', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{signer.isPrimary ? 'Primary Signer' : `Additional Signer ${i}`}</div>
                    <div style={{ fontSize: 13 }}>{signer.first_name} {signer.last_name}</div>
                    <div style={{ fontSize: 12, color: 'oklch(0.55 0 0)' }}>{signer.email}</div>
                    <div style={{ marginTop: 16, borderTop: '1px solid oklch(0.85 0 0)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ borderBottom: '1px solid oklch(0.30 0 0)', width: 200, height: 32 }} />
                        <div style={{ fontSize: 10, color: 'oklch(0.55 0 0)', marginTop: 4 }}>Signature</div>
                      </div>
                      <div>
                        <div style={{ borderBottom: '1px solid oklch(0.30 0 0)', width: 120, height: 32 }} />
                        <div style={{ fontSize: 10, color: 'oklch(0.55 0 0)', marginTop: 4 }}>Date</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Warranty */}
            {enabledSections.some(s => s.id === 'warranty') && form.warranty_info && (
              <div style={{ marginBottom: 24, padding: '12px 16px', background: 'oklch(0.97 0 0)', borderRadius: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', color: 'oklch(0.55 0 0)' }}>Warranty</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{form.warranty_info}</div>
              </div>
            )}

            {/* Terms */}
            {enabledSections.some(s => s.id === 'terms') && form.terms && (
              <div style={{ marginBottom: 24, fontSize: 11, color: 'oklch(0.55 0 0)', lineHeight: 1.5 }}>
                <strong>Terms & Conditions:</strong> {form.terms}
              </div>
            )}

            {/* Notes */}
            {enabledSections.some(s => s.id === 'notes') && form.notes && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: 'oklch(0.97 0.01 60)', borderRadius: 8, fontSize: 12, color: 'oklch(0.40 0 0)', fontStyle: 'italic' }}>
                {form.notes}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ====================== EDITOR MODE ======================
  const enabledSections = sections.filter(s => s.enabled);

  return (
    <div className="main-content" style={{ gap: 0, padding: 0, overflow: 'hidden', height: 'calc(100vh - 64px)' }}>
      {/* Top bar */}
      <div className="glass" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--space-md) var(--space-2xl)',
        borderRadius: '20px / 18px',
        boxShadow: '0 8px 32px oklch(0 0 0 / 0.25), inset 0 1px 0 oklch(1 0 0 / 0.05)',
        flexShrink: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <button className="quick-action-btn" onClick={onCancel} style={{ padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconArrowLeft style={{ width: 14, height: 14 }} /> Back
          </button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {estimate ? `Edit ${estimate.estimate_number}` : 'New Estimate'}
          </span>
          {autoSaveStatus && (
            <span style={{ fontSize: 11, fontWeight: 600, color: autoSaveStatus === 'saved' ? 'var(--accent-green)' : 'var(--text-muted)', marginLeft: 8 }}>
              {autoSaveStatus === 'saving' ? 'Saving...' : 'Saved!'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="quick-action-btn" onClick={handleSave} disabled={saving || sending} style={{ padding: '6px 18px', fontSize: 12 }}>
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button className="quick-action-btn" onClick={() => setReviewMode(true)} style={{ padding: '6px 18px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IconEye style={{ width: 12, height: 12 }} /> Review & Share
          </button>
          <button
            className="quick-action-btn"
            onClick={() => setShowSendModal(true)}
            disabled={saving || sending}
            style={{
              padding: '6px 18px', fontSize: 12, background: 'var(--accent-blue)', color: 'oklch(1 0 0)',
              border: 'none', borderRadius: '14px / 12px',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
            title={!form.customer_email ? 'Add a customer email or a signer in the Authorization section' : 'Save and send estimate to customer'}
          >
            <IconSend style={{ width: 12, height: 12 }} /> {sending ? 'Sending...' : 'Send for Signing'}
          </button>
        </div>
      </div>

      {/* Body: Sidebar + Editor + Summary */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', paddingTop: 'var(--space-sm)', gap: 'var(--space-sm)', paddingBottom: 'var(--space-sm)' }}>
        {/* ====== LEFT SIDEBAR ====== */}
        <div className="glass" style={{
          width: 280, flexShrink: 0, borderRadius: '20px / 18px',
          overflowY: 'auto', padding: 'var(--space-md) 0', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px oklch(0 0 0 / 0.25), inset 0 1px 0 oklch(1 0 0 / 0.05)',
        }}>
          <div style={{ padding: '0 var(--space-md) var(--space-sm)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
            Sections
          </div>
          {sections.map((sec, idx) => (
            <div
              key={sec.id}
              draggable
              onDragStart={() => handleSectionDragStart(idx)}
              onDragOver={(e) => handleSectionDragOver(e, idx)}
              onDragEnd={handleSectionDragEnd}
              onClick={() => scrollToSection(sec.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
                padding: '8px var(--space-md)', cursor: 'pointer',
                background: 'transparent',
                borderLeft: activeSection === sec.id ? '3px solid var(--accent-blue)' : '3px solid transparent',
                transition: 'border-color 0.15s',
                opacity: sec.enabled ? 1 : 0.45,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'oklch(0.30 0.02 260 / 0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Drag handle */}
              <span style={{ cursor: 'grab', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1, userSelect: 'none', flexShrink: 0 }}>
                &#x2807;
              </span>
              {/* Name */}
              <span style={{ flex: 1, fontSize: 12, fontWeight: activeSection === sec.id ? 600 : 400, color: activeSection === sec.id ? 'var(--accent-blue)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sec.name}
              </span>
              {/* Toggle */}
              <span onClick={e => e.stopPropagation()}>
                <ToggleSwitch checked={sec.enabled} onChange={() => toggleSection(sec.id)} />
              </span>
            </div>
          ))}
        </div>

        {/* ====== MAIN EDITOR ====== */}
        <div ref={editorRef} style={{ flex: 1, overflowY: 'auto', padding: '0 var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>

          {/* CUSTOMER INFO — always visible */}
          <div className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 'var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Customer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label>Name</label>
                <input className="form-input" value={form.customer_name} onChange={e => updateField('customer_name', e.target.value)} placeholder="Customer name" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="form-input" value={form.customer_phone} onChange={e => updateField('customer_phone', formatPhone(e.target.value))} placeholder="(512) 555-0000" />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input className="form-input" value={form.customer_address} onChange={e => updateField('customer_address', e.target.value)} placeholder="123 Main St, Austin TX" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input className="form-input" value={form.customer_email} onChange={e => updateField('customer_email', e.target.value)} placeholder="customer@email.com" />
              </div>
            </div>
          </div>

          {/* TITLE SECTION */}
          {enabledSections.some(s => s.id === 'title') && (
            <div ref={el => sectionRefs.current.title = el} className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)', position: 'relative' }} onClick={() => setActiveSection('title')}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 'var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Title</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label>Estimate Name</label>
                  <input className="form-input" value={form.estimate_name} onChange={e => updateField('estimate_name', e.target.value)} placeholder="e.g. Roof Replacement - Smith Residence" />
                </div>
                <div className="form-group" style={{ overflow: 'visible' }}>
                  <label>Estimate Date</label>
                  <DatePicker value={form.estimate_date} onChange={v => updateField('estimate_date', v)} placeholder="Select date" />
                </div>
              </div>
              {/* Primary image upload area */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) setPrimaryImage({ file, preview: URL.createObjectURL(file) });
                  e.target.value = '';
                }}
              />
              <div
                style={{
                  marginTop: 'var(--space-md)', border: `2px dashed ${primaryImage ? 'var(--accent-green)' : 'oklch(0.35 0.02 260)'}`,
                  borderRadius: '14px / 12px', padding: primaryImage ? 0 : 'var(--space-xl)', textAlign: 'center',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  background: 'oklch(0.16 0.02 260 / 0.3)',
                  transition: 'border-color 0.2s', overflow: 'hidden', position: 'relative',
                }}
                onClick={() => imageInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
                onDragLeave={e => e.currentTarget.style.borderColor = primaryImage ? 'var(--accent-green)' : 'oklch(0.35 0.02 260)'}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = 'var(--accent-green)';
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith('image/')) setPrimaryImage({ file, preview: URL.createObjectURL(file) });
                }}
                onMouseEnter={e => { if (!primaryImage) e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
                onMouseLeave={e => { if (!primaryImage) e.currentTarget.style.borderColor = 'oklch(0.35 0.02 260)'; }}
              >
                {primaryImage ? (
                  <>
                    <img src={primaryImage.preview} alt="Primary" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
                    <button
                      onClick={e => { e.stopPropagation(); setPrimaryImage(null); }}
                      aria-label="Remove image"
                      style={{
                        position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%',
                        background: 'oklch(0 0 0 / 0.6)', border: 'none', color: 'oklch(1 0 0)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    ><IconX width={14} height={14} /></button>
                  </>
                ) : (
                  <>
                    <PhotoIcon width={32} height={32} style={{ opacity: 0.4, marginBottom: 8 }} />
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Drag & drop a primary image here</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>or click to browse files</div>
                  </>
                )}
              </div>
              <div className="form-group" style={{ marginTop: 'var(--space-md)', overflow: 'visible' }}>
                <label>Valid Until</label>
                <DatePicker value={form.valid_until} onChange={v => updateField('valid_until', v)} placeholder="Select expiry date" />
              </div>
            </div>
          )}

          {/* INTRODUCTION SECTION */}
          {enabledSections.some(s => s.id === 'introduction') && (
            <div ref={el => sectionRefs.current.introduction = el} className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }} onClick={() => setActiveSection('introduction')}>
              <SectionHeader title="Introduction" sectionId="introduction" onRemove={hideSection} />
              <div className="form-group">
                <RichTextEditor value={form.introduction} onChange={v => updateField('introduction', v)} placeholder="Write an introduction for your estimate..." tokens={ESTIMATE_TOKENS} />
                <SectionImageBar sectionId="introduction" images={sectionImages.introduction} onAdd={addSectionImage} onRemove={removeSectionImage} />
              </div>
            </div>
          )}

          {/* SCOPE OF WORK SECTION */}
          {enabledSections.some(s => s.id === 'scope') && (
            <div ref={el => sectionRefs.current.scope = el} className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }} onClick={() => setActiveSection('scope')}>
              <SectionHeader title="Scope of Work" sectionId="scope" onRemove={hideSection} />
              <div className="form-group">
                <RichTextEditor value={form.scope_of_work} onChange={v => updateField('scope_of_work', v)} placeholder="Describe the work to be performed..." tokens={ESTIMATE_TOKENS} />
                <SectionImageBar sectionId="scope" images={sectionImages.scope} onAdd={addSectionImage} onRemove={removeSectionImage} />
              </div>
            </div>
          )}

          {/* ROOF COMPONENTS / LINE ITEMS SECTION */}
          {enabledSections.some(s => s.id === 'line_items') && (
            <div ref={el => sectionRefs.current.line_items = el} className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)', position: 'relative' }} onClick={() => setActiveSection('line_items')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Roof Components</div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                  <CustomSelect
                    value=""
                    onChange={(v) => {
                      const tmpl = templates.find(t => t.id === v);
                      if (tmpl) addLineItem(tmpl);
                    }}
                    placeholder="From preset..."
                    icon={<IconPlusCircle style={{ width: 13, height: 13, flexShrink: 0 }} />}
                    options={[{ value: '', label: 'From preset...' }, ...templates.map(t => ({ value: t.id, label: t.name }))]}
                    style={{ minWidth: 140 }}
                  />
                  {templates.length > 0 && (
                    <button className="quick-action-btn" onClick={addAllPresets} style={{ padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <IconPlusCircle style={{ width: 13, height: 13 }} /> Add All
                    </button>
                  )}
                  <button className="quick-action-btn" onClick={() => addLineItem(null)} style={{ padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <IconPlusCircle style={{ width: 13, height: 13 }} /> Blank Row
                  </button>
                  <button className="quick-action-btn" onClick={() => setShowSRSCatalog(true)} style={{
                    padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
                    background: 'oklch(0.55 0.18 250 / 0.12)', color: 'var(--accent-blue)',
                    border: '1px solid oklch(0.55 0.18 250 / 0.25)',
                  }}>
                    <IconPlusCircle style={{ width: 13, height: 13 }} /> Add from SRS Catalog
                  </button>
                  {linkedCount > 0 && (
                    <button className="quick-action-btn" onClick={syncMaterialPrices} style={{
                      padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
                      background: 'oklch(0.75 0.18 155 / 0.12)', color: 'oklch(0.75 0.18 155)',
                      border: '1px solid oklch(0.75 0.18 155 / 0.25)',
                    }}>
                      <IconRefresh style={{ width: 12, height: 12 }} /> Sync Prices ({linkedCount})
                    </button>
                  )}
                </div>
              </div>

              {form.line_items.length === 0 ? (
                <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Add line items using presets or blank rows
                </div>
              ) : (
                <div style={{ background: 'oklch(0.16 0.02 260 / 0.4)', borderRadius: '14px / 12px', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 70px 100px 80px 24px', gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-sm) 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                    <span></span><span>Item</span><span style={{ textAlign: 'center' }}>Qty</span><span style={{ textAlign: 'center' }}>Price</span><span style={{ textAlign: 'center' }}>Total</span><span></span>
                  </div>
                  {form.line_items.map((item, idx) => (
                    <div
                      key={idx}
                      draggable
                      onDragStart={e => handleLineDragStart(e, idx)}
                      onDragOver={handleLineDragOver}
                      onDrop={e => handleLineDrop(e, idx)}
                      onDragEnd={() => setDragLineIdx(null)}
                      style={{
                        padding: 'var(--space-sm)',
                        borderTop: idx > 0 ? '1px solid oklch(0.25 0.02 260 / 0.3)' : 'none',
                        opacity: dragLineIdx === idx ? 0.4 : 1,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {/* Top row: drag + name + qty + price + total + delete */}
                      <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 70px 100px 80px 24px', gap: 'var(--space-sm)', alignItems: 'center' }}>
                        <span style={{ cursor: 'grab', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1, userSelect: 'none', textAlign: 'center' }}>&#x2807;</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                          {item.srs_product_id && (
                            <span title={`Linked: ${item.srs_sku || item.srs_product_id}`} style={{
                              fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
                              background: 'oklch(0.75 0.18 155 / 0.15)', color: 'oklch(0.75 0.18 155)',
                              border: '1px solid oklch(0.75 0.18 155 / 0.25)', flexShrink: 0, lineHeight: 1,
                              textTransform: 'uppercase', letterSpacing: '0.05em',
                            }}>SRS</span>
                          )}
                          <input className="form-input" value={item.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} placeholder="Item name" style={{ fontSize: 12, padding: '8px 10px', minWidth: 0, boxSizing: 'border-box', flex: 1, fontWeight: 600 }} />
                        </div>
                        <input className="form-input" type="number" min="0" step="1" value={item.quantity} onChange={e => updateLineItem(idx, 'quantity', e.target.value)} style={{ fontSize: 12, padding: '8px 6px', minWidth: 0, boxSizing: 'border-box', textAlign: 'center' }} />
                        <input className="form-input" type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateLineItem(idx, 'unit_price', e.target.value)} style={{ fontSize: 12, padding: '8px 6px', minWidth: 0, boxSizing: 'border-box', textAlign: 'center' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
                        </span>
                        <button onClick={() => removeLineItem(idx)} style={{ color: 'var(--accent-red)', lineHeight: 1, padding: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <IconTrash style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                      {/* Detail row: description textarea below the item name */}
                      <div style={{ paddingLeft: 24, paddingTop: 4 }}>
                        <textarea
                          className="form-input"
                          value={item.details || ''}
                          onChange={e => updateLineItem(idx, 'details', e.target.value)}
                          placeholder="Item description / notes..."
                          rows={2}
                          style={{ fontSize: 11, padding: '6px 10px', width: '100%', boxSizing: 'border-box', resize: 'vertical', color: 'var(--text-secondary)', lineHeight: 1.5 }}
                        />
                      </div>
                    </div>
                  ))}
                  {/* Subtotal row */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '20px 1fr 70px 100px 80px 24px', gap: 'var(--space-sm)',
                    alignItems: 'center', padding: 'var(--space-sm)', borderTop: '1px solid var(--glass-border)',
                  }}>
                    <span></span><span></span><span></span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Subtotal</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-green)', textAlign: 'center' }}>
                      ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INSPECTION NOTES SECTION */}
          {enabledSections.some(s => s.id === 'inspection') && (
            <div ref={el => sectionRefs.current.inspection = el} className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }} onClick={() => setActiveSection('inspection')}>
              <SectionHeader title="Inspection Notes" sectionId="inspection" onRemove={hideSection} />
              <div className="form-group">
                <RichTextEditor value={form.inspection_notes} onChange={v => updateField('inspection_notes', v)} placeholder="Document findings from the roof inspection..." />
                <SectionImageBar sectionId="inspection" images={sectionImages.inspection} onAdd={addSectionImage} onRemove={removeSectionImage} />
              </div>
            </div>
          )}

          {/* QUOTE DETAILS SECTION — Discounts + Tax + Profit Margin + Summary */}
          {enabledSections.some(s => s.id === 'quote_details') && (
            <div ref={el => sectionRefs.current.quote_details = el} className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)', position: 'relative' }} onClick={() => setActiveSection('quote_details')}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 'var(--space-lg)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Quote Details</div>

              {/* Discounts */}
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Discounts</label>
                  <button className="quick-action-btn" onClick={addDiscount} style={{ padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <IconPlusCircle style={{ width: 13, height: 13 }} /> Add Discount
                  </button>
                </div>
                {discounts.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 'var(--space-sm) 0' }}>No discounts applied</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {discounts.map((d, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <input
                          className="form-input"
                          value={d.name}
                          onChange={e => updateDiscount(idx, 'name', e.target.value)}
                          placeholder="Discount name (e.g. Veteran)"
                          style={{ flex: 1, fontSize: 12, padding: '8px 10px', minWidth: 0, boxSizing: 'border-box' }}
                        />
                        <input
                          className="form-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={d.value}
                          onChange={e => updateDiscount(idx, 'value', e.target.value)}
                          style={{ width: 90, fontSize: 12, padding: '8px 6px', textAlign: 'center', boxSizing: 'border-box' }}
                        />
                        {/* $ / % toggle */}
                        <button
                          className="quick-action-btn"
                          onClick={() => updateDiscount(idx, 'type', d.type === 'flat' ? 'percent' : 'flat')}
                          style={{
                            padding: '6px 10px', fontSize: 11, fontWeight: 700, minWidth: 36,
                            color: d.type === 'percent' ? 'var(--accent-blue)' : 'var(--accent-green)',
                          }}
                        >
                          {d.type === 'percent' ? '%' : '$'}
                        </button>
                        <button
                          onClick={() => removeDiscount(idx)}
                          style={{ color: 'var(--accent-red)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                        >
                          <IconX style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tax rate selector */}
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="form-group" style={{ maxWidth: 220 }}>
                  <label>Tax Rate</label>
                  <CustomSelect
                    value={form.tax_rate}
                    onChange={v => updateField('tax_rate', v)}
                    options={TAX_OPTIONS.map(t => ({ value: t.value, label: t.label }))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Profit margin slider */}
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Profit margin for this estimate</label>
                  <span title="Calculated as (total - cost) / total * 100" style={{ cursor: 'help', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    <QuestionMarkCircleIcon width={14} height={14} />
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={profitMargin}
                    onChange={e => setProfitMargin(Number(e.target.value))}
                    style={{
                      flex: 1, height: 6, appearance: 'none', background: `linear-gradient(to right, var(--accent-blue) ${profitMargin}%, oklch(0.30 0.02 260) ${profitMargin}%)`,
                      borderRadius: 3, outline: 'none', cursor: 'pointer',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      max="100"
                      value={profitMargin}
                      onChange={e => setProfitMargin(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                      style={{ width: 60, fontSize: 12, padding: '6px 8px', textAlign: 'center', boxSizing: 'border-box' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                  Estimated cost: {formatCurrency(estimatedCost)} | Estimated profit: {formatCurrency(total - estimatedCost)}
                </div>
              </div>

              {/* Summary panel */}
              <div style={{
                background: 'oklch(0.16 0.02 260 / 0.5)', borderRadius: '14px / 12px',
                border: '1px solid var(--glass-border)', padding: 'var(--space-lg)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                  Summary
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
                  </div>
                  {discounts.map((d, i) => {
                    const amt = d.type === 'percent' ? subtotal * (Number(d.value) || 0) / 100 : Number(d.value) || 0;
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{d.name || `Discount ${i + 1}`}</span>
                        <span style={{ color: 'var(--accent-red)' }}>-{formatCurrency(amt)}{d.type === 'percent' ? ` (${d.value}%)` : ''}</span>
                      </div>
                    );
                  })}
                  {Number(form.tax_rate) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Tax ({(Number(form.tax_rate) * 100).toFixed(2)}%)</span>
                      <span>{formatCurrency(taxAmount)}</span>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: 'var(--space-xs)', paddingTop: 'var(--space-sm)', display: 'flex', justifyContent: 'space-between', fontSize: 16 }}>
                    <span style={{ fontWeight: 800 }}>Total</span>
                    <span style={{ fontWeight: 800, color: 'var(--accent-green)' }}>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INSURANCE DETAILS SECTION (vs RoofLink) */}
          <div className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: insuranceEnabled ? 'var(--space-md)' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <ShieldCheckIcon style={{ width: 18, height: 18, color: 'var(--accent-blue)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Insurance Claim</span>
              </div>
              <button onClick={() => setInsuranceEnabled(!insuranceEnabled)}
                style={{
                  width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative',
                  background: insuranceEnabled ? 'oklch(0.55 0.18 250)' : 'oklch(0.3 0.02 260)',
                  transition: 'background 0.15s',
                }}>
                <span style={{
                  position: 'absolute', top: 3, left: insuranceEnabled ? 21 : 3,
                  width: 18, height: 18, borderRadius: '50%', background: 'oklch(1 0 0)',
                  transition: 'left 0.15s',
                }} />
              </button>
            </div>
            {insuranceEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                  <div className="form-group">
                    <label>Insurance Company</label>
                    <input className="form-input" value={insuranceDetails.insurance_company} onChange={e => setInsuranceDetails(p => ({ ...p, insurance_company: e.target.value }))} placeholder="e.g. State Farm" />
                  </div>
                  <div className="form-group">
                    <label>Claim Number</label>
                    <input className="form-input" value={insuranceDetails.claim_number} onChange={e => setInsuranceDetails(p => ({ ...p, claim_number: e.target.value }))} placeholder="CLM-12345" />
                  </div>
                  <div className="form-group" style={{ overflow: 'visible' }}>
                    <label>Date of Loss</label>
                    <DatePicker value={insuranceDetails.date_of_loss} onChange={v => setInsuranceDetails(p => ({ ...p, date_of_loss: v }))} placeholder="Select date" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                  <div className="form-group">
                    <label>RCV (Replacement Cost)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, pointerEvents: 'none' }}>$</span>
                      <input className="form-input" type="number" step="0.01" value={insuranceDetails.rcv} onChange={e => {
                        const rcv = e.target.value;
                        setInsuranceDetails(p => {
                          const acv = Number(p.acv) || 0;
                          const dep = rcv && acv ? (Number(rcv) - acv).toFixed(2) : p.depreciation;
                          return { ...p, rcv, depreciation: Number(rcv) > 0 && acv > 0 ? dep : p.depreciation };
                        });
                      }} placeholder="0.00" style={{ paddingLeft: 22 }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>ACV (Actual Cash Value)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, pointerEvents: 'none' }}>$</span>
                      <input className="form-input" type="number" step="0.01" value={insuranceDetails.acv} onChange={e => {
                        const acv = e.target.value;
                        setInsuranceDetails(p => {
                          const rcv = Number(p.rcv) || 0;
                          const dep = rcv && acv ? (rcv - Number(acv)).toFixed(2) : p.depreciation;
                          return { ...p, acv, depreciation: rcv > 0 && Number(acv) > 0 ? dep : p.depreciation };
                        });
                      }} placeholder="0.00" style={{ paddingLeft: 22 }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Depreciation <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>(auto-calculated)</span></label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, pointerEvents: 'none' }}>$</span>
                      <input className="form-input" type="number" step="0.01" value={insuranceDetails.depreciation} onChange={e => setInsuranceDetails(p => ({ ...p, depreciation: e.target.value }))} placeholder="0.00" style={{ paddingLeft: 22 }} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                  <div className="form-group">
                    <label>Deductible</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, pointerEvents: 'none' }}>$</span>
                      <input className="form-input" type="number" step="0.01" value={insuranceDetails.deductible} onChange={e => setInsuranceDetails(p => ({ ...p, deductible: e.target.value }))} placeholder="0.00" style={{ paddingLeft: 22 }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>O&P (Overhead & Profit)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, pointerEvents: 'none' }}>$</span>
                      <input className="form-input" type="number" step="0.01" value={insuranceDetails.overhead_profit} onChange={e => setInsuranceDetails(p => ({ ...p, overhead_profit: e.target.value }))} placeholder="0.00" style={{ paddingLeft: 22 }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Proceeds Received</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, pointerEvents: 'none' }}>$</span>
                      <input className="form-input" type="number" step="0.01" value={insuranceDetails.proceeds_received} onChange={e => setInsuranceDetails(p => ({ ...p, proceeds_received: e.target.value }))} placeholder="0.00" style={{ paddingLeft: 22 }} />
                    </div>
                  </div>
                </div>
                {/* Insurance summary bar */}
                {(Number(insuranceDetails.rcv) > 0 || Number(insuranceDetails.acv) > 0) && (
                  <div style={{
                    background: 'oklch(0.16 0.02 260 / 0.5)', borderRadius: '14px / 12px',
                    border: '1px solid var(--glass-border)', padding: 'var(--space-md)',
                    display: 'flex', gap: 'var(--space-lg)', justifyContent: 'center', flexWrap: 'wrap',
                  }}>
                    {(() => {
                      const rcv = Number(insuranceDetails.rcv) || 0;
                      const acv = Number(insuranceDetails.acv) || 0;
                      const deductible = Number(insuranceDetails.deductible) || 0;
                      const op = Number(insuranceDetails.overhead_profit) || 0;
                      const proceeds = Number(insuranceDetails.proceeds_received) || 0;
                      const insurancePays = Math.max(0, acv - deductible + op);
                      const customerOwes = Math.max(0, rcv + op - insurancePays);
                      return [
                        { label: 'RCV', val: insuranceDetails.rcv, color: 'var(--accent-blue)' },
                        { label: 'ACV', val: insuranceDetails.acv, color: 'var(--accent-cyan)' },
                        { label: 'Depr.', val: insuranceDetails.depreciation, color: 'var(--accent-amber)' },
                        { label: 'Deductible', val: insuranceDetails.deductible, color: 'var(--accent-red)' },
                        { label: 'O&P', val: insuranceDetails.overhead_profit, color: 'var(--accent-green)' },
                        { label: 'Ins. Pays', val: insurancePays > 0 ? insurancePays.toFixed(2) : '', color: 'oklch(0.72 0.19 145)' },
                        { label: 'Customer Owes', val: customerOwes > 0 ? customerOwes.toFixed(2) : '', color: 'var(--accent-red)' },
                        { label: 'Balance Due', val: (rcv - proceeds).toFixed(2), color: 'var(--accent-purple)' },
                      ];
                    })().filter(x => Number(x.val) > 0).map(item => (
                      <div key={item.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{formatCurrency(item.val)}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* UPGRADES / UPSELL SECTION (vs SumoQuote — $2,078 avg upsell) */}
          <div className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <ArrowUpCircleIcon style={{ width: 18, height: 18, color: 'var(--accent-amber)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Optional Upgrades</span>
              </div>
              <button className="quick-action-btn" onClick={() => setUpgrades(prev => [...prev, { name: '', description: '', price: '', selected: false }])}
                style={{ fontSize: 11, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Upgrade
              </button>
            </div>
            {upgrades.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-md)' }}>
                No upgrades yet. Add optional upsells that customers can select when signing.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {upgrades.map((upg, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                    padding: '10px 12px', background: 'oklch(0.16 0.02 260 / 0.4)',
                    borderRadius: 'var(--radius-sm)', border: upg.selected ? '1px solid oklch(0.75 0.18 155 / 0.3)' : '1px solid transparent',
                  }}>
                    <input type="checkbox" checked={upg.selected}
                      onChange={() => setUpgrades(prev => prev.map((u, i) => i === idx ? { ...u, selected: !u.selected } : u))}
                      style={{ accentColor: 'oklch(0.6 0.18 155)', width: 16, height: 16, cursor: 'pointer' }} />
                    <input className="form-input" value={upg.name} placeholder="Upgrade name"
                      onChange={e => setUpgrades(prev => prev.map((u, i) => i === idx ? { ...u, name: e.target.value } : u))}
                      style={{ flex: 2, fontSize: 12, padding: '6px 8px' }} />
                    <input className="form-input" value={upg.description} placeholder="Description (optional)"
                      onChange={e => setUpgrades(prev => prev.map((u, i) => i === idx ? { ...u, description: e.target.value } : u))}
                      style={{ flex: 3, fontSize: 12, padding: '6px 8px' }} />
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12, pointerEvents: 'none' }}>$</span>
                      <input className="form-input" type="number" step="0.01" value={upg.price} placeholder="0.00"
                        onChange={e => setUpgrades(prev => prev.map((u, i) => i === idx ? { ...u, price: e.target.value } : u))}
                        style={{ width: 100, fontSize: 12, padding: '6px 8px 6px 20px', textAlign: 'right' }} />
                    </div>
                    <button onClick={() => setUpgrades(prev => prev.filter((_, i) => i !== idx))}
                      style={{ color: 'var(--accent-red)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                      <IconX style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ))}
                {/* Upgrades total */}
                {upgrades.some(u => u.selected && Number(u.price) > 0) && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', background: 'oklch(0.75 0.18 155 / 0.08)',
                    borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-xs)',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Selected Upgrades Total</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-green)' }}>
                      +{formatCurrency(upgrades.filter(u => u.selected).reduce((sum, u) => sum + (Number(u.price) || 0), 0))}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FINANCING SECTION */}
          {hasLender && (
            <div className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: financingEnabled ? 'var(--space-md)' : 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Financing Options</div>
                <button onClick={() => setFinancingEnabled(!financingEnabled)}
                  style={{
                    width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative',
                    background: financingEnabled ? 'oklch(0.55 0.18 145)' : 'oklch(0.3 0.02 260)',
                    transition: 'background 0.15s',
                  }}>
                  <span style={{
                    position: 'absolute', top: 3, left: financingEnabled ? 21 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: 'oklch(1 0 0)',
                    transition: 'left 0.15s',
                  }} />
                </button>
              </div>
              {financingEnabled && availablePlans.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {availablePlans.map(plan => {
                    const checked = selectedPlanIds.includes(plan.id);
                    const monthly = calcMonthlyPayment(Math.round(total * 100), Number(plan.apr), plan.term_months);
                    return (
                      <label key={plan.id} style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', padding: '8px 12px',
                        background: 'oklch(0.16 0.02 260 / 0.4)', borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer', fontSize: 13,
                      }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => setSelectedPlanIds(prev => checked ? prev.filter(id => id !== plan.id) : [...prev, plan.id])}
                          style={{ accentColor: 'oklch(0.6 0.18 250)' }} />
                        <span style={{ flex: 1, fontWeight: 600 }}>{plan.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {plan.term_months}mo @ {Number(plan.apr).toFixed(2)}%
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--accent-green)', fontSize: 12 }}>
                          {formatMoney(monthly)}/mo
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {financingEnabled && availablePlans.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-sm)' }}>
                  No active plans. Configure plans in Settings → Financing.
                </div>
              )}
            </div>
          )}

          {/* AUTHORIZATION SECTION */}
          {enabledSections.some(s => s.id === 'authorization') && (
            <div ref={el => sectionRefs.current.authorization = el} className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }} onClick={() => setActiveSection('authorization')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Authorization</div>
                <button className="quick-action-btn" onClick={addSigner} style={{ padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <IconPlusCircle style={{ width: 13, height: 13 }} /> Add Additional Signer
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {signers.map((signer, idx) => (
                  <div key={idx} style={{
                    background: 'oklch(0.16 0.02 260 / 0.4)', borderRadius: '14px / 12px',
                    border: '1px solid var(--glass-border)', padding: 'var(--space-md)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: signer.isPrimary ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                        {signer.isPrimary ? 'Primary Signer' : `Additional Signer ${idx}`}
                      </span>
                      {!signer.isPrimary && (
                        <button
                          onClick={() => removeSigner(idx)}
                          className="quick-action-btn"
                          style={{ padding: '4px 10px', fontSize: 11, color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <IconTrash style={{ width: 12, height: 12 }} /> Remove Signer
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-sm)' }}>
                      <div className="form-group">
                        <label style={{ fontSize: 11 }}>First Name</label>
                        <input className="form-input" value={signer.first_name} onChange={e => updateSigner(idx, 'first_name', e.target.value)} placeholder="First" style={{ fontSize: 12, padding: '8px 10px' }} />
                      </div>
                      <div className="form-group">
                        <label style={{ fontSize: 11 }}>Last Name</label>
                        <input className="form-input" value={signer.last_name} onChange={e => updateSigner(idx, 'last_name', e.target.value)} placeholder="Last" style={{ fontSize: 12, padding: '8px 10px' }} />
                      </div>
                      <div className="form-group">
                        <label style={{ fontSize: 11 }}>Email</label>
                        <input className="form-input" type="email" value={signer.email} onChange={e => updateSigner(idx, 'email', e.target.value)} placeholder="email@example.com" style={{ fontSize: 12, padding: '8px 10px' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Deposit / Progress Payment */}
              <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: depositEnabled ? 'var(--space-md)' : 0 }}>
                  <button
                    type="button"
                    onClick={() => setDepositEnabled(!depositEnabled)}
                    style={{
                      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: depositEnabled ? 'oklch(0.72 0.19 250)' : 'oklch(0.30 0.02 260)',
                      position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, left: depositEnabled ? 18 : 2,
                      width: 16, height: 16, borderRadius: '50%', background: 'white',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px oklch(0 0 0 / 0.3)',
                    }} />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Require deposit upon signing</span>
                </div>
                {depositEnabled && (
                  <div style={{
                    background: 'oklch(0.16 0.02 260 / 0.4)', borderRadius: '14px / 12px',
                    border: '1px solid var(--glass-border)', padding: 'var(--space-md)',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-sm)' }}>
                      <div className="form-group">
                        <label style={{ fontSize: 11 }}>Deposit Amount</label>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            className="form-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={deposit.amount}
                            onChange={e => setDeposit(d => ({ ...d, amount: e.target.value }))}
                            placeholder={deposit.type === 'percent' ? '50' : '500.00'}
                            style={{ fontSize: 12, padding: '8px 10px', flex: 1 }}
                          />
                          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                            <button type="button" onClick={() => setDeposit(d => ({ ...d, type: 'flat' }))}
                              style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: deposit.type === 'flat' ? 'oklch(0.72 0.19 250 / 0.3)' : 'transparent', color: deposit.type === 'flat' ? 'oklch(0.72 0.19 250)' : 'var(--text-muted)' }}>$</button>
                            <button type="button" onClick={() => setDeposit(d => ({ ...d, type: 'percent' }))}
                              style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: deposit.type === 'percent' ? 'oklch(0.72 0.19 250 / 0.3)' : 'transparent', color: deposit.type === 'percent' ? 'oklch(0.72 0.19 250)' : 'var(--text-muted)' }}>%</button>
                          </div>
                        </div>
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: 11 }}>Description</label>
                        <input
                          className="form-input"
                          value={deposit.description}
                          onChange={e => setDeposit(d => ({ ...d, description: e.target.value }))}
                          placeholder="e.g., Due upon signing, 50% upfront"
                          style={{ fontSize: 12, padding: '8px 10px' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TERMS & CONDITIONS SECTION */}
          {enabledSections.some(s => s.id === 'terms') && (
            <div ref={el => sectionRefs.current.terms = el} className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }} onClick={() => setActiveSection('terms')}>
              <SectionHeader title="Terms & Conditions" sectionId="terms" onRemove={hideSection} />
              <div className="form-group">
                <RichTextEditor value={form.terms} onChange={v => updateField('terms', v)} placeholder="Enter terms and conditions..." tokens={ESTIMATE_TOKENS} />
              </div>
            </div>
          )}

          {/* WARRANTY SECTION */}
          {enabledSections.some(s => s.id === 'warranty') && (
            <div ref={el => sectionRefs.current.warranty = el} className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }} onClick={() => setActiveSection('warranty')}>
              <SectionHeader title="Warranty" sectionId="warranty" onRemove={hideSection} />
              <div className="form-group">
                <RichTextEditor value={form.warranty_info} onChange={v => updateField('warranty_info', v)} placeholder="Manufacturer warranty details, coverage period, exclusions..." minHeight={60} tokens={ESTIMATE_TOKENS} />
              </div>
            </div>
          )}

          {/* NOTES SECTION */}
          {enabledSections.some(s => s.id === 'notes') && (
            <div ref={el => sectionRefs.current.notes = el} className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }} onClick={() => setActiveSection('notes')}>
              <SectionHeader title="Notes" sectionId="notes" onRemove={hideSection} />
              <div className="form-group">
                <RichTextEditor value={form.notes} onChange={v => updateField('notes', v)} placeholder="Add a note at the bottom of your estimate..." minHeight={60} />
              </div>
            </div>
          )}

          {/* Add Section button */}
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="quick-action-btn" onClick={addCustomSection} style={{
              padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
              background: 'oklch(0.75 0.18 155 / 0.12)', color: 'oklch(0.75 0.18 155)',
              border: '1px solid oklch(0.75 0.18 155 / 0.25)',
            }}>
              <IconPlusCircle style={{ width: 13, height: 13 }} /> Add Section
            </button>
          </div>

          {/* Footer Notes — always visible */}
          <div className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 'var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Footer Notes</div>
            <RichTextEditor value={footerNotes} onChange={setFooterNotes} placeholder="Add a note to the bottom of your estimate..." minHeight={60} />
          </div>

          {/* Save All button */}
          <button className="quick-action-btn" onClick={handleSave} disabled={saving} style={{
            padding: '12px 24px', fontSize: 13, fontWeight: 700, alignSelf: 'flex-end',
            background: 'var(--accent-blue)', color: 'oklch(1 0 0)', border: 'none',
            borderRadius: '14px / 12px', opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Saving...' : 'Save All'}
          </button>

          {/* Bottom spacer */}
          <div style={{ height: 'var(--space-xl)' }} />
        </div>
      </div>

      {showSRSCatalog && (
        <SRSCatalogModal
          onClose={() => setShowSRSCatalog(false)}
          onSelect={(item) => {
            setForm(f => ({ ...f, line_items: [...f.line_items, item] }));
            setShowSRSCatalog(false);
          }}
        />
      )}

      {showSendModal && (
        <SendForSigningModal
          signers={signers}
          customerEmail={form.customer_email}
          sending={sending}
          onClose={() => setShowSendModal(false)}
          onSend={async (emailBody) => {
            setSending(true);
            try {
              const payload = { ...form, discounts, signers, profit_margin: profitMargin, footer_notes: footerNotes };
              let est;
              if (estimate) {
                await estimatesApi.updateEstimate(estimate.id, payload);
                est = estimate;
              } else {
                const res = await estimatesApi.createEstimate(payload);
                est = res.data;
              }
              await estimatesApi.sendEstimate(est.id);
              showToast('Estimate sent for signing', 'success');
              setShowSendModal(false);
              onSave();
            } catch {
              showToast('Failed to send estimate', 'error');
            } finally {
              setSending(false);
            }
          }}
        />
      )}

      {showSignModal && estimate && (
        <InPersonSignModal
          estimateId={estimate.id}
          customerName={form.customer_name}
          onClose={() => setShowSignModal(false)}
          onSigned={() => {
            setShowSignModal(false);
            showToast('Estimate signed in person', 'success');
            onSave();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// IN-PERSON SIGN MODAL — SumoQuote on-the-spot signing pattern
// ============================================================

function InPersonSignModal({ estimateId, customerName, onClose, onSigned }) {
  const [signerName, setSignerName] = useState(customerName || '');
  const [signing, setSigning] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDraw = (e) => {
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDraw = () => { drawingRef.current = false; };

  const clearSignature = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const handleSign = async () => {
    if (!signerName.trim()) { showToast('Enter signer name', 'error'); return; }
    setSigning(true);
    try {
      const signatureData = canvasRef.current.toDataURL('image/png');
      await estimatesApi.signInPerson(estimateId, {
        signer_name: signerName.trim(),
        signature_data: signatureData,
      });
      onSigned();
    } catch {
      showToast('Failed to sign estimate', 'error');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div className="glass modal-scale-in" onClick={e => e.stopPropagation()} style={{
        borderRadius: 20, padding: 'var(--space-xl)', width: 480, maxWidth: '95vw',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Sign Estimate In Person</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <IconX style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
          Hand the device to the customer to sign. Their signature will be captured and the estimate marked as accepted.
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Signer Name</label>
          <input
            className="form-input"
            value={signerName}
            onChange={e => setSignerName(e.target.value)}
            placeholder="Customer full name"
          />
        </div>

        <div style={{ marginBottom: 'var(--space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Signature</label>
            <button onClick={clearSignature} className="quick-action-btn" style={{ padding: '4px 10px', fontSize: 11 }}>Clear</button>
          </div>
          <canvas
            ref={canvasRef}
            width={420}
            height={150}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
            style={{
              width: '100%', height: 150, borderRadius: 12,
              border: '1px solid var(--glass-border)', cursor: 'crosshair',
              background: 'oklch(0.98 0 0)', touchAction: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
          <button className="quick-action-btn" onClick={onClose} style={{ padding: '10px 20px', fontSize: 13 }}>Cancel</button>
          <button className="auth-btn" onClick={handleSign} disabled={signing || !signerName.trim()} style={{
            padding: '10px 24px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <IconCheck style={{ width: 14, height: 14 }} /> {signing ? 'Signing...' : 'Accept & Sign'}
          </button>
        </div>
      </div>
    </div>
  );
}
