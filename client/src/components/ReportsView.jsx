import { useState, useEffect, useCallback, useMemo } from 'react';
import DatePicker from './DatePicker';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, FunnelChart, Funnel, LabelList,
} from 'recharts';
import {
  getRevenueReport, getPipelineReport, getConversionReport,
  getRepPerformanceReport, getStageDurationReport, getLeadSourcesReport,
} from '../api/crm';

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
// CSV Export Utility
// ============================================================
function exportCSV(data, filename) {
  if (!data?.length) return;
  const keys = Object.keys(data[0]);
  const header = keys.join(',');
  const rows = data.map(row =>
    keys.map(k => {
      const v = row[k];
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportButton({ data, filename }) {
  if (!data?.length) return null;
  return (
    <button
      onClick={() => exportCSV(data, filename)}
      title="Export as CSV"
      style={{
        position: 'absolute', top: 16, right: 16,
        background: 'oklch(0.22 0.02 260 / 0.5)', border: '1px solid oklch(0.35 0.02 260 / 0.3)',
        borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
        fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 4,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'oklch(0.72 0.19 250 / 0.4)'; }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'oklch(0.35 0.02 260 / 0.3)'; }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      CSV
    </button>
  );
}

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
    <>
    <ExportButton data={data} filename="revenue_report" />
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradEstimated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
        <XAxis dataKey="month" tick={{ fill: 'oklch(0.7 0 0)', fontSize: 12 }} />
        <YAxis tick={{ fill: 'oklch(0.7 0 0)', fontSize: 12 }} tickFormatter={fmtDollars} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtDollars(v)} />
        <Legend wrapperStyle={{ color: 'oklch(0.8 0 0)', fontSize: 13 }} />
        <Area type="monotone" dataKey="estimated" name="Estimated" stroke="#3b82f6" strokeWidth={2} fill="url(#gradEstimated)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
        <Area type="monotone" dataKey="actual" name="Actual" stroke="#22c55e" strokeWidth={2} fill="url(#gradActual)" dot={{ r: 4, fill: '#22c55e', strokeWidth: 0 }} activeDot={{ r: 6 }} />
      </AreaChart>
    </ResponsiveContainer>
    </>
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
    <>
    <ExportButton data={data} filename="pipeline_report" />
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
    </>
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
    <>
    <ExportButton data={data} filename="conversion_report" />
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="oklch(0.3 0 0)" />
        <PolarAngleAxis dataKey="source" tick={{ fill: 'oklch(0.7 0 0)', fontSize: 11 }} />
        <PolarRadiusAxis tick={{ fill: 'oklch(0.5 0 0)', fontSize: 10 }} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, name, props) => {
            if (name === 'Total') return [v, name];
            return [`${v} (${props.payload.rate}%)`, name];
          }}
        />
        <Legend wrapperStyle={{ color: 'oklch(0.8 0 0)', fontSize: 13 }} />
        <Radar name="Total" dataKey="total" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
        <Radar name="Sold" dataKey="sold" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} />
      </RadarChart>
    </ResponsiveContainer>
    </>
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
    <>
    <ExportButton data={sorted} filename="rep_leaderboard" />
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
    </>
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
    <>
    <ExportButton data={data} filename="lead_sources" />
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
    </>
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
    <>
    <ExportButton data={data} filename="stage_duration" />
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradDuration" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
        <XAxis dataKey="label" tick={{ fill: 'oklch(0.7 0 0)', fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
        <YAxis tick={{ fill: 'oklch(0.7 0 0)', fontSize: 12 }} label={{ value: 'Days', angle: -90, position: 'insideLeft', fill: 'oklch(0.6 0 0)', fontSize: 12 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} days`, 'Avg Duration']} />
        <Line type="monotone" dataKey="avg_days" name="Avg Days" stroke="url(#gradDuration)" strokeWidth={3} dot={(props) => {
          const { cx, cy, payload } = props;
          return <circle cx={cx} cy={cy} r={6} fill={payload.fill} stroke="oklch(0.15 0.01 260)" strokeWidth={2} />;
        }} activeDot={{ r: 8 }} />
      </LineChart>
    </ResponsiveContainer>
    </>
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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768); useEffect(() => { const mq = window.matchMedia('(max-width: 768px)'); const h = (e) => setIsMobile(e.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, []);
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
            <DatePicker value={start} onChange={v => { setStart(v); setPreset(''); }} placeholder="Start date" />
            <span style={{ color: 'oklch(0.5 0 0)' }}>to</span>
            <DatePicker value={end} onChange={v => { setEnd(v); setPreset(''); }} placeholder="End date" />
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
