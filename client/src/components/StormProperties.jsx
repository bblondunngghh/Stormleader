import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getProspectLists, getProspectListItems, deleteProspectList, removeProspectListItem } from '../api/crm';
import { IconSearch } from './Icons';
import CustomSelect from './CustomSelect';

const PAGE_SIZE = 50;

const stormTypeColors = {
  hail: '#dcb428',
  wind: '#6c5ce7',
  tornado: '#ff2d55',
};

function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatOwner(first, last) {
  const raw = [first, last].filter(s => s?.trim()).join(' ').trim();
  if (!raw) return '—';
  const upper = raw.toUpperCase();
  const bizWords = ['LLC', 'INC', 'CORP', 'TRUST', 'ESTATE', 'LTD', 'PARTNERSHIP', 'LP', 'LLP', 'CHURCH', 'ASSOCIATION', 'INVESTMENTS'];
  if (bizWords.some(w => upper.includes(w))) return titleCase(raw);
  if (first?.trim() && last?.trim()) return titleCase(first.trim() + ' ' + last.trim());
  if (raw.includes('&')) return titleCase(raw);
  const parts = raw.split(/\s+/);
  if (parts.length >= 2) {
    const lastName = parts[0];
    const rest = parts.slice(1).join(' ');
    return titleCase(rest + ' ' + lastName);
  }
  return titleCase(raw);
}

function cleanAddress(addr) {
  if (!addr) return '—';
  const trimmed = addr.trim();
  if (!trimmed || trimmed === '0' || trimmed === '0 ' || /^0\s/.test(trimmed)) {
    const stripped = trimmed.replace(/^0\s*/, '').trim();
    return stripped || '—';
  }
  return trimmed;
}

function formatLocation(city, state, zip) {
  const c = city?.trim();
  const s = state?.trim();
  const z = zip?.trim();
  const badZip = !z || z === '0' || z === '00000';
  if (c) return titleCase(c) + (s ? `, ${s}` : '') + (!badZip ? ` ${z}` : '');
  if (s && !badZip) return `${s} ${z}`;
  if (s) return s;
  return '—';
}

const VALUE_PRESETS = [
  { label: 'Any Value', min: '', max: '' },
  { label: '$50k+', min: '50000', max: '' },
  { label: '$100k+', min: '100000', max: '' },
  { label: '$150k+', min: '150000', max: '' },
  { label: '$200k+', min: '200000', max: '' },
  { label: '$250k+', min: '250000', max: '' },
  { label: '$300k+', min: '300000', max: '' },
  { label: '$500k+', min: '500000', max: '' },
  { label: '$50k–$150k', min: '50000', max: '150000' },
  { label: '$150k–$300k', min: '150000', max: '300000' },
  { label: '$300k–$500k', min: '300000', max: '500000' },
];

const YEAR_PRESETS = [
  { label: 'Any Year', min: '', max: '' },
  { label: 'Before 2000', min: '', max: '1999' },
  { label: '2000–2010', min: '2000', max: '2010' },
  { label: '2010–2020', min: '2010', max: '2020' },
  { label: '2020+', min: '2020', max: '' },
  { label: 'Before 1990', min: '', max: '1989' },
  { label: '1990–2005', min: '1990', max: '2005' },
];

const ROOF_PRESETS = [
  { label: 'Any Size', min: '', max: '' },
  { label: '1,000+ sqft', min: '1000', max: '' },
  { label: '1,500+ sqft', min: '1500', max: '' },
  { label: '2,000+ sqft', min: '2000', max: '' },
  { label: '2,500+ sqft', min: '2500', max: '' },
  { label: '3,000+ sqft', min: '3000', max: '' },
];

const selectStyle = {
  background: 'oklch(0.10 0.015 265 / 0.6)',
  border: '1px solid oklch(0.28 0.02 265 / 0.4)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: 11,
  padding: '5px 8px',
  cursor: 'pointer',
  minWidth: 0,
};

const filterLabelStyle = {
  fontSize: 9,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--text-muted)',
  marginBottom: 2,
};

export default function StormProperties() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(searchParams.get('list') || null);
  const [properties, setProperties] = useState([]);
  const [total, setTotal] = useState(0);
  const [listMeta, setListMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 0);
  const [search, setSearch] = useState('');
  const [listDropdownOpen, setListDropdownOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    value_min: '', value_max: '',
    year_min: '', year_max: '',
    roof_min: '', roof_max: '',
    has_owner: '', has_phone: '', homestead: '',
    status: '', city: '', roof_type: '',
  });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.value_min || filters.value_max) count++;
    if (filters.year_min || filters.year_max) count++;
    if (filters.roof_min || filters.roof_max) count++;
    if (filters.has_owner) count++;
    if (filters.has_phone) count++;
    if (filters.homestead) count++;
    if (filters.status) count++;
    if (filters.city) count++;
    if (filters.roof_type) count++;
    return count;
  }, [filters]);

  const fetchLists = useCallback(async () => {
    try {
      const res = await getProspectLists();
      setLists(res.data.lists || []);
    } catch {
      setLists([]);
    }
  }, []);

  const fetchItems = useCallback(async () => {
    if (!selectedList) {
      setProperties([]);
      setTotal(0);
      setListMeta(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      // Add active filters to params
      for (const [key, val] of Object.entries(filters)) {
        if (val) params[key] = val;
      }
      const res = await getProspectListItems(selectedList, params);
      setProperties(res.data.properties || []);
      setTotal(res.data.total || 0);
      setListMeta(res.data.list || null);
    } catch {
      setProperties([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [selectedList, page, filters]);

  useEffect(() => { fetchLists(); }, [fetchLists]);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (!selectedList && lists.length > 0) {
      setSelectedList(lists[0].id);
    }
  }, [lists, selectedList]);

  useEffect(() => {
    const p = {};
    if (selectedList) p.list = selectedList;
    if (page > 0) p.page = String(page);
    setSearchParams(p, { replace: true });
  }, [selectedList, page, setSearchParams]);

  useEffect(() => {
    if (!listDropdownOpen) return;
    const handler = () => setListDropdownOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [listDropdownOpen]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filtered = search
    ? properties.filter(p => {
        const q = search.toLowerCase();
        return (
          (p.address_line1 || '').toLowerCase().includes(q) ||
          (p.city || '').toLowerCase().includes(q) ||
          (p.owner_last_name || '').toLowerCase().includes(q) ||
          (p.owner_first_name || '').toLowerCase().includes(q)
        );
      })
    : properties;

  const formatCurrency = (v) => {
    if (!v) return '—';
    return `$${Number(v).toLocaleString()}`;
  };

  const handleDeleteList = async (listId, e) => {
    e?.stopPropagation();
    try {
      await deleteProspectList(listId);
      setLists(prev => prev.filter(l => l.id !== listId));
      if (selectedList === listId) {
        setSelectedList(null);
        setProperties([]);
        setTotal(0);
      }
    } catch { /* silent */ }
  };

  const handleRemoveItem = async (propertyId, e) => {
    e.stopPropagation();
    try {
      await removeProspectListItem(selectedList, propertyId);
      setProperties(prev => prev.filter(p => p.id !== propertyId));
      setTotal(prev => prev - 1);
      // Update the list count in the sidebar
      setLists(prev => prev.map(l =>
        l.id === selectedList ? { ...l, property_count: (l.property_count || 1) - 1 } : l
      ));
    } catch { /* silent */ }
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({
      value_min: '', value_max: '',
      year_min: '', year_max: '',
      roof_min: '', roof_max: '',
      has_owner: '', has_phone: '', homestead: '',
      status: '', city: '', roof_type: '',
    });
    setPage(0);
  };

  const selectedListData = lists.find(l => l.id === selectedList);
  const selectedStormType = (selectedListData?.storm_type || 'wind').toLowerCase();
  const selectedTypeColor = stormTypeColors[selectedStormType] || '#6c5ce7';

  // Get unique cities from current properties for the city filter dropdown
  const cities = useMemo(() => {
    const s = new Set();
    properties.forEach(p => { if (p.city?.trim()) s.add(titleCase(p.city.trim())); });
    return [...s].sort();
  }, [properties]);

  const roofTypes = useMemo(() => {
    const s = new Set();
    properties.forEach(p => { if (p.roof_type?.trim()) s.add(p.roof_type.trim()); });
    return [...s].sort();
  }, [properties]);

  const mapUrl = (p) =>
    `/storm-map?lat=${p.lat}&lng=${p.lng}&zoom=17&propertyId=${p.id}${selectedListData?.storm_event_id ? `&stormId=${selectedListData.storm_event_id}` : ''}`;

  return (
    <div className="main-content">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Prospect Lists</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Properties collected from storm swaths — ready for skip tracing and outreach
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="quick-action-btn" onClick={() => navigate('/storm-map')}
            style={{ fontSize: 12, padding: '6px 14px' }}>
            Open Storm Map
          </button>
        </div>
      </div>

      {/* List selector bar */}
      <div className="dashboard-panel glass" style={{ padding: 'var(--space-md) var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
        {/* List dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setListDropdownOpen(v => !v); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 'var(--radius-md)',
              background: 'oklch(0.12 0.02 265 / 0.8)',
              border: '1px solid oklch(0.30 0.02 265 / 0.4)',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', minWidth: 200,
            }}
          >
            {selectedListData ? (
              <>
                <span style={{
                  fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                  color: selectedTypeColor, background: `${selectedTypeColor}18`,
                  padding: '2px 5px', borderRadius: 3,
                  border: `1px solid ${selectedTypeColor}30`,
                }}>
                  {selectedStormType}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedListData.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {(selectedListData.property_count || 0).toLocaleString()}
                </span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                {lists.length === 0 ? 'No lists yet' : 'Select a list...'}
              </span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>▾</span>
          </button>

          {listDropdownOpen && lists.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              minWidth: 320, maxHeight: 300, overflowY: 'auto',
              background: 'oklch(0.14 0.02 265 / 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid oklch(0.30 0.02 265 / 0.5)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 32px oklch(0 0 0 / 0.4)',
              zIndex: 100,
            }}>
              {lists.map(list => {
                const st = (list.storm_type || 'wind').toLowerCase();
                const tc = stormTypeColors[st] || '#6c5ce7';
                const isActive = selectedList === list.id;
                const stormDate = list.storm_date
                  ? new Date(list.storm_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : '';

                return (
                  <div
                    key={list.id}
                    onClick={() => { setSelectedList(list.id); setPage(0); setListDropdownOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', cursor: 'pointer',
                      background: isActive ? 'oklch(0.50 0.15 250 / 0.12)' : 'transparent',
                      borderLeft: isActive ? `3px solid ${tc}` : '3px solid transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'oklch(0.18 0.02 265 / 0.5)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{
                      fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                      color: tc, background: `${tc}18`,
                      padding: '2px 5px', borderRadius: 3,
                      border: `1px solid ${tc}30`, flexShrink: 0,
                    }}>
                      {st}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {list.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {(list.property_count || 0).toLocaleString()} properties {stormDate ? `· ${stormDate}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteList(list.id, e)}
                      style={{ fontSize: 12, color: 'var(--text-muted)', opacity: 0.4, padding: '4px 6px', flexShrink: 0 }}
                      title="Delete list"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'oklch(0.10 0.015 265 / 0.6)',
          borderRadius: 'var(--radius-pill)', padding: '6px 14px', flex: 1, maxWidth: 300,
        }}>
          <IconSearch style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by name or address..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 13, width: '100%',
            }}
          />
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setFiltersOpen(v => !v)}
          style={{
            fontSize: 11, padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            background: activeFilterCount > 0 ? 'oklch(0.50 0.15 250 / 0.15)' : 'oklch(0.14 0.02 265 / 0.6)',
            border: `1px solid ${activeFilterCount > 0 ? 'oklch(0.50 0.15 250 / 0.4)' : 'oklch(0.28 0.02 265 / 0.4)'}`,
            color: activeFilterCount > 0 ? 'oklch(0.80 0.15 250)' : 'var(--text-secondary)',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>

        {/* Page info */}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {total > 0 ? `${total.toLocaleString()} properties · Page ${page + 1} of ${totalPages || 1}` : ''}
        </span>
      </div>

      {/* Filter bar */}
      {filtersOpen && selectedList && (
        <div className="dashboard-panel glass" style={{
          padding: 'var(--space-md) var(--space-lg)',
          display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', alignItems: 'flex-end',
        }}>
          {/* Value filter */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={filterLabelStyle}>Assessed Value</span>
            <CustomSelect
              value={`${filters.value_min}|${filters.value_max}`}
              onChange={v => {
                const [min, max] = v.split('|');
                setFilters(prev => ({ ...prev, value_min: min, value_max: max }));
                setPage(0);
              }}
              options={VALUE_PRESETS.map(p => ({ value: `${p.min}|${p.max}`, label: p.label }))}
            />
          </div>

          {/* Year built filter */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={filterLabelStyle}>Year Built</span>
            <CustomSelect
              value={`${filters.year_min}|${filters.year_max}`}
              onChange={v => {
                const [min, max] = v.split('|');
                setFilters(prev => ({ ...prev, year_min: min, year_max: max }));
                setPage(0);
              }}
              options={YEAR_PRESETS.map(p => ({ value: `${p.min}|${p.max}`, label: p.label }))}
            />
          </div>

          {/* Roof size filter */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={filterLabelStyle}>Roof Size</span>
            <CustomSelect
              value={`${filters.roof_min}|${filters.roof_max}`}
              onChange={v => {
                const [min, max] = v.split('|');
                setFilters(prev => ({ ...prev, roof_min: min, roof_max: max }));
                setPage(0);
              }}
              options={ROOF_PRESETS.map(p => ({ value: `${p.min}|${p.max}`, label: p.label }))}
            />
          </div>

          {/* Owner filter */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={filterLabelStyle}>Owner</span>
            <CustomSelect value={filters.has_owner} onChange={v => updateFilter('has_owner', v)}
              options={[
                { value: '', label: 'All' },
                { value: 'true', label: 'Has Owner' },
                { value: 'false', label: 'No Owner' },
              ]}
            />
          </div>

          {/* Phone filter */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={filterLabelStyle}>Phone</span>
            <CustomSelect value={filters.has_phone} onChange={v => updateFilter('has_phone', v)}
              options={[
                { value: '', label: 'All' },
                { value: 'true', label: 'Has Phone' },
                { value: 'false', label: 'No Phone' },
              ]}
            />
          </div>

          {/* Homestead filter */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={filterLabelStyle}>Homestead</span>
            <CustomSelect value={filters.homestead} onChange={v => updateFilter('homestead', v)}
              options={[
                { value: '', label: 'All' },
                { value: 'true', label: 'Homestead Only' },
                { value: 'false', label: 'Non-Homestead' },
              ]}
            />
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={filterLabelStyle}>Status</span>
            <CustomSelect value={filters.status} onChange={v => updateFilter('status', v)}
              options={[
                { value: '', label: 'All' },
                { value: 'new', label: 'New Only' },
                { value: 'lead', label: 'In Pipeline' },
              ]}
            />
          </div>

          {/* City filter */}
          {cities.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={filterLabelStyle}>City</span>
              <CustomSelect value={filters.city} onChange={v => updateFilter('city', v)}
                options={[
                  { value: '', label: 'All Cities' },
                  ...cities.map(c => ({ value: c, label: c }))
                ]}
              />
            </div>
          )}

          {/* Roof type filter */}
          {roofTypes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={filterLabelStyle}>Roof Type</span>
              <CustomSelect value={filters.roof_type} onChange={v => updateFilter('roof_type', v)}
                options={[
                  { value: '', label: 'All Types' },
                  ...roofTypes.map(t => ({ value: t, label: titleCase(t) }))
                ]}
              />
            </div>
          )}

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              style={{
                fontSize: 11, padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                background: 'oklch(0.40 0.18 25 / 0.15)', border: '1px solid oklch(0.40 0.18 25 / 0.3)',
                color: 'oklch(0.75 0.15 25)', fontWeight: 600, cursor: 'pointer',
                alignSelf: 'flex-end',
              }}
            >
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Property table */}
      <div className="dashboard-panel glass" style={{ padding: 0, overflow: 'hidden' }}>
        {!selectedList ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14 }}>
              {lists.length === 0
                ? 'Click a storm swath on the map to create your first prospect list'
                : 'Select a list to view properties'}
            </div>
            {lists.length === 0 && (
              <button className="quick-action-btn" onClick={() => navigate('/storm-map')}
                style={{ fontSize: 12, padding: '8px 16px' }}>
                Go to Storm Map
              </button>
            )}
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>
            <div className="storm-map-loading__spinner" style={{ marginRight: 12 }} />
            Loading properties...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="lead-table" style={{ fontSize: 12, width: '100%' }}>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Location</th>
                  <th>Owner</th>
                  <th>Phone</th>
                  <th style={{ textAlign: 'right' }}>Value</th>
                  <th style={{ textAlign: 'center' }}>Year Built</th>
                  <th style={{ textAlign: 'center' }}>Roof SqFt</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center', width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                      {search ? 'No properties match your search' : activeFilterCount > 0 ? 'No properties match these filters' : 'No properties in this list'}
                    </td>
                  </tr>
                ) : filtered.map(p => (
                  <tr key={p.id} style={{ cursor: 'pointer' }}
                    onClick={() => { if (p.lat && p.lng) navigate(mapUrl(p)); }}>
                    <td style={{ fontWeight: 500 }}>{cleanAddress(p.address_line1)}</td>
                    <td>{formatLocation(p.city, p.state, p.zip)}</td>
                    <td>{formatOwner(p.owner_first_name, p.owner_last_name)}</td>
                    <td style={{ color: p.owner_phone ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                      {p.owner_phone || '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatCurrency(p.assessed_value)}
                    </td>
                    <td style={{ textAlign: 'center' }}>{p.year_built || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{p.roof_sqft ? p.roof_sqft.toLocaleString() : '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {p.lead_id ? (
                        <span style={{
                          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                          color: 'oklch(0.75 0.18 155)', background: 'oklch(0.75 0.18 155 / 0.1)',
                          padding: '3px 8px', borderRadius: 'var(--radius-pill)',
                        }}>
                          {p.lead_stage || 'Lead'}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                          color: 'oklch(0.72 0.16 45)', background: 'oklch(0.72 0.16 45 / 0.1)',
                          padding: '3px 8px', borderRadius: 'var(--radius-pill)',
                        }}>
                          New
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (p.lat && p.lng) navigate(mapUrl(p));
                          }}
                          style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600, whiteSpace: 'nowrap' }}
                          title="View on Map"
                        >
                          Map
                        </button>
                        <button
                          onClick={(e) => handleRemoveItem(p.id, e)}
                          style={{
                            fontSize: 13, color: 'var(--text-muted)', opacity: 0.5, padding: '2px 6px',
                            transition: 'opacity 0.15s, color 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'oklch(0.65 0.20 25)'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                          title="Remove from list"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: 'var(--space-lg)',
            borderTop: '1px solid oklch(0.22 0.02 265 / 0.3)',
          }}>
            <button
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              style={{
                fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                background: 'oklch(0.18 0.03 265 / 0.5)', color: 'var(--text-secondary)',
                opacity: page === 0 ? 0.4 : 1,
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {(page * PAGE_SIZE + 1).toLocaleString()} – {Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              style={{
                fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                background: 'oklch(0.18 0.03 265 / 0.5)', color: 'var(--text-secondary)',
                opacity: page >= totalPages - 1 ? 0.4 : 1,
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
