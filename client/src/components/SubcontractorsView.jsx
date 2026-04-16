import { useState, useEffect } from 'react';
import * as subApi from '../api/subcontractors';
import { showToast } from './Toast';
import CustomSelect from './CustomSelect';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

const SPECIALTIES = ['general', 'roofing', 'siding', 'gutters', 'painting', 'drywall', 'electrical', 'plumbing', 'hvac', 'landscaping', 'demolition', 'other'];
const SPECIALTY_OPTIONS = [{ value: '', label: 'All' }, ...SPECIALTIES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))];
const STATUS_OPTIONS = [{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }];
const PAGE_SIZE_OPTIONS = [10, 25, 50].map(n => ({ value: String(n), label: `${n} / page` }));

const specialtyColors = {
  general:     { bg: 'oklch(0.28 0.03 260 / 0.5)', color: 'var(--text-secondary)' },
  roofing:     { bg: 'oklch(0.50 0.15 250 / 0.15)', color: 'oklch(0.72 0.19 250)' },
  siding:      { bg: 'oklch(0.50 0.17 145 / 0.15)', color: 'oklch(0.75 0.18 155)' },
  gutters:     { bg: 'oklch(0.50 0.15 80 / 0.15)', color: 'oklch(0.78 0.17 85)' },
  painting:    { bg: 'oklch(0.50 0.16 310 / 0.15)', color: 'oklch(0.70 0.18 310)' },
  drywall:     { bg: 'oklch(0.50 0.14 55 / 0.15)', color: 'oklch(0.75 0.16 55)' },
  electrical:  { bg: 'oklch(0.50 0.15 85 / 0.15)', color: 'oklch(0.80 0.17 85)' },
  plumbing:    { bg: 'oklch(0.50 0.15 220 / 0.15)', color: 'oklch(0.70 0.17 220)' },
  hvac:        { bg: 'oklch(0.50 0.12 190 / 0.15)', color: 'oklch(0.72 0.14 190)' },
  landscaping: { bg: 'oklch(0.50 0.18 140 / 0.15)', color: 'oklch(0.78 0.18 140)' },
  demolition:  { bg: 'oklch(0.50 0.15 25 / 0.15)', color: 'oklch(0.70 0.17 25)' },
  other:       { bg: 'oklch(0.28 0.03 260 / 0.5)', color: 'var(--text-secondary)' },
};

export default function SubcontractorsView() {
  const [subs, setSubs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ specialty: '', status: 'active', search: '' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [slideOver, setSlideOver] = useState(null); // null | 'add' | sub object
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchSubs = async () => {
    try {
      const res = await subApi.listSubcontractors({
        specialty: filter.specialty || undefined,
        status: filter.status || undefined,
        search: filter.search || undefined,
        limit: pageSize,
        offset: page * pageSize,
      });
      setSubs(res.data.subcontractors || []);
      setTotal(res.data.total || 0);
    } catch {
      showToast('Failed to load subcontractors', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubs(); }, [filter, page, pageSize]);

  const handleDelete = async (id) => {
    try {
      await subApi.deleteSubcontractor(id);
      showToast('Subcontractor removed', 'success');
      setConfirmDelete(null);
      fetchSubs();
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  const totalPages = Math.ceil(total / pageSize);
  const showStart = total > 0 ? page * pageSize + 1 : 0;
  const showEnd = Math.min((page + 1) * pageSize, total);

  return (
    <div className="main-content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Subcontractors</h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>{total} total</div>
        </div>
        <button className="auth-btn" style={{ fontSize: 13, fontWeight: 700 }}
          onClick={() => setSlideOver('add')}>
          + Add Subcontractor
        </button>
      </div>

      {/* Filters */}
      <div className="glass" style={{ borderRadius: '20px / 18px', padding: 'var(--space-lg)', display: 'flex', gap: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ gap: 'var(--space-xs)' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Search</label>
          <input type="text" className="form-input" placeholder="Name, company, email..."
            value={filter.search} onChange={e => { setFilter(f => ({ ...f, search: e.target.value })); setPage(0); }}
            style={{ height: 36, borderRadius: 12, fontSize: 13, width: 200 }} />
        </div>
        <div className="form-group" style={{ gap: 'var(--space-xs)' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Specialty</label>
          <CustomSelect value={filter.specialty} onChange={v => { setFilter(f => ({ ...f, specialty: v })); setPage(0); }} options={SPECIALTY_OPTIONS} placeholder="All" />
        </div>
        <div className="form-group" style={{ gap: 'var(--space-xs)' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</label>
          <CustomSelect value={filter.status} onChange={v => { setFilter(f => ({ ...f, status: v })); setPage(0); }} options={STATUS_OPTIONS} placeholder="All" />
        </div>
      </div>

      {/* Table */}
      <div className="glass" style={{ borderRadius: '20px / 18px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>Loading...</div>
        ) : subs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>No subcontractors found</div>
            <button className="auth-btn" style={{ fontSize: 13, padding: '8px 20px' }} onClick={() => setSlideOver('add')}>
              Add Your First Subcontractor
            </button>
          </div>
        ) : (
          <table className="lead-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Specialty</th>
                <th>Phone</th>
                <th>Email</th>
                <th style={{ textAlign: 'right' }}>Rate</th>
                <th>Status</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(sub => {
                const sc = specialtyColors[sub.specialty] || specialtyColors.other;
                return (
                  <tr key={sub.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sub.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{sub.company || '—'}</td>
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                        background: sc.bg, color: sc.color, backdropFilter: 'blur(8px)',
                        border: '1px solid oklch(0.40 0.02 260 / 0.15)', textTransform: 'capitalize',
                      }}>{sub.specialty}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{sub.phone || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{sub.email || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                      {sub.hourly_rate ? `$${Number(sub.hourly_rate).toFixed(2)}/hr` : '—'}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                        background: sub.status === 'active' ? 'oklch(0.50 0.17 145 / 0.15)' : 'oklch(0.28 0.03 260 / 0.5)',
                        color: sub.status === 'active' ? 'oklch(0.75 0.18 155)' : 'var(--text-muted)',
                        textTransform: 'capitalize',
                      }}>{sub.status}</span>
                    </td>
                    <td>
                      {confirmDelete === sub.id ? (
                        <div style={{ display: 'flex', gap: 'var(--space-xs)', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Delete?</span>
                          <button onClick={() => handleDelete(sub.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', fontWeight: 700, fontSize: 12 }}>Yes</button>
                          <button onClick={() => setConfirmDelete(null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>No</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 'var(--space-xs)', opacity: 0 }} className="row-actions">
                          <button onClick={() => setSlideOver(sub)}
                            style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            title="Edit">
                            <PencilSquareIcon style={{ width: 14, height: 14 }} />
                          </button>
                          <button onClick={() => setConfirmDelete(sub.id)}
                            style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            title="Delete">
                            <TrashIcon style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-lg) 0' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Showing {showStart}–{showEnd} of {total}</span>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
            <CustomSelect value={String(pageSize)} onChange={v => { setPageSize(Number(v)); setPage(0); }} options={PAGE_SIZE_OPTIONS} style={{ width: 100 }} />
            <button className="quick-action-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 12px', fontSize: 12 }}>Prev</button>
            <button className="quick-action-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 12px', fontSize: 12 }}>Next</button>
          </div>
        </div>
      )}

      {/* Slide-over for Add/Edit */}
      {slideOver && (
        <SubSlideOver
          sub={slideOver === 'add' ? null : slideOver}
          onClose={() => setSlideOver(null)}
          onSaved={() => { setSlideOver(null); fetchSubs(); }}
        />
      )}

      <style>{`
        .lead-table tbody tr:hover .row-actions { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

function SubSlideOver({ sub, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: sub?.name || '',
    company: sub?.company || '',
    phone: sub?.phone || '',
    email: sub?.email || '',
    specialty: sub?.specialty || 'general',
    hourly_rate: sub?.hourly_rate || '',
    notes: sub?.notes || '',
    status: sub?.status || 'active',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null };
      if (sub?.id) {
        await subApi.updateSubcontractor(sub.id, payload);
        showToast('Subcontractor updated', 'success');
      } else {
        await subApi.createSubcontractor(payload);
        showToast('Subcontractor added', 'success');
      }
      onSaved();
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="slide-over-backdrop" onClick={onClose}
        style={{ position: 'fixed', top: 64, left: 0, right: 0, bottom: 0, background: 'oklch(0.05 0.02 260 / 0.6)', backdropFilter: 'blur(4px)', zIndex: 100, animation: 'fadeIn 0.25s var(--ease-out)' }} />
      <div className="slide-over glass"
        style={{ position: 'fixed', top: 'calc(64px + var(--space-md))', right: 'var(--space-md)', bottom: 'var(--space-md)', width: 480, maxWidth: '90vw', borderRadius: '20px / 18px', padding: 'var(--space-2xl)', zIndex: 101, animation: 'slideIn 0.35s var(--ease-out)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
        <button onClick={onClose} className="slide-over__close"
          style={{ position: 'absolute', top: 'var(--space-xl)', right: 'var(--space-xl)', width: 32, height: 32, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          &times;
        </button>

        <div style={{ paddingRight: 40 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {sub ? 'Edit Subcontractor' : 'Add Subcontractor'}
          </div>
        </div>

        <div className="divider" style={{ height: 1, background: 'var(--glass-border)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', flex: 1, overflowY: 'auto' }}>
          <div className="form-group">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Name *</label>
            <input type="text" className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Full name" />
          </div>
          <div className="form-group">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Company</label>
            <input type="text" className="form-input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              placeholder="Company name" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Phone</label>
              <input type="tel" className="form-input" value={form.phone}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  let formatted = digits;
                  if (digits.length >= 7) formatted = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
                  else if (digits.length >= 4) formatted = `(${digits.slice(0,3)}) ${digits.slice(3)}`;
                  else if (digits.length > 0) formatted = `(${digits}`;
                  setForm(f => ({ ...f, phone: formatted }));
                }}
                placeholder="(555) 123-4567" />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</label>
              <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Specialty</label>
              <CustomSelect value={form.specialty} onChange={v => setForm(f => ({ ...f, specialty: v }))} options={SPECIALTIES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} placeholder="Select specialty" />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hourly Rate</label>
              <input type="number" className="form-input" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                placeholder="0.00" step="0.01" min="0" />
            </div>
          </div>
          {sub && (
            <div className="form-group">
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</label>
              <CustomSelect value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} placeholder="Status" />
            </div>
          )}
          <div className="form-group">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notes</label>
            <textarea className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} placeholder="Insurance info, certifications, etc."
              style={{ resize: 'vertical', fontSize: 13, borderRadius: 12 }} />
          </div>
        </div>

        <div className="divider" style={{ height: 1, background: 'var(--glass-border)' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)', marginTop: 'auto' }}>
          <button className="quick-action-btn" onClick={onClose}
            style={{ padding: 'var(--space-sm) var(--space-lg)', fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button className="auth-btn" onClick={handleSave} disabled={saving || !form.name.trim()}
            style={{ fontSize: 13, fontWeight: 700 }}>
            {saving ? 'Saving...' : sub ? 'Update' : 'Add Subcontractor'}
          </button>
        </div>
      </div>
    </>
  );
}
