import { useState, useEffect, useCallback } from 'react';
import * as invoicesApi from '../api/invoices';
import * as estimatesApi from '../api/estimates';
import client from '../api/client';
import { IconX, IconFileText, IconDollar, IconSend, IconPlusCircle, IconArrowLeft, IconTrash, IconCheck } from './Icons';
import CustomSelect from './CustomSelect';
import DatePicker from './DatePicker';
import { showToast } from './Toast';
import { BanknotesIcon, DocumentCheckIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const statusColors = {
  draft: 'oklch(0.6 0 0)',
  sent: 'oklch(0.7 0.15 220)',
  viewed: 'oklch(0.7 0.12 280)',
  paid: 'oklch(0.75 0.18 145)',
  overdue: 'oklch(0.65 0.2 25)',
  void: 'oklch(0.5 0 0)',
};

const statusLabels = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

// ============================================================
// INVOICES VIEW — List + Inline Builder
// ============================================================

export default function InvoicesView() {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showEstimatePicker, setShowEstimatePicker] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await invoicesApi.getInvoices(params);
      setInvoices(res.data.invoices || []);
      setTotal(res.data.total || 0);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768); useEffect(() => { const mq = window.matchMedia('(max-width: 768px)'); const h = (e) => setIsMobile(e.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, []);

  const totalValue = invoices.reduce((s, inv) => s + Number(inv.total || 0), 0);
  const paidValue = invoices.filter(i => i.status === 'paid').reduce((s, inv) => s + Number(inv.total || 0), 0);
  const outstandingValue = invoices.filter(i => ['sent', 'viewed', 'overdue'].includes(i.status)).reduce((s, inv) => s + Number(inv.total || 0) - Number(inv.amount_paid || 0), 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  const handleNew = () => {
    setEditingInvoice(null);
    setShowBuilder(true);
  };

  const handleEdit = (inv) => {
    setEditingInvoice(inv);
    setShowBuilder(true);
  };

  const handleSaved = () => {
    setShowBuilder(false);
    setEditingInvoice(null);
    fetchInvoices();
  };

  const handleCreateFromEstimate = async (estimateId) => {
    try {
      await invoicesApi.createInvoiceFromEstimate(estimateId);
      showToast('Invoice created from estimate', 'success');
      setShowEstimatePicker(false);
      fetchInvoices();
    } catch {
      showToast('Failed to create invoice from estimate', 'error');
    }
  };

  if (showBuilder) {
    return <InvoiceBuilder invoice={editingInvoice} onSave={handleSaved} onCancel={() => setShowBuilder(false)} />;
  }

  if (showEstimatePicker) {
    return <EstimatePicker onSelect={handleCreateFromEstimate} onCancel={() => setShowEstimatePicker(false)} />;
  }

  const formatValue = (v) => {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
    return `$${v.toFixed(0)}`;
  };

  const filterTabs = [
    { key: '', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'paid', label: 'Paid' },
    { key: 'overdue', label: 'Overdue' },
  ];

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)' }}>
      {/* KPIs */}
      <div className="stats-grid" style={{ gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)' }}>
        {[
          { Icon: BanknotesIcon, value: formatValue(totalValue), label: 'Total Invoiced', color: '330' },
          { Icon: CheckCircleIcon, value: formatValue(paidValue), label: 'Collected', color: '145' },
          { Icon: ClockIcon, value: formatValue(outstandingValue), label: 'Outstanding', color: '220' },
          { Icon: DocumentCheckIcon, value: overdueCount, label: 'Overdue', color: '25' },
        ].map(s => (
          <div key={s.label} className="stat-card glass" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <s.Icon width={28} height={28} />
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + Actions */}
      <div className="glass" style={{
        borderRadius: '20px / 18px', padding: 'var(--space-lg) var(--space-xl)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-lg)',
        overflow: 'visible', position: 'relative', zIndex: 20,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}>
        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 12,
                fontWeight: 600,
                border: statusFilter === tab.key ? '1px solid oklch(0.7 0.15 220 / 0.4)' : '1px solid transparent',
                background: statusFilter === tab.key ? 'oklch(0.7 0.15 220 / 0.12)' : 'transparent',
                color: statusFilter === tab.key ? 'oklch(0.8 0.12 220)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{total} invoice{total !== 1 ? 's' : ''}</span>
        <button className="auth-btn" onClick={() => setShowEstimatePicker(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', background: 'oklch(0.3 0.02 260)', border: '1px solid oklch(0.4 0.04 260)' }}>
          <IconFileText style={{ width: 14, height: 14 }} /> From Estimate
        </button>
        <button className="auth-btn" onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
          <IconPlusCircle style={{ width: 14, height: 14 }} /> New Invoice
        </button>
      </div>

      {/* Table */}
      <div className="glass" style={{ borderRadius: '20px / 18px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="lead-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Due Date</th>
                <th>Created</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && invoices.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '64px 24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <IconFileText width={40} height={40} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                    <div style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>No invoices yet</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 320 }}>
                      Create your first invoice to start tracking payments.
                    </div>
                    <button className="auth-btn" onClick={handleNew} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IconPlusCircle style={{ width: 14, height: 14 }} /> New Invoice
                    </button>
                  </div>
                </td></tr>
              ) : invoices.map(inv => {
                const balance = Number(inv.total || 0) - Number(inv.amount_paid || 0);
                return (
                  <tr key={inv.id} onClick={() => handleEdit(inv)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{inv.invoice_number}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inv.contact_name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.lead_address || ''}</div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                        background: `color-mix(in oklch, ${statusColors[inv.status]} 15%, transparent)`,
                        color: statusColors[inv.status], textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>{statusLabels[inv.status] || inv.status}</span>
                    </td>
                    <td style={{ fontWeight: 700 }}>${Number(inv.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td style={{ color: 'oklch(0.75 0.18 145)' }}>${Number(inv.amount_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td style={{ fontWeight: 700, color: balance > 0 ? 'oklch(0.65 0.2 25)' : 'oklch(0.75 0.18 145)' }}>
                      ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-xs)', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                        <button className="quick-action-btn" onClick={() => handleEdit(inv)} style={{ padding: '8px 14px', fontSize: 11 }}>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ESTIMATE PICKER — Select an estimate to convert
// ============================================================

function EstimatePicker({ onSelect, onCancel }) {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await estimatesApi.getEstimates({ limit: 100, status: 'accepted' });
        setEstimates(res.data.estimates || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)' }}>
      <div className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
          <button onClick={onCancel} className="quick-action-btn" style={{ padding: '8px 12px' }}>
            <IconArrowLeft style={{ width: 16, height: 16 }} />
          </button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Create Invoice from Estimate</h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 'var(--space-lg)' }}>
          Select an accepted estimate to convert into an invoice. Line items, totals, and lead info will be copied.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>Loading estimates...</div>
        ) : estimates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>
            No accepted estimates found. Accept an estimate first, then convert it to an invoice.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {estimates.map(est => (
              <button
                key={est.id}
                onClick={() => onSelect(est.id)}
                className="quick-action-btn"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--space-md) var(--space-lg)',
                  width: '100%', textAlign: 'left',
                  background: 'oklch(0.2 0.02 260 / 0.5)',
                  border: '1px solid oklch(0.3 0.03 260)',
                  borderRadius: 12,
                  transition: 'all 0.2s',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', marginBottom: 4 }}>{est.estimate_number}</div>
                  <div style={{ fontSize: 13 }}>{est.customer_name || est.lead_name || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{est.customer_address || est.lead_address || ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'oklch(0.75 0.18 145)', fontSize: 16 }}>
                    ${Number(est.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(est.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// INVOICE BUILDER — Create / Edit inline
// ============================================================

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

function InvoiceBuilder({ invoice, onSave, onCancel }) {
  const isEdit = !!invoice;

  const [lineItems, setLineItems] = useState(
    invoice?.line_items?.length ? invoice.line_items : [{ description: '', quantity: 1, unit_price: 0 }]
  );
  const [taxRate, setTaxRate] = useState(invoice ? parseFloat(invoice.tax_rate) || 0 : 0);
  const [dueDate, setDueDate] = useState(invoice?.due_date ? invoice.due_date.slice(0, 10) : '');
  const [notes, setNotes] = useState(invoice?.notes || '');
  const [leadId, setLeadId] = useState(invoice?.lead_id || '');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState([]);
  const [leadName, setLeadName] = useState(invoice?.contact_name || '');
  const [saving, setSaving] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0);
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Lead search
  useEffect(() => {
    if (leadSearch.length < 2) { setLeadResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await client.get('/search', { params: { q: leadSearch, limit: 8 } });
        setLeadResults(res.data.leads || []);
      } catch {
        setLeadResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [leadSearch]);

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index, field, value) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        lead_id: leadId || null,
        line_items: lineItems,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_rate: taxRate,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        due_date: dueDate || null,
        notes: notes || null,
      };

      if (isEdit) {
        await invoicesApi.updateInvoice(invoice.id, data);
        showToast('Invoice updated', 'success');
      } else {
        await invoicesApi.createInvoice(data);
        showToast('Invoice created', 'success');
      }
      onSave();
    } catch {
      showToast('Failed to save invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    try {
      await invoicesApi.sendInvoice(invoice.id);
      showToast('Invoice marked as sent', 'success');
      onSave();
    } catch {
      showToast('Failed to send invoice', 'error');
    }
  };

  const handleVoid = async () => {
    try {
      await invoicesApi.updateInvoice(invoice.id, { status: 'void' });
      showToast('Invoice voided', 'success');
      onSave();
    } catch {
      showToast('Failed to void invoice', 'error');
    }
  };

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <button onClick={onCancel} className="quick-action-btn" style={{ padding: '8px 12px' }}>
          <IconArrowLeft style={{ width: 16, height: 16 }} />
        </button>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          {isEdit ? `Invoice ${invoice.invoice_number}` : 'New Invoice'}
        </h2>
        {isEdit && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)',
            background: `color-mix(in oklch, ${statusColors[invoice.status]} 15%, transparent)`,
            color: statusColors[invoice.status], textTransform: 'uppercase', letterSpacing: '0.06em',
            marginLeft: 8,
          }}>{statusLabels[invoice.status]}</span>
        )}
        <div style={{ flex: 1 }} />
        {isEdit && invoice.status === 'draft' && (
          <button className="auth-btn" onClick={handleSend} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'oklch(0.35 0.12 220)', border: 'none' }}>
            <IconSend style={{ width: 14, height: 14 }} /> Mark Sent
          </button>
        )}
        {isEdit && ['sent', 'viewed', 'overdue'].includes(invoice.status) && (
          <button className="auth-btn" onClick={() => setShowPaymentModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'oklch(0.35 0.15 145)', border: 'none' }}>
            <IconDollar style={{ width: 14, height: 14 }} /> Record Payment
          </button>
        )}
        {isEdit && invoice.status !== 'void' && invoice.status !== 'paid' && (
          <button className="quick-action-btn" onClick={handleVoid} style={{ padding: '8px 14px', fontSize: 11, color: 'oklch(0.65 0.2 25)' }}>
            Void
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-lg)' }}>
        {/* Lead Selector */}
        <div className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-lg) var(--space-xl)' }}>
          <h3 style={{ margin: '0 0 var(--space-md)', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Customer</h3>
          {leadId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <span style={{ fontWeight: 600 }}>{leadName}</span>
              <button onClick={() => { setLeadId(''); setLeadName(''); }} className="quick-action-btn" style={{ padding: '4px 10px', fontSize: 11 }}>
                Change
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
                placeholder="Search leads by name or address..."
                className="form-input"
              />
              {leadResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(0.3 0.03 260)',
                  borderRadius: 10, marginTop: 4, maxHeight: 240, overflowY: 'auto',
                }}>
                  {leadResults.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => {
                        setLeadId(lead.id);
                        setLeadName(lead.contact_name || lead.address || 'Lead');
                        setLeadSearch('');
                        setLeadResults([]);
                      }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                        background: 'transparent', border: 'none', color: 'var(--text-primary)',
                        cursor: 'pointer', fontSize: 13, borderBottom: '1px solid oklch(0.25 0.02 260)',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{lead.contact_name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.address || ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-lg) var(--space-xl)' }}>
          <h3 style={{ margin: '0 0 var(--space-md)', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Line Items</h3>

          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 40px', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Description</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Qty</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Unit Price</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total</span>
            <span />
          </div>

          {lineItems.map((item, idx) => {
            const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
            return (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 40px', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)', alignItems: 'center' }}>
                <input
                  type="text"
                  value={item.description}
                  onChange={e => updateLineItem(idx, 'description', e.target.value)}
                  placeholder="Item description"
                  className="form-input"
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={e => updateLineItem(idx, 'quantity', e.target.value)}
                  min="0"
                  step="1"
                  className="form-input" style={{ textAlign: 'center' }}
                />
                <input
                  type="number"
                  value={item.unit_price}
                  onChange={e => updateLineItem(idx, 'unit_price', e.target.value)}
                  min="0"
                  step="0.01"
                  className="form-input" style={{ textAlign: 'right' }}
                />
                <div style={{ fontWeight: 600, textAlign: 'right', fontSize: 13, padding: '8px 0' }}>
                  ${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <button onClick={() => removeLineItem(idx)} className="quick-action-btn" style={{ padding: 6, color: 'oklch(0.65 0.2 25)' }}>
                  <IconTrash style={{ width: 14, height: 14 }} />
                </button>
              </div>
            );
          })}

          <button onClick={addLineItem} className="quick-action-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12, marginTop: 'var(--space-sm)' }}>
            <IconPlusCircle style={{ width: 14, height: 14 }} /> Add Line Item
          </button>
        </div>

        {/* Totals + Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
          {/* Details */}
          <div className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-lg) var(--space-xl)' }}>
            <h3 style={{ margin: '0 0 var(--space-md)', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Details</h3>

            <div style={{ marginBottom: 'var(--space-md)' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Tax Rate</label>
              <CustomSelect
                value={taxRate}
                onChange={(v) => setTaxRate(Number(v))}
                options={TAX_OPTIONS}
                placeholder="Select tax rate"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: 'var(--space-md)' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="form-input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={4}
                className="form-input" style={{ height: 'auto', minHeight: 100, resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Totals Summary */}
          <div className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-lg) var(--space-xl)' }}>
            <h3 style={{ margin: '0 0 var(--space-lg)', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Summary</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Tax ({(taxRate * 100).toFixed(2)}%)</span>
                <span style={{ fontWeight: 600 }}>${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ borderTop: '1px solid oklch(0.3 0.03 260)', paddingTop: 'var(--space-md)', display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontWeight: 700, color: 'oklch(0.75 0.18 145)' }}>${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              {isEdit && Number(invoice.amount_paid) > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Amount Paid</span>
                    <span style={{ fontWeight: 600, color: 'oklch(0.75 0.18 145)' }}>
                      ${Number(invoice.amount_paid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Balance Due</span>
                    <span style={{ fontWeight: 700, color: 'oklch(0.65 0.2 25)' }}>
                      ${(Number(invoice.total) - Number(invoice.amount_paid)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Save / Cancel */}
            <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
              <button onClick={onCancel} className="quick-action-btn" style={{ flex: 1, padding: '12px', fontSize: 13, fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="auth-btn" style={{ flex: 1, padding: '12px', fontSize: 13, fontWeight: 600 }}>
                {saving ? 'Saving...' : isEdit ? 'Update Invoice' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          invoice={invoice}
          onClose={() => setShowPaymentModal(false)}
          onRecorded={onSave}
        />
      )}
    </div>
  );
}

// ============================================================
// PAYMENT MODAL
// ============================================================

function PaymentModal({ invoice, onClose, onRecorded }) {
  const balance = Number(invoice.total) - Number(invoice.amount_paid || 0);
  const [amount, setAmount] = useState(balance > 0 ? balance.toFixed(2) : '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      showToast('Enter a valid payment amount', 'error');
      return;
    }
    setSaving(true);
    try {
      await invoicesApi.recordPayment(invoice.id, val);
      showToast('Payment recorded', 'success');
      onRecorded();
    } catch {
      showToast('Failed to record payment', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div className="glass" onClick={e => e.stopPropagation()} style={{
        borderRadius: 20, padding: 'var(--space-xl)', width: 400, maxWidth: '90vw',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Record Payment</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <IconX style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ marginBottom: 'var(--space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 'var(--space-sm)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Invoice Total</span>
            <span style={{ fontWeight: 600 }}>${Number(invoice.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 'var(--space-sm)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Already Paid</span>
            <span style={{ fontWeight: 600, color: 'oklch(0.75 0.18 145)' }}>${Number(invoice.amount_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid oklch(0.3 0.03 260)', paddingTop: 'var(--space-sm)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Balance Due</span>
            <span style={{ fontWeight: 700, color: 'oklch(0.65 0.2 25)' }}>${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Payment Amount</label>
          <input
            type="number"
            className="form-input"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min="0"
            step="0.01"
            autoFocus
            style={{ fontSize: 16, fontWeight: 700, height: 44 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <button onClick={onClose} className="quick-action-btn" style={{ flex: 1, padding: '12px', fontSize: 13, fontWeight: 600 }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving} className="auth-btn" style={{ flex: 1, padding: '12px', fontSize: 13, fontWeight: 600, background: 'oklch(0.35 0.15 145)', border: 'none' }}>
            {saving ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
