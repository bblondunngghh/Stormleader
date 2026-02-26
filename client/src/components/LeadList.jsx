import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getLeads, bulkAssign, bulkStatus } from '../api/crm';
import LeadDetail from './LeadDetail';
import { IconSearch, IconDownload, IconFilter, IconX } from './Icons';

const stageLabels = {
  new: 'New', contacted: 'Contacted', appt_set: 'Appt Set',
  inspected: 'Inspected', estimate_sent: 'Estimate Sent',
  negotiating: 'Negotiating', sold: 'Sold',
  in_production: 'In Production', on_hold: 'On Hold', lost: 'Lost',
};

const stageKeys = Object.keys(stageLabels);

const priorityLabels = { hot: 'Hot', warm: 'Warm', cold: 'Cold' };

const sourceLabels = {
  storm_auto: 'Storm', manual: 'Manual', referral: 'Referral',
  website: 'Website', door_knock: 'Door Knock', phone: 'Phone', other: 'Other',
};

const sourceColors = {
  storm_auto: 'oklch(0.72 0.18 250)', manual: 'oklch(0.65 0.12 160)',
  referral: 'oklch(0.70 0.16 310)', website: 'oklch(0.68 0.14 200)',
  door_knock: 'oklch(0.72 0.15 80)', phone: 'oklch(0.65 0.13 145)',
  other: 'oklch(0.60 0.05 250)',
};

const quickFilters = [
  { key: 'hot', label: 'Hot Leads', params: { priority: 'hot' } },
  { key: 'followup', label: 'Needs Follow-up', params: { needs_followup: 'true' } },
  { key: 'unassigned', label: 'Unassigned', params: { unassigned: 'true' } },
];

const pageSizes = [25, 50, 100];

function relativeTime(dateStr) {
  if (!dateStr) return '—';
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysInStage(lead) {
  const ref = lead.stage_changed_at || lead.created_at;
  if (!ref) return '—';
  const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
  return days;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

export default function LeadList() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Restore from URL params
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [stageFilter, setStageFilter] = useState(searchParams.get('stage') || '');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || '');
  const [sourceFilter, setSourceFilter] = useState(searchParams.get('source') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort_by') || 'created_at');
  const [sortDir, setSortDir] = useState(searchParams.get('sort_dir') || 'DESC');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 0);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('limit')) || 25);

  // Bulk selection
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkValue, setBulkValue] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const [exporting, setExporting] = useState(false);

  // Sync state to URL
  useEffect(() => {
    const p = {};
    if (search) p.search = search;
    if (stageFilter) p.stage = stageFilter;
    if (priorityFilter) p.priority = priorityFilter;
    if (sourceFilter) p.source = sourceFilter;
    if (sortBy !== 'created_at') p.sort_by = sortBy;
    if (sortDir !== 'DESC') p.sort_dir = sortDir;
    if (page > 0) p.page = String(page);
    if (pageSize !== 25) p.limit = String(pageSize);
    setSearchParams(p, { replace: true });
  }, [search, stageFilter, priorityFilter, sourceFilter, sortBy, sortDir, page, pageSize, setSearchParams]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: pageSize,
        offset: page * pageSize,
        sort_by: sortBy,
        sort_dir: sortDir,
      };
      if (search) params.search = search;
      if (stageFilter) params.stage = stageFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (sourceFilter) params.source = sourceFilter;

      const res = await getLeads(params);
      setLeads(res.data.leads || []);
      setTotal(res.data.total || 0);
    } catch {
      // Keep existing data on error
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter, priorityFilter, sourceFilter, sortBy, sortDir, page, pageSize]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'DESC' ? 'ASC' : 'DESC');
    } else {
      setSortBy(col);
      setSortDir('DESC');
    }
    setPage(0);
  };

  const totalPages = Math.ceil(total / pageSize);
  const sortArrow = (col) => sortBy === col ? (sortDir === 'ASC' ? ' \u25B2' : ' \u25BC') : '';

  // Selection helpers
  const allOnPageSelected = leads.length > 0 && leads.every(l => selected.has(l.id));

  const toggleAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selected);
      leads.forEach(l => next.delete(l.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      leads.forEach(l => next.add(l.id));
      setSelected(next);
    }
  };

  const toggleOne = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const clearSelection = () => {
    setSelected(new Set());
    setBulkAction(null);
    setBulkValue('');
  };

  // Bulk actions
  const executeBulk = async () => {
    if (selected.size === 0) return;
    setBulkSaving(true);
    try {
      const ids = [...selected];
      if (bulkAction === 'assign') {
        await bulkAssign(ids, bulkValue);
      } else if (bulkAction === 'status') {
        await bulkStatus(ids, bulkValue);
      }
      clearSelection();
      fetchLeads();
    } catch {
      // silent
    } finally {
      setBulkSaving(false);
    }
  };

  // CSV Export
  const exportCSV = () => {
    setExporting(true);
    try {
      const headers = ['Name', 'Address', 'City', 'Phone', 'Email', 'Stage', 'Priority', 'Source', 'Value', 'Rep', 'Hail Size', 'Storm Date', 'Last Contact', 'Next Follow-up', 'Created'];
      const rows = leads.map(l => [
        l.contact_name || '',
        l.address || '',
        l.city || '',
        l.contact_phone || '',
        l.contact_email || '',
        stageLabels[l.stage] || l.stage || '',
        priorityLabels[l.priority] || l.priority || '',
        sourceLabels[l.source] || l.source || '',
        l.estimated_value || '',
        l.rep_first_name ? `${l.rep_first_name} ${l.rep_last_name || ''}`.trim() : '',
        l.hail_size_in || '',
        l.storm_start ? new Date(l.storm_start).toLocaleDateString() : '',
        l.last_contact_at ? new Date(l.last_contact_at).toLocaleDateString() : '',
        l.next_follow_up ? new Date(l.next_follow_up).toLocaleDateString() : '',
        l.created_at ? new Date(l.created_at).toLocaleDateString() : '',
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stormleads-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // Quick filter helpers
  const applyQuickFilter = (qf) => {
    if (qf.params.priority) {
      setPriorityFilter(qf.params.priority);
    }
    // For needs_followup and unassigned, we pass them as search params to the API
    // For now, just set basic filters
    setPage(0);
  };

  // Active filter pills
  const activeFilters = [];
  if (stageFilter) activeFilters.push({ key: 'stage', label: `Stage: ${stageLabels[stageFilter]}`, clear: () => setStageFilter('') });
  if (priorityFilter) activeFilters.push({ key: 'priority', label: `Priority: ${priorityLabels[priorityFilter] || priorityFilter}`, clear: () => setPriorityFilter('') });
  if (sourceFilter) activeFilters.push({ key: 'source', label: `Source: ${sourceLabels[sourceFilter] || sourceFilter}`, clear: () => setSourceFilter('') });

  const fromRow = total === 0 ? 0 : page * pageSize + 1;
  const toRow = Math.min((page + 1) * pageSize, total);

  return (
    <div className="main-content" style={{ gap: 'var(--space-lg)' }}>
      {/* Toolbar */}
      <div className="lead-list-toolbar glass" style={{
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-md) var(--space-xl)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 300 }}>
          <IconSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', width: 15, height: 15 }} />
          <input
            className="form-input"
            placeholder="Search leads..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: '100%', paddingLeft: 34, fontSize: 13 }}
          />
        </div>

        {/* Filters */}
        <select className="form-input" value={stageFilter} onChange={(e) => { setStageFilter(e.target.value); setPage(0); }} style={{ flex: '0 0 auto', minWidth: 130, fontSize: 13 }}>
          <option value="">All Stages</option>
          {stageKeys.map(k => <option key={k} value={k}>{stageLabels[k]}</option>)}
        </select>

        <select className="form-input" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(0); }} style={{ flex: '0 0 auto', minWidth: 120, fontSize: 13 }}>
          <option value="">All Priorities</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>

        <select className="form-input" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }} style={{ flex: '0 0 auto', minWidth: 120, fontSize: 13 }}>
          <option value="">All Sources</option>
          {Object.entries(sourceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          <button className="quick-action-btn" onClick={exportCSV} disabled={exporting} title="Export CSV" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconDownload style={{ width: 14, height: 14 }} />
            <span style={{ fontSize: 12 }}>CSV</span>
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {total} lead{total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Active Filter Pills */}
      {activeFilters.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', paddingLeft: 'var(--space-sm)' }}>
          {activeFilters.map(f => (
            <span key={f.key} className="filter-pill">
              {f.label}
              <button onClick={f.clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 0 0 6px', fontSize: 12, lineHeight: 1 }}>&times;</button>
            </span>
          ))}
          {activeFilters.length > 1 && (
            <button onClick={() => { setStageFilter(''); setPriorityFilter(''); setSourceFilter(''); setPage(0); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', fontSize: 11, fontWeight: 600 }}>
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="bulk-action-bar glass" style={{
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-sm) var(--space-xl)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          background: 'oklch(0.35 0.08 250 / 0.8)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)' }}>
            {selected.size} selected
          </span>

          <select className="form-input" value={bulkAction || ''} onChange={e => { setBulkAction(e.target.value || null); setBulkValue(''); }}
            style={{ minWidth: 140, fontSize: 12 }}>
            <option value="">Choose action...</option>
            <option value="status">Change Stage</option>
            <option value="assign">Assign Rep</option>
          </select>

          {bulkAction === 'status' && (
            <select className="form-input" value={bulkValue} onChange={e => setBulkValue(e.target.value)} style={{ minWidth: 140, fontSize: 12 }}>
              <option value="">Select stage...</option>
              {stageKeys.map(k => <option key={k} value={k}>{stageLabels[k]}</option>)}
            </select>
          )}

          {bulkAction === 'assign' && (
            <input className="form-input" placeholder="Rep user ID" value={bulkValue} onChange={e => setBulkValue(e.target.value)} style={{ maxWidth: 200, fontSize: 12 }} />
          )}

          {bulkAction && bulkValue && (
            <button className="auth-btn" onClick={executeBulk} disabled={bulkSaving} style={{ padding: '6px 16px', fontSize: 12 }}>
              {bulkSaving ? 'Applying...' : 'Apply'}
            </button>
          )}

          <button onClick={clearSelection} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>
            Cancel
          </button>
        </div>
      )}

      {/* Table */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table className="lead-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleAll}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent-blue)' }} />
                </th>
                <th onClick={() => handleSort('stage')} style={{ cursor: 'pointer' }}>Stage{sortArrow('stage')}</th>
                <th onClick={() => handleSort('priority')} style={{ cursor: 'pointer', width: 60 }}>Pri{sortArrow('priority')}</th>
                <th>Address</th>
                <th onClick={() => handleSort('contact_name')} style={{ cursor: 'pointer' }}>Contact{sortArrow('contact_name')}</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Source</th>
                <th>Storm</th>
                <th onClick={() => handleSort('estimated_value')} style={{ cursor: 'pointer' }}>Value{sortArrow('estimated_value')}</th>
                <th>Rep</th>
                <th onClick={() => handleSort('last_contact_at')} style={{ cursor: 'pointer' }}>Last Contact{sortArrow('last_contact_at')}</th>
                <th>Follow-up</th>
                <th>Days</th>
                <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>Created{sortArrow('created_at')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && leads.length === 0 ? (
                <tr><td colSpan={15} style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={15} style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>No leads found</td></tr>
              ) : leads.map((lead) => {
                const isSelected = selected.has(lead.id);
                const followUpOverdue = isOverdue(lead.next_follow_up);

                return (
                  <tr key={lead.id}
                    className={isSelected ? 'lead-table__row--selected' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOne(lead.id)}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent-blue)' }} />
                    </td>
                    <td>
                      <span className={`lead-table__stage lead-table__stage--${lead.stage}`}>
                        {stageLabels[lead.stage] || lead.stage}
                      </span>
                    </td>
                    <td>
                      <span className={`lead-table__priority-dot lead-table__priority-dot--${lead.priority}`} />
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lead.address || '—'}
                      </div>
                      {lead.city && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.city}</div>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{lead.contact_name || '—'}</td>
                    <td>
                      {lead.contact_phone ? (
                        <a href={`tel:${lead.contact_phone}`} onClick={e => e.stopPropagation()}
                          style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: 12 }}>
                          {lead.contact_phone}
                        </a>
                      ) : '—'}
                    </td>
                    <td>
                      {lead.contact_email ? (
                        <a href={`mailto:${lead.contact_email}`} onClick={e => e.stopPropagation()}
                          style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: 12, maxWidth: 160, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                          {lead.contact_email}
                        </a>
                      ) : '—'}
                    </td>
                    <td>
                      {lead.source ? (
                        <span style={{
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                          background: `color-mix(in oklch, ${sourceColors[lead.source] || 'oklch(0.60 0.05 250)'} 15%, transparent)`,
                          color: sourceColors[lead.source] || 'var(--text-secondary)',
                        }}>
                          {sourceLabels[lead.source] || lead.source}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {lead.storm_start ? (
                        <span>
                          {new Date(lead.storm_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {lead.hail_size_in && <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}> {lead.hail_size_in}"</span>}
                        </span>
                      ) : lead.hail_size_in ? (
                        <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>{lead.hail_size_in}"</span>
                      ) : '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                      {lead.estimated_value ? `$${Number(lead.estimated_value).toLocaleString()}` : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {lead.rep_first_name ? `${lead.rep_first_name} ${lead.rep_last_name?.[0] || ''}` : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {relativeTime(lead.last_contact_at)}
                    </td>
                    <td style={{
                      fontSize: 12,
                      color: followUpOverdue ? 'var(--accent-red)' : 'var(--text-secondary)',
                      fontWeight: followUpOverdue ? 700 : 400,
                    }}>
                      {lead.next_follow_up ? formatDate(lead.next_follow_up) : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                      {daysInStage(lead)}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {formatDate(lead.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-md) var(--space-lg)',
          borderTop: '1px solid var(--glass-border)',
          flexWrap: 'wrap', gap: 'var(--space-sm)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {total > 0 ? `Showing ${fromRow}–${toRow} of ${total} leads` : 'No results'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Per page:</span>
              {pageSizes.map(s => (
                <button key={s}
                  className="quick-action-btn"
                  onClick={() => { setPageSize(s); setPage(0); }}
                  style={{
                    padding: '3px 8px', fontSize: 11, minWidth: 0,
                    background: pageSize === s ? 'oklch(0.50 0.15 250 / 0.15)' : undefined,
                    color: pageSize === s ? 'var(--accent-blue)' : undefined,
                    fontWeight: pageSize === s ? 700 : 400,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <button className="quick-action-btn" onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0} style={{ opacity: page === 0 ? 0.4 : 1, padding: '4px 10px', fontSize: 12 }}>
                  Prev
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {page + 1} / {totalPages}
                </span>
                <button className="quick-action-btn" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1} style={{ opacity: page >= totalPages - 1 ? 0.4 : 1, padding: '4px 10px', fontSize: 12 }}>
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedLead && (
        <LeadDetail
          leadId={selectedLead.id}
          onClose={() => setSelectedLead(null)}
          onUpdated={() => fetchLeads()}
        />
      )}
    </div>
  );
}
