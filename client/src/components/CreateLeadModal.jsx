import { useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { createQuickLead } from '../api/crm';
import { showToast } from './Toast';
import CustomSelect from './CustomSelect';

const priorityOptions = [
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
];

const sourceOptions = [
  { value: 'manual', label: 'Manual' },
  { value: 'referral', label: 'Referral' },
  { value: 'door_knock', label: 'Door Knock' },
  { value: 'phone', label: 'Phone' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
];

const stageOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'appt_set', label: 'Appt Set' },
  { value: 'inspected', label: 'Inspected' },
  { value: 'estimate_sent', label: 'Estimate Sent' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'sold', label: 'Sold' },
];

// Use CSS class for consistent styling with focus glow and transitions
const fieldStyle = undefined; // replaced by className="form-input"

export default function CreateLeadModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    contact_name: '', contact_phone: '', contact_email: '',
    address: '', city: '', state: '', zip: '',
    stage: 'new', priority: 'warm', source: 'manual',
    estimated_value: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target ? e.target.value : e }));

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    let formatted = digits;
    if (digits.length > 6) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    else if (digits.length > 3) formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    setForm(prev => ({ ...prev, contact_phone: formatted }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.contact_name && !form.address) {
      showToast('Name or address is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.estimated_value) payload.estimated_value = parseFloat(payload.estimated_value);
      else delete payload.estimated_value;
      await createQuickLead(payload);
      showToast('Lead created', 'success');
      onCreated();
      onClose();
    } catch {
      showToast('Failed to create lead', 'error');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'oklch(0 0 0 / 0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div className="glass" onClick={e => e.stopPropagation()} style={{
        width: 440, overflow: 'visible',
        borderRadius: '20px / 18px',
        boxShadow: '0 8px 32px oklch(0 0 0 / 0.4), inset 0 1px 0 oklch(1 0 0 / 0.05)',
        padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Add Lead</h2>
          <button onClick={onClose} aria-label="Close" className="modal-close"><XMarkIcon width={18} height={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Contact Name</label>
              <input className="form-input" value={form.contact_name} onChange={set('contact_name')} placeholder="John Doe" />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input className="form-input" value={form.contact_phone} onChange={handlePhoneChange} placeholder="555-123-4567" />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input className="form-input" value={form.contact_email} onChange={set('contact_email')} placeholder="john@example.com" />
          </div>

          <div>
            <label style={labelStyle}>Address</label>
            <input className="form-input" value={form.address} onChange={set('address')} placeholder="123 Main St" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>City</label>
              <input className="form-input" value={form.city} onChange={set('city')} placeholder="Austin" />
            </div>
            <div>
              <label style={labelStyle}>State</label>
              <input className="form-input" value={form.state} onChange={set('state')} placeholder="TX" maxLength={2} />
            </div>
            <div>
              <label style={labelStyle}>Zip</label>
              <input className="form-input" value={form.zip} onChange={set('zip')} placeholder="78701" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Stage</label>
              <CustomSelect value={form.stage} onChange={set('stage')} options={stageOptions} />
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <CustomSelect value={form.priority} onChange={set('priority')} options={priorityOptions} />
            </div>
            <div>
              <label style={labelStyle}>Source</label>
              <CustomSelect value={form.source} onChange={set('source')} options={sourceOptions} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Estimated Value ($)</label>
            <input className="form-input" type="number" value={form.estimated_value} onChange={set('estimated_value')} placeholder="15000" />
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600,
              borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
              background: 'var(--accent-blue)', color: 'oklch(0.15 0.02 250)',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Creating...' : 'Create Lead'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

const labelStyle = {
  display: 'block', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'oklch(0.55 0.02 260)', marginBottom: 4,
};
