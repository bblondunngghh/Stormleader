import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import {
  getRevenueReport, getPipelineReport, getConversionReport,
  getRepPerformanceReport, getStageDurationReport, getLeadSourcesReport,
} from '../api/crm';
import useIsMobile from '../hooks/useIsMobile';

// Recharts renders via SVG attributes (not CSS properties), so oklch() may not
// work in all browsers for SVG fill/stroke. These hex values approximate the
// oklch design-system palette and are kept intentionally for SVG compatibility.
const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

const STAGE_LABELS = {
  new: 'New', contacted: 'Contacted', appt_set: 'Appt Set',
  inspected: 'Inspected', estimate_sent: 'Estimate Sent', negotiating: 'Negotiating',
  sold: 'Sold', in_production: 'In Production', on_hold: 'On Hold', lost: 'Lost',
};

const STAGE_COLORS = {
  new: '#3b82f6', contacted: '#06b6d4', appt_set: '#8b5cf6',
  inspected: '#f59e0b', estimate_sent: '#f97316', negotiating: '#ec4899',
  sold: '#22c55e', in_production: '#10b981', on_hold: '#6b7280', lost: '#ef4444',
};

function getDatePreset(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const dow = now.getDay();
  switch (key) {
    case 'week': {
      const start = new Date(y, m, d - dow);
      return [start.toISOString().slice(0, 10), now.toISOString().slice(0, 10)];
    }
    case 'month':
      return [new Date(y, m, 1).toISOString().slice(0, 10), now.toISOString().slice(0, 10)];
    case 'quarter': {
      const qm = m - (m % 3);
      return [new Date(y, qm, 1).toISOString().slice(0, 10), now.toISOString().slice(0, 10)];
    }
    case 'year':
      return [new Date(y, 0, 1).toISOString().slice(0, 10), now.toISOString().slice(0, 10)];
    case 'all':
    default:
      return ['', ''];
  }
}

function fmtDollars(v) {
  if (v == null) return '$0';
  return '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const tooltipStyle = {
  backgroundColor: 'oklch(0.18 0.01 260)',
  border: '1px solid oklch(0.3 0.01 260)',
  borderRadius: 8,
  color: 'oklch(0.9 0 0)',
  fontSize: 13,
};

// ============================================================
// REPORT CARDS
// ============================================================

function RevenueChart({ start, end }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getRevenueReport(start, end)
      .then(r => setData(r.data.map(d => ({
        ...d,
        month: new Date(d.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        estimated: Number(d.estimated),
        actual: Number(d.actual),
      }))))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [start, end]);

  if (loading) return <div className="report-card__loader">Loading...</div>;
  if (!data.length) return <div className="report-card__empty">No revenue data for this period</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
        <XAxis dataKey="month" tick={{ fill: 'oklch(0.7 0 0)', fontSize: 12 }} />
        <YAxis tick={{ fill: 'oklch(0.7 0 0)', fontSize: 12 }} tickFormatter={fmtDollars} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtDollars(v)} />
        <Legend wrapperStyle={{ color: 'oklch(0.8 0 0)', fontSize: 13 }} />
        <Bar dataKey="estimated" name="Estimated" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" name="Actual" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PipelineChart({ start, end }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPipelineReport(start, end)
      .then(r => setData(r.data.map(d => ({
        ...d,
        label: STAGE_LABELS[d.stage] || d.stage,
        count: Number(d.count),
        total_value: Number(d.total_value),
        fill: STAGE_COLORS[d.stage] || '#6b7280',
      }))))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [start, end]);

  if (loading) return <div className="report-card__loader">Loading...</div>;
  if (!data.length) return <div className="report-card__empty">No pipeline data for this period</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
        <XAxis type="number" tick={{ fill: 'oklch(0.7 0 0)', fontSize: 12 }} />
        <YAxis dataKey="label" type="category" tick={{ fill: 'oklch(0.7 0 0)', fontSize: 12 }} width={100} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" name="Leads">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ConversionChart({ start, end }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getConversionReport(start, end)
      .then(r => setData(r.data.map(d => ({
        ...d,
        total: Number(d.total),
        sold: Number(d.sold),
        rate: d.total > 0 ? Math.round((d.sold / d.total) * 100) : 0,
      }))))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [start, end]);

  if (loading) return <div className="report-card__loader">Loading...</div>;
  if (!data.length) return <div className="report-card__empty">No conversion data for this period</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
        <XAxis dataKey="source" tick={{ fill: 'oklch(0.7 0 0)', fontSize: 12 }} />
        <YAxis tick={{ fill: 'oklch(0.7 0 0)', fontSize: 12 }} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, name, props) => {
            if (name === 'Total') return [v, name];
            return [`${v} (${props.payload.rate}%)`, name];
          }}
        />
        <Legend wrapperStyle={{ color: 'oklch(0.8 0 0)', fontSize: 13 }} />
        <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="sold" name="Sold" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RepLeaderboard({ start, end }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('sold_value');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    setLoading(true);
    getRepPerformanceReport(start, end)
      .then(r => setData(r.data.map(d => ({
        ...d,
        leads_assigned: Number(d.leads_assigned),
        leads_sold: Number(d.leads_sold),
        sold_value: Number(d.sold_value || 0),
        activity_count: Number(d.activity_count),
      }))))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [start, end]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [data, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const arrow = (key) => sortKey === key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  if (loading) return <div className="report-card__loader">Loading...</div>;
  if (!data.length) return <div className="report-card__empty">No rep data for this period</div>;

  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th>Rep</th>
            <th onClick={() => toggleSort('leads_assigned')} style={{ cursor: 'pointer' }}>Leads{arrow('leads_assigned')}</th>
            <th onClick={() => toggleSort('leads_sold')} style={{ cursor: 'pointer' }}>Closed{arrow('leads_sold')}</th>
            <th onClick={() => toggleSort('sold_value')} style={{ cursor: 'pointer' }}>Value{arrow('sold_value')}</th>
            <th onClick={() => toggleSort('activity_count')} style={{ cursor: 'pointer' }}>Activities{arrow('activity_count')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id}>
              <td>{r.name || 'Unknown'}</td>
              <td>{r.leads_assigned}</td>
              <td>{r.leads_sold}</td>
              <td>{fmtDollars(r.sold_value)}</td>
              <td>{r.activity_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeadSourcesPie({ start, end }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLeadSourcesReport(start, end)
      .then(r => setData(r.data.map((d, i) => ({
        ...d,
        count: Number(d.count),
        total_value: Number(d.total_value),
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [start, end]);

  if (loading) return <div className="report-card__loader">Loading...</div>;
  if (!data.length) return <div className="report-card__empty">No source data for this period</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="source"
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={50}
          label={({ source, percent }) => `${source} ${(percent * 100).toFixed(0)}%`}
          labelLine={{ stroke: 'oklch(0.5 0 0)' }}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} stroke="oklch(0.15 0.01 260)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [v, 'Leads']} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function StageDurationChart({ start, end }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getStageDurationReport(start, end)
      .then(r => setData(r.data.map(d => ({
        ...d,
        label: STAGE_LABELS[d.stage] || d.stage,
        avg_days: Number(d.avg_days),
        fill: STAGE_COLORS[d.stage] || '#6b7280',
      }))))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [start, end]);

  if (loading) return <div className="report-card__loader">Loading...</div>;
  if (!data.length) return <div className="report-card__empty">No stage duration data for this period</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
        <XAxis dataKey="label" tick={{ fill: 'oklch(0.7 0 0)', fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
        <YAxis tick={{ fill: 'oklch(0.7 0 0)', fontSize: 12 }} label={{ value: 'Days', angle: -90, position: 'insideLeft', fill: 'oklch(0.6 0 0)', fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} days`, 'Avg Duration']} />
        <Bar dataKey="avg_days" name="Avg Days">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// MAIN REPORTS VIEW
// ============================================================

const PRESETS = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
];

export default function ReportsView() {
  const isMobile = useIsMobile();
  const [preset, setPreset] = useState('year');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  useEffect(() => {
    const [s, e] = getDatePreset(preset);
    setStart(s);
    setEnd(e);
  }, [preset]);

  return (
    <div className="main-content" style={{ padding: isMobile ? 12 : 24, overflow: 'auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div className="reports-controls">
          <div className="reports-presets">
            {PRESETS.map(p => (
              <button
                key={p.key}
                className={`reports-preset-btn${preset === p.key ? ' is-active' : ''}`}
                onClick={() => setPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="reports-date-inputs">
            <input
              type="date"
              value={start}
              onChange={e => { setStart(e.target.value); setPreset(''); }}
              className="reports-date-input"
            />
            <span style={{ color: 'oklch(0.5 0 0)' }}>to</span>
            <input
              type="date"
              value={end}
              onChange={e => { setEnd(e.target.value); setPreset(''); }}
              className="reports-date-input"
            />
          </div>
        </div>
      </div>

      <div className="reports-grid" style={{ gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
        <div className="glass report-card">
          <h3 className="report-card__title">Revenue</h3>
          <RevenueChart start={start} end={end} />
        </div>

        <div className="glass report-card">
          <h3 className="report-card__title">Pipeline</h3>
          <PipelineChart start={start} end={end} />
        </div>

        <div className="glass report-card">
          <h3 className="report-card__title">Conversion by Source</h3>
          <ConversionChart start={start} end={end} />
        </div>

        <div className="glass report-card">
          <h3 className="report-card__title">Rep Leaderboard</h3>
          <RepLeaderboard start={start} end={end} />
        </div>

        <div className="glass report-card">
          <h3 className="report-card__title">Lead Sources</h3>
          <LeadSourcesPie start={start} end={end} />
        </div>

        <div className="glass report-card">
          <h3 className="report-card__title">Stage Duration</h3>
          <StageDurationChart start={start} end={end} />
        </div>
      </div>
    </div>
  );
}
