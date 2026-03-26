import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as contractsApi from '../api/contracts';
import { getLeads } from '../api/crm';
import client from '../api/client';
import { IconPlusCircle, IconArrowLeft, IconSend, IconEye, IconX, IconTrash } from './Icons';
import { DocumentTextIcon, PencilSquareIcon, ClockIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';
import CustomSelect from './CustomSelect';
import { showToast } from './Toast';

const statusColors = {
  draft: 'var(--text-muted)',
  sent: 'var(--accent-blue)',
  viewed: 'oklch(0.8 0.15 85)',
  signed: 'var(--accent-green)',
  voided: 'var(--accent-red)',
};

const statusLabels = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  signed: 'Signed',
  voided: 'Voided',
};

// Merge fields in template content
function resolveMergeFields(text, data) {
  if (!text) return '';
  return text
    .replace(/\{\{customer_name\}\}/g, data.customerName || '')
    .replace(/\{\{customer_email\}\}/g, data.customerEmail || '')
    .replace(/\{\{customer_phone\}\}/g, data.customerPhone || '')
    .replace(/\{\{customer_address\}\}/g, data.customerAddress || '')
    .replace(/\{\{company_name\}\}/g, data.companyName || '')
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
    .replace(/\{\{estimate_total\}\}/g, data.estimateTotal || '')
    .replace(/\{\{estimate_number\}\}/g, data.estimateNumber || '');
}

export default function ContractsView() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await contractsApi.getContracts(params);
      setContracts(res.data.contracts || res.data || []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  // Handle fromEstimate or leadId URL params
  useEffect(() => {
    const fromEstimate = searchParams.get('fromEstimate');
    const leadId = searchParams.get('leadId');
    if (fromEstimate || leadId) {
      setShowBuilder(true);
    }
  }, [searchParams]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768); useEffect(() => { const mq = window.matchMedia('(max-width: 768px)'); const h = (e) => setIsMobile(e.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, []);

  const handleNew = () => {
    setEditingContract(null);
    setShowBuilder(true);
  };

  const handleEdit = (c) => {
    setEditingContract(c);
    setShowBuilder(true);
  };

  const handleSaved = () => {
    setShowBuilder(false);
    setEditingContract(null);
    // Clear URL params
    setSearchParams({});
    fetchContracts();
  };

  const handleSend = async (c) => {
    try {
      await contractsApi.sendContract(c.id);
      showToast('Contract sent', 'success');
      fetchContracts();
    } catch {
      showToast('Failed to send contract', 'error');
    }
  };

  const handleVoid = async (c) => {
    try {
      await contractsApi.voidContract(c.id);
      showToast('Contract voided', 'success');
      fetchContracts();
    } catch {
      showToast('Failed to void contract', 'error');
    }
  };

  if (showBuilder) {
    return (
      <ContractBuilder
        contract={editingContract}
        fromEstimateId={searchParams.get('fromEstimate')}
        leadId={searchParams.get('leadId')}
        onSave={handleSaved}
        onCancel={() => { setShowBuilder(false); setEditingContract(null); setSearchParams({}); }}
      />
    );
  }

  const totalContracts = contracts.length;
  const draftCount = contracts.filter(c => c.status === 'draft').length;
  const sentCount = contracts.filter(c => c.status === 'sent' || c.status === 'viewed').length;
  const signedCount = contracts.filter(c => c.status === 'signed').length;

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)' }}>
      {/* KPIs */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { Icon: DocumentTextIcon, value: totalContracts, label: 'Total Contracts', color: '330' },
          { Icon: PencilSquareIcon, value: draftCount, label: 'Drafts', color: '250' },
          { Icon: ClockIcon, value: sentCount, label: 'Awaiting Signature', color: '85' },
          { Icon: CheckBadgeIcon, value: signedCount, label: 'Signed', color: '155' },
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
            { value: 'signed', label: 'Signed' },
            { value: 'voided', label: 'Voided' },
          ]}
          style={{ minWidth: 160 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{totalContracts} contract{totalContracts !== 1 ? 's' : ''}</span>
        <button className="auth-btn" onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <IconPlusCircle style={{ width: 14, height: 14 }} /> New Contract
        </button>
      </div>

      {/* Table */}
      <div className="glass" style={{ borderRadius: '20px / 18px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="lead-table">
            <thead>
              <tr>
                <th>Contract ID</th>
                <th>Customer</th>
                <th>Template</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && contracts.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : contracts.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>
                  No contracts yet — create your first one
                </td></tr>
              ) : contracts.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
                    {c.id?.substring(0, 8) || '—'}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.customer_name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.customer_email || ''}</div>
                  </td>
                  <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{c.template_type || c.template_name || '—'}</td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                      background: `color-mix(in oklch, ${statusColors[c.status] || 'var(--text-muted)'} 15%, transparent)`,
                      color: statusColors[c.status] || 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{statusLabels[c.status] || c.status}</span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--space-xs)', justifyContent: 'center' }}>
                      <button className="quick-action-btn" onClick={() => handleEdit(c)} style={{ padding: '8px 14px', fontSize: 11 }}>
                        View
                      </button>
                      {(c.status === 'draft') && (
                        <button className="quick-action-btn" onClick={() => handleSend(c)} style={{ padding: '8px 14px', fontSize: 11, color: 'var(--accent-blue)' }}>
                          Send
                        </button>
                      )}
                      {(c.status !== 'voided' && c.status !== 'signed') && (
                        <button className="quick-action-btn" onClick={() => handleVoid(c)} style={{ padding: '8px 14px', fontSize: 11, color: 'var(--accent-red)' }}>
                          Void
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
    </div>
  );
}

// ============================================================
// CONTRACT BUILDER
// ============================================================

function ContractBuilder({ contract, fromEstimateId, leadId: initialLeadId, onSave, onCancel }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sections, setSections] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [leadId, setLeadId] = useState(initialLeadId || '');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState([]);
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const [estimateData, setEstimateData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Load templates
  useEffect(() => {
    contractsApi.getContractTemplates()
      .then(res => {
        const tpls = res.data.templates || res.data || [];
        setTemplates(tpls);
        // Auto-select first template if none selected
        if (tpls.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(tpls[0].id);
          setSections(parseSections(tpls[0].content));
        }
      })
      .catch(() => {});
  }, []);

  // Load from estimate if param provided
  useEffect(() => {
    if (!fromEstimateId) return;
    client.get(`/estimates/${fromEstimateId}`)
      .then(res => {
        const est = res.data;
        setEstimateData(est);
        setCustomerName(est.customer_name || est.lead_name || '');
        setCustomerEmail(est.customer_email || '');
        setCustomerPhone(est.customer_phone || '');
        setCustomerAddress(est.customer_address || est.lead_address || '');
        if (est.lead_id) setLeadId(est.lead_id);
      })
      .catch(() => {});
  }, [fromEstimateId]);

  // Load lead details if leadId provided
  useEffect(() => {
    if (!initialLeadId || fromEstimateId) return;
    client.get(`/crm/leads/${initialLeadId}`)
      .then(res => {
        const lead = res.data;
        setCustomerName(lead.owner_name || lead.first_name || '');
        setCustomerEmail(lead.email || '');
        setCustomerPhone(lead.phone || '');
        setCustomerAddress(lead.address || '');
      })
      .catch(() => {});
  }, [initialLeadId, fromEstimateId]);

  // If editing existing contract, populate fields
  useEffect(() => {
    if (!contract) return;
    setCustomerName(contract.customer_name || '');
    setCustomerEmail(contract.customer_email || '');
    setCustomerPhone(contract.customer_phone || '');
    setCustomerAddress(contract.customer_address || '');
    if (contract.lead_id) setLeadId(contract.lead_id);
    if (contract.template_id) setSelectedTemplateId(contract.template_id);
    if (contract.content) {
      setSections(parseSections(contract.content));
    }
  }, [contract]);

  // When template changes, load its sections
  useEffect(() => {
    if (!selectedTemplateId || contract) return; // Don't override if editing
    const tpl = templates.find(t => t.id === selectedTemplateId);
    if (tpl) {
      setSections(parseSections(tpl.content));
    }
  }, [selectedTemplateId, templates]);

  function parseSections(content) {
    if (!content) return [{ title: 'Agreement', body: '' }];
    if (Array.isArray(content)) return content;
    if (typeof content === 'object' && content.sections) return content.sections;
    return [{ title: 'Agreement', body: typeof content === 'string' ? content : '' }];
  }

  // Lead search
  useEffect(() => {
    if (!leadSearch || leadSearch.length < 2) {
      setLeadResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await getLeads({ search: leadSearch, limit: 5 });
        setLeadResults(res.data.leads || res.data || []);
        setShowLeadDropdown(true);
      } catch {
        setLeadResults([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [leadSearch]);

  const selectLead = (lead) => {
    setLeadId(lead.id);
    setCustomerName(lead.owner_name || lead.first_name || '');
    setCustomerEmail(lead.email || '');
    setCustomerPhone(lead.phone || '');
    setCustomerAddress(lead.address || '');
    setLeadSearch('');
    setShowLeadDropdown(false);
  };

  const mergeData = useMemo(() => ({
    customerName,
    customerEmail,
    customerPhone,
    customerAddress,
    companyName: '',
    estimateTotal: estimateData ? `$${Number(estimateData.total || 0).toLocaleString()}` : '',
    estimateNumber: estimateData?.estimate_number || '',
  }), [customerName, customerEmail, customerPhone, customerAddress, estimateData]);

  const updateSection = (idx, field, value) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const addSection = () => {
    setSections(prev => [...prev, { title: 'New Section', body: '' }]);
  };

  const removeSection = (idx) => {
    setSections(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (andSend = false) => {
    setSaving(true);
    try {
      const payload = {
        template_id: selectedTemplateId || undefined,
        lead_id: leadId || undefined,
        estimate_id: fromEstimateId || undefined,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        content: { sections },
      };

      let contractId;
      if (contract?.id) {
        await contractsApi.updateContract(contract.id, payload);
        contractId = contract.id;
      } else {
        const res = await contractsApi.createContract(payload);
        contractId = res.data.id;
      }

      if (andSend && contractId) {
        await contractsApi.sendContract(contractId);
        showToast('Contract sent', 'success');
      } else {
        showToast('Contract saved', 'success');
      }
      onSave();
    } catch {
      showToast('Failed to save contract', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <button onClick={onCancel} className="quick-action-btn" style={{ padding: '8px 12px' }}>
          <IconArrowLeft style={{ width: 16, height: 16 }} />
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{contract ? 'Edit Contract' : 'New Contract'}</h2>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowPreview(!showPreview)} className="quick-action-btn" style={{ padding: '8px 14px', fontSize: 12 }}>
          <IconEye style={{ width: 14, height: 14 }} /> {showPreview ? 'Editor' : 'Preview'}
        </button>
        <button onClick={() => handleSave(false)} disabled={saving} className="quick-action-btn" style={{ padding: '8px 14px', fontSize: 12 }}>
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button onClick={() => handleSave(true)} disabled={saving || !customerEmail} className="auth-btn" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <IconSend style={{ width: 14, height: 14 }} /> Send Contract
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr', gap: 'var(--space-lg)' }}>
        {/* Editor Side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {/* Template selector */}
          <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 'var(--space-md)' }}>Template</div>
            <CustomSelect
              value={selectedTemplateId}
              onChange={(v) => setSelectedTemplateId(v)}
              placeholder="Select Template"
              options={templates.map(t => ({ value: t.id, label: t.name || t.template_type || 'Untitled' }))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Lead selector */}
          <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 'var(--space-md)' }}>Customer Details</div>
            <div style={{ position: 'relative', marginBottom: 'var(--space-md)' }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Search Lead (optional)</label>
              <input
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                placeholder="Search by name or address..."
                className="form-input"
                style={{ width: '100%' }}
              />
              {showLeadDropdown && leadResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: 'oklch(0.18 0.02 260)', border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-md)', maxHeight: 200, overflowY: 'auto',
                }}>
                  {leadResults.map(lead => (
                    <div key={lead.id} onClick={() => selectLead(lead)}
                      style={{
                        padding: 'var(--space-sm) var(--space-md)', cursor: 'pointer',
                        fontSize: 13, borderBottom: '1px solid var(--glass-border)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'oklch(0.22 0.02 260)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 600 }}>{lead.owner_name || lead.first_name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.address || ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Name</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="form-input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Email</label>
                <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="form-input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Phone</label>
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="form-input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Address</label>
                <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="form-input" style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          {/* Sections Editor */}
          <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Contract Sections</div>
              <button onClick={addSection} className="quick-action-btn" style={{ fontSize: 11, padding: '4px 10px' }}>+ Add Section</button>
            </div>
            {sections.map((section, idx) => (
              <div key={idx} style={{
                padding: 'var(--space-md)', marginBottom: 'var(--space-sm)',
                border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)',
                background: 'oklch(0.14 0.02 260 / 0.4)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                  <input
                    value={section.title}
                    onChange={e => updateSection(idx, 'title', e.target.value)}
                    className="form-input"
                    style={{ flex: 1, fontWeight: 700, fontSize: 13 }}
                    placeholder="Section title"
                  />
                  {sections.length > 1 && (
                    <button onClick={() => removeSection(idx)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                      color: 'var(--accent-red)', opacity: 0.7,
                    }}>
                      <IconTrash style={{ width: 14, height: 14 }} />
                    </button>
                  )}
                </div>
                <textarea
                  value={section.body}
                  onChange={e => updateSection(idx, 'body', e.target.value)}
                  rows={5}
                  className="form-input"
                  style={{ width: '100%', resize: 'vertical', fontSize: 12, lineHeight: 1.6 }}
                  placeholder="Section content... Use {{customer_name}}, {{customer_email}}, {{customer_address}}, {{date}}, {{estimate_total}}, {{estimate_number}} as merge fields."
                />
              </div>
            ))}
          </div>
        </div>

        {/* Preview Side */}
        {showPreview && (
          <div className="glass" style={{
            borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)',
            maxHeight: 'calc(100vh - 200px)', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 'var(--space-lg)', color: 'var(--accent-blue)' }}>
              Preview
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            {customerName && (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ fontWeight: 700 }}>{customerName}</div>
                {customerAddress && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{customerAddress}</div>}
                {customerEmail && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{customerEmail}</div>}
              </div>
            )}
            {sections.map((section, idx) => (
              <div key={idx} style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                  {resolveMergeFields(section.title, mergeData)}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                  {resolveMergeFields(section.body, mergeData)}
                </div>
              </div>
            ))}
            <div style={{
              marginTop: 'var(--space-xl)', paddingTop: 'var(--space-lg)',
              borderTop: '1px solid var(--glass-border)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Signature</div>
              <div style={{
                marginTop: 'var(--space-sm)', height: 60,
                border: '1px dashed var(--glass-border)', borderRadius: 'var(--radius-sm)',
              }} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {customerName || 'Customer Signature'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
