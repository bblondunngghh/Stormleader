import { useState, useEffect, useCallback } from 'react';
import * as estimatesApi from '../api/estimates';
import { IconX, IconFileText, IconDollar, IconSend, IconClipboard } from './Icons';

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
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [editingEstimate, setEditingEstimate] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);

  const fetchEstimates = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await estimatesApi.getEstimates(params);
      setEstimates(res.data.estimates || []);
      setTotal(res.data.total || 0);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchEstimates(); }, [fetchEstimates]);

  const totalValue = estimates.reduce((s, e) => s + Number(e.total || 0), 0);
  const sentCount = estimates.filter(e => e.status === 'sent' || e.status === 'viewed').length;
  const acceptedCount = estimates.filter(e => e.status === 'accepted').length;
  const acceptedValue = estimates.filter(e => e.status === 'accepted').reduce((s, e) => s + Number(e.total || 0), 0);

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

  if (showBuilder) {
    return <EstimateBuilder estimate={editingEstimate} onSave={handleSaved} onCancel={() => setShowBuilder(false)} />;
  }

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)' }}>
      {/* KPIs */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { icon: '📄', value: total, label: 'Total Estimates', color: '330' },
          { icon: '📬', value: sentCount, label: 'Awaiting Response', color: '250' },
          { icon: '✅', value: acceptedCount, label: 'Accepted', color: '155' },
          { icon: '💰', value: `$${(acceptedValue / 1000).toFixed(1)}K`, label: 'Revenue Accepted', color: '155' },
        ].map(s => (
          <div key={s.label} className="stat-card glass">
            <div style={{ fontSize: 18 }}>{s.icon}</div>
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + New */}
      <div className="glass" style={{
        borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg) var(--space-xl)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-lg)',
      }}>
        <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ minWidth: 160 }}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="viewed">Viewed</option>
          <option value="accepted">Accepted</option>
          <option value="declined">Declined</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{total} estimate{total !== 1 ? 's' : ''}</span>
        <button className="auth-btn" onClick={handleNew} style={{ padding: '8px 20px', fontSize: 13 }}>+ New Estimate</button>
      </div>

      {/* Table */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
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
                <th>Actions</th>
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
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                      background: `color-mix(in oklch, ${statusColors[est.status]} 15%, transparent)`,
                      color: statusColors[est.status], textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{est.status}</span>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>${Number(est.total).toLocaleString()}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(est.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {est.valid_until ? new Date(est.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                      <button className="quick-action-btn" onClick={() => handleEdit(est)} style={{ padding: '4px 10px', fontSize: 11 }}>
                        Edit
                      </button>
                      {est.status === 'draft' && (
                        <button className="quick-action-btn" onClick={() => handleSend(est)} style={{ padding: '4px 10px', fontSize: 11, color: 'var(--accent-blue)' }}>
                          Send
                        </button>
                      )}
                      <button className="quick-action-btn" onClick={() => handleDuplicate(est)} style={{ padding: '4px 10px', fontSize: 11 }}>
                        Copy
                      </button>
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
// ESTIMATE BUILDER — Split-screen editor + live preview
// ============================================================

function EstimateBuilder({ estimate, onSave, onCancel }) {
  const [form, setForm] = useState({
    customer_name: '',
    customer_address: '',
    customer_phone: '',
    customer_email: '',
    line_items: [],
    tax_rate: 0,
    discount_type: 'flat',
    discount_value: 0,
    scope_of_work: '',
    terms: 'Payment due upon completion. All work guaranteed per manufacturer warranty specifications.',
    warranty_info: '',
    notes: '',
    valid_until: '',
  });
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);

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
        line_items: estimate.line_items || [],
        tax_rate: Number(estimate.tax_rate) || 0,
        discount_type: estimate.discount_type || 'flat',
        discount_value: Number(estimate.discount_value) || 0,
        scope_of_work: estimate.scope_of_work || '',
        terms: estimate.terms || '',
        warranty_info: estimate.warranty_info || '',
        notes: estimate.notes || '',
        valid_until: estimate.valid_until ? estimate.valid_until.split('T')[0] : '',
      });
    }
  }, [estimate]);

  const updateField = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const addLineItem = (template) => {
    const item = template
      ? { description: template.name, quantity: 1, unit: template.unit, unit_price: Number(template.default_unit_price) || 0, section: template.section }
      : { description: '', quantity: 1, unit: 'each', unit_price: 0, section: 'Roof' };
    setForm(f => ({ ...f, line_items: [...f.line_items, item] }));
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

  // Calculate totals
  const subtotal = form.line_items.reduce((s, item) => s + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0);
  const discount = form.discount_type === 'percent' ? subtotal * (Number(form.discount_value) || 0) / 100 : Number(form.discount_value) || 0;
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = taxable * (Number(form.tax_rate) || 0);
  const total = taxable + taxAmount;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (estimate) {
        await estimatesApi.updateEstimate(estimate.id, form);
      } else {
        await estimatesApi.createEstimate(form);
      }
      onSave();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  // Group line items by section
  const sections = {};
  form.line_items.forEach((item, idx) => {
    const sec = item.section || 'Other';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push({ ...item, _idx: idx });
  });

  return (
    <div className="main-content" style={{ gap: 0, padding: 0, overflow: 'hidden', height: 'calc(100vh - 64px)' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--space-md) var(--space-xl)',
        borderBottom: '1px solid var(--glass-border)',
        background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <button className="quick-action-btn" onClick={onCancel} style={{ padding: '6px 14px', fontSize: 12 }}>
            <IconX style={{ width: 12, height: 12 }} /> Back
          </button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {estimate ? `Edit ${estimate.estimate_number}` : 'New Estimate'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="quick-action-btn" onClick={handleSave} disabled={saving} style={{ padding: '6px 18px', fontSize: 12 }}>
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
        </div>
      </div>

      {/* Split view */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Editor (60%) */}
        <div style={{ flex: '0 0 60%', overflowY: 'auto', padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          {/* Customer Info */}
          <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 'var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Customer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label>Name</label>
                <input className="form-input" value={form.customer_name} onChange={e => updateField('customer_name', e.target.value)} placeholder="Customer name" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="form-input" value={form.customer_phone} onChange={e => updateField('customer_phone', e.target.value)} placeholder="(512) 555-0000" />
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

          {/* Line Items */}
          <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Line Items</div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <select
                  className="form-input"
                  value=""
                  onChange={(e) => {
                    const tmpl = templates.find(t => t.id === e.target.value);
                    if (tmpl) addLineItem(tmpl);
                  }}
                  style={{ fontSize: 12, padding: '4px 10px', minWidth: 140 }}
                >
                  <option value="">+ From preset...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button className="quick-action-btn" onClick={() => addLineItem(null)} style={{ padding: '4px 12px', fontSize: 12 }}>
                  + Blank Row
                </button>
              </div>
            </div>

            {form.line_items.length === 0 ? (
              <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Add line items using presets or blank rows
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 90px 80px 30px', gap: 'var(--space-sm)', padding: '0 var(--space-sm)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                  <span>Description</span><span>Qty</span><span>Unit</span><span>Unit Price</span><span>Total</span><span></span>
                </div>
                {form.line_items.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'grid', gridTemplateColumns: '1fr 70px 70px 90px 80px 30px', gap: 'var(--space-sm)',
                    alignItems: 'center', padding: 'var(--space-sm)',
                    background: 'oklch(0.16 0.02 260 / 0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)',
                  }}>
                    <input className="form-input" value={item.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }} />
                    <input className="form-input" type="number" min="0" step="1" value={item.quantity} onChange={e => updateLineItem(idx, 'quantity', e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }} />
                    <input className="form-input" value={item.unit} onChange={e => updateLineItem(idx, 'unit', e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }} />
                    <input className="form-input" type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateLineItem(idx, 'unit_price', e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)', textAlign: 'right' }}>
                      ${((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toLocaleString()}
                    </span>
                    <button onClick={() => removeLineItem(idx)} style={{ color: 'var(--accent-red)', fontSize: 14, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals + Discount + Tax */}
          <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label>Tax Rate</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.tax_rate} onChange={e => updateField('tax_rate', e.target.value)} placeholder="0.0825" />
              </div>
              <div className="form-group">
                <label>Discount Type</label>
                <select className="form-input" value={form.discount_type} onChange={e => updateField('discount_type', e.target.value)}>
                  <option value="flat">Flat ($)</option>
                  <option value="percent">Percent (%)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Discount</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.discount_value} onChange={e => updateField('discount_value', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Scope, Terms, Notes */}
          <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' }}>
            <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label>Scope of Work</label>
              <textarea className="form-input" rows={3} value={form.scope_of_work} onChange={e => updateField('scope_of_work', e.target.value)} placeholder="Describe the work to be performed..." style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label>Terms & Conditions</label>
              <textarea className="form-input" rows={2} value={form.terms} onChange={e => updateField('terms', e.target.value)} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label>Warranty</label>
              <input className="form-input" value={form.warranty_info} onChange={e => updateField('warranty_info', e.target.value)} placeholder="Manufacturer warranty details..." />
            </div>
            <div className="form-group">
              <label>Valid Until</label>
              <input className="form-input" type="date" value={form.valid_until} onChange={e => updateField('valid_until', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Right: Live Preview (40%) */}
        <div style={{
          flex: '0 0 40%', overflowY: 'auto', padding: 'var(--space-xl)',
          borderLeft: '1px solid var(--glass-border)',
          background: 'oklch(0.96 0.005 260)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'oklch(0.5 0 0)', textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
            Customer Preview
          </div>

          <div style={{
            background: '#fff', borderRadius: 8, padding: 32,
            color: '#1a1a1a', fontSize: 13, lineHeight: 1.6,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}>
            {/* Company header */}
            <div style={{ borderBottom: '2px solid #2563eb', paddingBottom: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb' }}>StormLeads Roofing</div>
              <div style={{ fontSize: 11, color: '#666' }}>Professional Roofing Services</div>
            </div>

            {/* Estimate number + date */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>ESTIMATE</div>
                <div style={{ fontSize: 11, color: '#666' }}>{estimate?.estimate_number || 'EST-XXX'}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#666' }}>
                <div>Date: {new Date().toLocaleDateString()}</div>
                {form.valid_until && <div>Valid until: {new Date(form.valid_until).toLocaleDateString()}</div>}
              </div>
            </div>

            {/* Customer */}
            {form.customer_name && (
              <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f8fafc', borderRadius: 6 }}>
                <div style={{ fontWeight: 700 }}>{form.customer_name}</div>
                {form.customer_address && <div style={{ fontSize: 12, color: '#666' }}>{form.customer_address}</div>}
                {form.customer_phone && <div style={{ fontSize: 12, color: '#666' }}>{form.customer_phone}</div>}
              </div>
            )}

            {/* Line items */}
            {form.line_items.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: '#666' }}>Item</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: '#666' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: '#666' }}>Price</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: '#666' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {form.line_items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 4px' }}>{item.description || '—'}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>{item.quantity} {item.unit}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right' }}>${Number(item.unit_price).toFixed(2)}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>
                        ${((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Totals */}
            <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 24 }}><span style={{ color: '#666' }}>Subtotal:</span> <span style={{ fontWeight: 600 }}>${subtotal.toFixed(2)}</span></div>
              {discount > 0 && <div style={{ display: 'flex', gap: 24 }}><span style={{ color: '#666' }}>Discount:</span> <span style={{ color: '#dc2626' }}>-${discount.toFixed(2)}</span></div>}
              {taxAmount > 0 && <div style={{ display: 'flex', gap: 24 }}><span style={{ color: '#666' }}>Tax:</span> <span>${taxAmount.toFixed(2)}</span></div>}
              <div style={{ display: 'flex', gap: 24, fontSize: 18, fontWeight: 800, marginTop: 4, color: '#2563eb' }}>
                <span>Total:</span> <span>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Scope */}
            {form.scope_of_work && (
              <div style={{ marginTop: 16, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', color: '#666' }}>Scope of Work</div>
                {form.scope_of_work}
              </div>
            )}

            {/* Terms */}
            {form.terms && (
              <div style={{ marginTop: 12, fontSize: 10, color: '#999', lineHeight: 1.5 }}>
                <strong>Terms:</strong> {form.terms}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
