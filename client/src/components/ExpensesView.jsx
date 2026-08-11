import { useState, useEffect, useCallback } from 'react';
import * as expensesApi from '../api/expenses';
import client from '../api/client';
import { IconX, IconDollar, IconPlusCircle, IconTrash } from './Icons';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import CustomSelect from './CustomSelect';
import DatePicker from './DatePicker';
import { showToast } from './Toast';
import { BanknotesIcon, TagIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../utils/currency';

const CATEGORIES = [
  { value: 'materials', label: 'Materials' },
  { value: 'labor', label: 'Labor' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'permit', label: 'Permit' },
  { value: 'dumpster', label: 'Dumpster' },
  { value: 'other', label: 'Other' },
];

const categoryColors = {
  materials: { bg: 'oklch(0.45 0.12 250 / 0.25)', fg: 'oklch(0.78 0.14 250)' },
  labor: { bg: 'oklch(0.45 0.12 145 / 0.25)', fg: 'oklch(0.78 0.14 145)' },
  subcontractor: { bg: 'oklch(0.45 0.12 300 / 0.25)', fg: 'oklch(0.78 0.14 300)' },
  permit: { bg: 'oklch(0.45 0.12 85 / 0.25)', fg: 'oklch(0.78 0.14 85)' },
  dumpster: { bg: 'oklch(0.45 0.12 25 / 0.25)', fg: 'oklch(0.78 0.14 25)' },
  other: { bg: 'oklch(0.35 0.02 250 / 0.25)', fg: 'oklch(0.7 0.02 250)' },
};

function CategoryBadge({ category }) {
  const c = categoryColors[category] || categoryColors.other;
  return (
    <span style={{
      padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
      background: c.bg, color: c.fg, textTransform: 'capitalize',
    }}>
      {category}
    </span>
  );
}

// ============================================================
// EXPENSE MODAL — Add / Edit
// ============================================================

function ExpenseModal({ expense, onSave, onClose }) {
  const isEdit = !!expense;
  const [leadId, setLeadId] = useState(expense?.lead_id || '');
  const [leadSearch, setLeadSearch] = useState(expense?.lead_address || expense?.contact_name || '');
  const [leadResults, setLeadResults] = useState([]);
  const [category, setCategory] = useState(expense?.category || 'materials');
  const [amount, setAmount] = useState(expense?.amount || '');
  const [date, setDate] = useState(expense?.date ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(expense?.notes || '');
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  // Lead search
  useEffect(() => {
    if (!leadSearch || leadSearch.length < 2) { setLeadResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await client.get('/search', { params: { q: leadSearch, limit: 8 } });
        setLeadResults(res.data?.results || res.data || []);
      } catch { setLeadResults([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [leadSearch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category || !amount || !date) return;
    setSaving(true);
    try {
      if (isEdit) {
        await expensesApi.updateExpense(expense.id, { lead_id: leadId || null, category, amount: parseFloat(amount), date, notes });
      } else {
        await expensesApi.createExpense({ lead_id: leadId || null, category, amount: parseFloat(amount), date, notes });
      }
      showToast(isEdit ? 'Expense updated' : 'Expense added', 'success');
      onSave();
    } catch {
      showToast('Failed to save expense', 'error');
    }
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div className="glass" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-xl)', position: 'relative',
      }}>
        <button aria-label="Close" onClick={onClose} style={{
          position: 'absolute', top: 12, right: 12, background: 'none', border: 'none',
          color: 'var(--text-muted)', cursor: 'pointer',
        }}><IconX /></button>

        <h3 style={{ margin: '0 0 var(--space-lg) 0', fontSize: 16, fontWeight: 700 }}>
          {isEdit ? 'Edit Expense' : 'Add Expense'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Lead search */}
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Job (Lead)</label>
            <input
              type="text"
              value={leadSearch}
              onChange={e => { setLeadSearch(e.target.value); setLeadId(''); }}
              placeholder="Search by address or name..."
              className="form-input"
            />
            {leadResults.length > 0 && !leadId && (
              <div className="glass" style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                borderRadius: 'var(--radius-md)', maxHeight: 200, overflowY: 'auto',
                marginTop: 4, border: '1px solid oklch(1 0 0 / 0.1)',
              }}>
                {leadResults.map(r => (
                  <div key={r.id} onClick={() => {
                    setLeadId(r.id);
                    setLeadSearch(r.address || r.contact_name || r.title || '');
                    setLeadResults([]);
                  }} style={{
                    padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                    borderBottom: '1px solid oklch(1 0 0 / 0.05)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'oklch(1 0 0 / 0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ fontWeight: 600 }}>{r.address || r.title || 'Untitled'}</div>
                    {r.contact_name && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.contact_name}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Category</label>
            <CustomSelect
              value={category}
              onChange={setCategory}
              options={CATEGORIES}
              placeholder="Select category"
            />
          </div>

          {/* Amount */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Amount</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', fontSize: 13, pointerEvents: 'none',
              }}>$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                className="form-input"
                style={{ paddingLeft: 24 }}
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Date</label>
            <DatePicker value={date} onChange={setDate} />
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes..."
              className="form-input"
              style={{ resize: 'vertical' }}
            />
          </div>

          <button type="submit" className="auth-btn" disabled={saving} style={{ marginTop: 'var(--space-sm)' }}>
            {saving ? 'Saving...' : isEdit ? 'Update Expense' : 'Add Expense'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// EXPENSES VIEW — List + Filters
// ============================================================

export default function ExpensesView() {
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768); useEffect(() => { const mq = window.matchMedia('(max-width: 768px)'); const h = (e) => setIsMobile(e.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (categoryFilter) params.category = categoryFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const res = await expensesApi.getExpenses(params);
      setExpenses(res.data.expenses || []);
      setTotal(res.data.total || 0);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, startDate, endDate]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const handleEdit = (exp) => {
    setEditingExpense(exp);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingExpense(null);
    setShowModal(true);
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditingExpense(null);
    fetchExpenses();
  };

  const handleDelete = async (id) => {
    try {
      await expensesApi.deleteExpense(id);
      showToast('Expense deleted', 'success');
      setConfirmDelete(null);
      fetchExpenses();
    } catch {
      showToast('Failed to delete expense', 'error');
    }
  };

  const categoryFilterOptions = [{ value: '', label: 'All Categories' }, ...CATEGORIES];

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)' }}>
      {/* KPI Summary */}
      <div className="stats-grid" style={{ gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)' }}>
        {[
          { Icon: BanknotesIcon, value: formatCurrency(totalAmount), label: 'Total Expenses', color: '25' },
          { Icon: TagIcon, value: expenses.length, label: 'Expense Items', color: '250' },
          { Icon: FunnelIcon, value: total, label: 'Matching Filter', color: '145' },
        ].map(s => (
          <div key={s.label} className="stat-card glass" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <s.Icon width={28} height={28} />
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="glass" style={{
        borderRadius: '20px / 18px', padding: 'var(--space-lg) var(--space-xl)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-lg)',
        overflow: 'visible', position: 'relative', zIndex: 20,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}>
        <div style={{ minWidth: 160 }}>
          <CustomSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryFilterOptions}
            placeholder="All Categories"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
          <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
          {total} expense{total !== 1 ? 's' : ''}
        </span>
        <button className="auth-btn" onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
          <IconPlusCircle style={{ width: 14, height: 14 }} /> Add Expense
        </button>
      </div>

      {/* Table */}
      <div className="glass" style={{ borderRadius: '20px / 18px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="lead-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Job</th>
                <th>Amount</th>
                <th>Notes</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && expenses.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>
                  No expenses yet — add your first one
                </td></tr>
              ) : expenses.map(exp => (
                <tr key={exp.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                    {exp.date ? new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td><CategoryBadge category={exp.category} /></td>
                  <td style={{ fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exp.lead_address || exp.contact_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>
                    {formatCurrency(exp.amount)}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exp.notes || '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-xs)' }}>
                      <button onClick={() => handleEdit(exp)} title="Edit" style={{
                        background: 'oklch(0.5 0.12 250 / 0.15)', border: 'none', borderRadius: 'var(--radius-md)',
                        padding: '4px 8px', cursor: 'pointer', color: 'oklch(0.78 0.12 250)',
                      }}>
                        <PencilSquareIcon width={14} height={14} />
                      </button>
                      <button onClick={() => setConfirmDelete(exp.id)} title="Delete" style={{
                        background: 'oklch(0.5 0.15 25 / 0.15)', border: 'none', borderRadius: 'var(--radius-md)',
                        padding: '4px 8px', cursor: 'pointer', color: 'oklch(0.78 0.15 25)',
                      }}>
                        <IconTrash style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <ExpenseModal
          expense={editingExpense}
          onSave={handleSaved}
          onClose={() => { setShowModal(false); setEditingExpense(null); }}
        />
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="modal-backdrop" style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(8px)',
        }} onClick={() => setConfirmDelete(null)}>
          <div className="glass" onClick={e => e.stopPropagation()} style={{
            padding: 'var(--space-xl)', borderRadius: 'var(--radius-xl)',
            textAlign: 'center', maxWidth: 340,
          }}>
            <h4 style={{ margin: '0 0 var(--space-md)' }}>Delete Expense?</h4>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 var(--space-lg)' }}>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                padding: '8px 20px', borderRadius: 'var(--radius-pill)', fontSize: 13,
                background: 'oklch(0.3 0.02 250)', border: '1px solid oklch(0.4 0.04 250)',
                color: 'var(--text-primary)', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{
                padding: '8px 20px', borderRadius: 'var(--radius-pill)', fontSize: 13,
                background: 'oklch(0.45 0.15 25)', border: 'none',
                color: 'oklch(1 0 0)', cursor: 'pointer', fontWeight: 600,
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
