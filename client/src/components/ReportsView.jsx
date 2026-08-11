import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownTrayIcon, ArrowTrendingUpIcon,
  ChevronUpIcon, ChevronDownIcon,
  ArrowUpIcon, ArrowDownIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline';
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

// Same keys LeadList.jsx:47 and Pipeline.jsx:125 label. Without this the raw
// enum reached the user: the source charts rendered "fema_nsi"/"storm_map".
const SOURCE_LABELS = {
  storm_map: 'Storm Map', fema_nsi: 'FEMA NSI', canvassing: 'Canvassing',
  storm_auto: 'Storm', manual: 'Manual', referral: 'Referral',
  website: 'Website', door_knock: 'Door Knock', phone: 'Phone', other: 'Other',
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
      <ArrowDownTrayIcon style={{ width: 12, height: 12 }} />
      CSV
    </button>
  );
}

// ============================================================
// REPORT CARDS
// ============================================================

function RevenueChart({ start, end, compare }) {
  const [data, setData] = useState([]);
  const [prevData, setPrevData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const main = getRevenueReport(start, end)
      .then(r => r.data.map(d => ({
        ...d,
        month: new Date(d.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        estimated: Number(d.estimated),
        actual: Number(d.actual),
      })));

    const [pStart, pEnd] = compare ? getPreviousPeriod(start, end) : [null, null];
    const prev = pStart ? getRevenueReport(pStart, pEnd)
      .then(r => r.data.map(d => ({ estimated: Number(d.estimated), actual: Number(d.actual) })))
      .catch(() => null) : Promise.resolve(null);

    Promise.all([main, prev])
      .then(([m, p]) => { setData(m); setPrevData(p); })
      .catch(() => { setData([]); setPrevData(null); })
      .finally(() => setLoading(false));
  }, [start, end, compare]);

  if (loading) return <div className="report-card__loader">Loading...</div>;
  if (!data.length) return <div className="report-card__empty">No revenue data for this period</div>;

  const totalEstimated = data.reduce((s, d) => s + d.estimated, 0);
  const totalActual = data.reduce((s, d) => s + d.actual, 0);
  const prevEstimated = prevData?.reduce((s, d) => s + d.estimated, 0);
  const prevActual = prevData?.reduce((s, d) => s + d.actual, 0);

  return (
    <>
    {compare && prevData && (
      <ComparisonStats items={[
        { label: 'Estimated', current: totalEstimated, previous: prevEstimated, format: 'dollar' },
        { label: 'Actual', current: totalActual, previous: prevActual, format: 'dollar' },
        { label: 'Deals', current: data.reduce((s, d) => s + Number(d.lead_count || 0), 0), previous: prevData.length, format: 'number' },
      ]} />
    )}
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

function PipelineChart({ start, end, compare, onDrillDown }) {
  const [data, setData] = useState([]);
  const [prevData, setPrevData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const main = getPipelineReport(start, end)
      .then(r => r.data.map(d => ({
        ...d,
        label: STAGE_LABELS[d.stage] || d.stage,
        count: Number(d.count),
        total_value: Number(d.total_value),
        fill: STAGE_COLORS[d.stage] || '#6b7280',
      })));

    const [pStart, pEnd] = compare ? getPreviousPeriod(start, end) : [null, null];
    const prev = pStart ? getPipelineReport(pStart, pEnd)
      .then(r => r.data.map(d => ({ count: Number(d.count), total_value: Number(d.total_value) })))
      .catch(() => null) : Promise.resolve(null);

    Promise.all([main, prev])
      .then(([m, p]) => { setData(m); setPrevData(p); })
      .catch(() => { setData([]); setPrevData(null); })
      .finally(() => setLoading(false));
  }, [start, end, compare]);

  if (loading) return <div className="report-card__loader">Loading...</div>;
  if (!data.length) return <div className="report-card__empty">No pipeline data for this period</div>;

  const totalLeads = data.reduce((s, d) => s + d.count, 0);
  const totalValue = data.reduce((s, d) => s + d.total_value, 0);
  const prevLeads = prevData?.reduce((s, d) => s + d.count, 0);
  const prevValue = prevData?.reduce((s, d) => s + d.total_value, 0);

  const handleBarClick = (entry) => {
    if (onDrillDown && entry?.stage) {
      onDrillDown({ type: 'stage', value: entry.stage, label: entry.label });
    }
  };

  return (
    <>
    {compare && prevData && (
      <ComparisonStats items={[
        { label: 'Total Leads', current: totalLeads, previous: prevLeads, format: 'number' },
        { label: 'Pipeline Value', current: totalValue, previous: prevValue, format: 'dollar' },
      ]} />
    )}
    {onDrillDown && <div style={{ fontSize: 10, color: 'oklch(0.55 0.12 250)', fontWeight: 600, marginBottom: 4, textAlign: 'right' }}>Click a bar to view leads</div>}
    <ExportButton data={data} filename="pipeline_report" />
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
        <XAxis type="number" tick={{ fill: 'oklch(0.7 0 0)', fontSize: 12 }} />
        <YAxis dataKey="label" type="category" tick={{ fill: 'oklch(0.7 0 0)', fontSize: 12 }} width={100} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, name, props) => [v, `${name} — click to view`]} />
        <Bar dataKey="count" name="Leads" onClick={handleBarClick} style={{ cursor: 'pointer' }}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </>
  );
}

function ConversionChart({ start, end, compare }) {
  const [data, setData] = useState([]);
  const [prevData, setPrevData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const main = getConversionReport(start, end)
      .then(r => r.data.map(d => ({
        ...d,
        total: Number(d.total),
        sold: Number(d.sold),
        rate: d.total > 0 ? Math.round((d.sold / d.total) * 100) : 0,
      })));

    const [pStart, pEnd] = compare ? getPreviousPeriod(start, end) : [null, null];
    const prev = pStart ? getConversionReport(pStart, pEnd)
      .then(r => r.data.map(d => ({ total: Number(d.total), sold: Number(d.sold) })))
      .catch(() => null) : Promise.resolve(null);

    Promise.all([main, prev])
      .then(([m, p]) => { setData(m); setPrevData(p); })
      .catch(() => { setData([]); setPrevData(null); })
      .finally(() => setLoading(false));
  }, [start, end, compare]);

  if (loading) return <div className="report-card__loader">Loading...</div>;
  if (!data.length) return <div className="report-card__empty">No conversion data for this period</div>;

  const totalAll = data.reduce((s, d) => s + d.total, 0);
  const totalSold = data.reduce((s, d) => s + d.sold, 0);
  const overallRate = totalAll > 0 ? Math.round((totalSold / totalAll) * 100) : 0;
  const prevTotal = prevData?.reduce((s, d) => s + d.total, 0);
  const prevSold = prevData?.reduce((s, d) => s + d.sold, 0);
  const prevRate = prevTotal > 0 ? Math.round((prevSold / prevTotal) * 100) : 0;

  return (
    <>
    {compare && prevData && (
      <ComparisonStats items={[
        { label: 'Total Leads', current: totalAll, previous: prevTotal, format: 'number' },
        { label: 'Sold', current: totalSold, previous: prevSold, format: 'number' },
        { label: 'Close Rate', current: overallRate, previous: prevRate, format: 'percent' },
      ]} />
    )}
    <ExportButton data={data} filename="conversion_report" />
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="oklch(0.3 0 0)" />
        <PolarAngleAxis dataKey="source" tickFormatter={(v) => SOURCE_LABELS[v] || v} tick={{ fill: 'oklch(0.7 0 0)', fontSize: 11 }} />
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

function RepLeaderboard({ start, end, compare }) {
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

  // Matches LeadList's sort indicator exactly (e29e005) \u2014 which in turn matches
  // CustomSelect's chevron. 10x10, opacity 0.5, strokeWidth 2.5.
  const sortArrowStyle = { width: 10, height: 10, marginLeft: 4, display: 'inline-block', verticalAlign: 'middle', strokeWidth: 2.5, opacity: 0.5 };
  const arrow = (key) => {
    if (sortKey !== key) return null;
    const Arrow = sortDir === 'asc' ? ChevronUpIcon : ChevronDownIcon;
    return <Arrow style={sortArrowStyle} />;
  };

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

function LeadSourcesPie({ start, end, compare, onDrillDown }) {
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

  const handleSliceClick = (entry) => {
    if (onDrillDown && entry?.source) {
      onDrillDown({ type: 'source', value: entry.source, label: entry.source });
    }
  };

  return (
    <>
    {onDrillDown && <div style={{ fontSize: 10, color: 'oklch(0.55 0.12 250)', fontWeight: 600, marginBottom: 4, textAlign: 'right' }}>Click a slice to view leads</div>}
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
          label={({ source, percent }) => `${SOURCE_LABELS[source] || source} ${(percent * 100).toFixed(0)}%`}
          labelLine={{ stroke: 'oklch(0.5 0 0)' }}
          onClick={handleSliceClick}
          style={{ cursor: 'pointer' }}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} stroke="oklch(0.15 0.01 260)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [v, 'Leads — click to view']} />
      </PieChart>
    </ResponsiveContainer>
    </>
  );
}

function StageDurationChart({ start, end, compare }) {
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

// Calculate previous period dates for comparison
function getPreviousPeriod(startStr, endStr) {
  if (!startStr || !endStr) return [null, null];
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  const durationMs = end - start;
  const prevEnd = new Date(start.getTime() - 86400000); // day before current start
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return [prevStart.toISOString().slice(0, 10), prevEnd.toISOString().slice(0, 10)];
}

function DeltaBadge({ current, previous, format = 'number', suffix = '' }) {
  if (previous == null || previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const isUp = delta > 0;
  const isNeutral = Math.abs(delta) < 0.5;
  const color = isNeutral ? 'oklch(0.55 0.02 260)' : isUp ? 'oklch(0.75 0.18 155)' : 'oklch(0.68 0.22 25)';
  const bg = isNeutral ? 'oklch(0.55 0.02 260 / 0.1)' : isUp ? 'oklch(0.75 0.18 155 / 0.12)' : 'oklch(0.68 0.22 25 / 0.12)';
  const Arrow = isNeutral ? ArrowRightIcon : isUp ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
      color, background: bg, display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      <Arrow style={{ width: 11, height: 11, strokeWidth: 2.5, flexShrink: 0 }} />
      {Math.abs(delta).toFixed(0)}%{suffix}
    </span>
  );
}

function ComparisonStats({ items }) {
  if (!items?.length) return null;
  return (
    <div style={{
      display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap',
    }}>
      {items.map(({ label, current, previous, format }) => (
        <div key={label} style={{
          flex: '1 1 100px', minWidth: 80, padding: '8px 10px', borderRadius: 10,
          background: 'oklch(0.14 0.01 260 / 0.6)', border: '1px solid oklch(0.25 0.01 260 / 0.3)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'oklch(0.55 0.02 260)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
            {label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {format === 'dollar' ? fmtDollars(current) : format === 'percent' ? `${current}%` : current}
            </span>
            <DeltaBadge current={current} previous={previous} />
          </div>
          {previous != null && (
            <div style={{ fontSize: 10, color: 'oklch(0.50 0.02 260)', marginTop: 2 }}>
              prev: {format === 'dollar' ? fmtDollars(previous) : format === 'percent' ? `${previous}%` : previous}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ReportsView() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768); useEffect(() => { const mq = window.matchMedia('(max-width: 768px)'); const h = (e) => setIsMobile(e.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, []);
  const [preset, setPreset] = useState('year');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [compare, setCompare] = useState(false);

  const handleDrillDown = useCallback(({ type, value }) => {
    const params = new URLSearchParams();
    if (type === 'stage') params.set('stage', value);
    if (type === 'source') params.set('source', value);
    navigate(`/leads?${params.toString()}`);
  }, [navigate]);

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
          <button
            onClick={() => setCompare(c => !c)}
            style={{
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
              border: compare ? '1px solid oklch(0.72 0.19 250 / 0.5)' : '1px solid oklch(0.3 0.02 260)',
              background: compare ? 'oklch(0.72 0.19 250 / 0.15)' : 'oklch(0.18 0.01 260 / 0.5)',
              color: compare ? 'oklch(0.80 0.19 250)' : 'oklch(0.55 0.02 260)',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <ArrowTrendingUpIcon style={{ width: 14, height: 14 }} />
            {compare ? 'Comparing' : 'Compare'}
          </button>
        </div>
      </div>

      <div className="reports-grid" style={{ gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
        <div className="glass report-card">
          <h3 className="report-card__title">Revenue</h3>
          <RevenueChart start={start} end={end} compare={compare} />
        </div>

        <div className="glass report-card">
          <h3 className="report-card__title">Pipeline</h3>
          <PipelineChart start={start} end={end} compare={compare} onDrillDown={handleDrillDown} />
        </div>

        <div className="glass report-card">
          <h3 className="report-card__title">Conversion by Source</h3>
          <ConversionChart start={start} end={end} compare={compare} />
        </div>

        <div className="glass report-card">
          <h3 className="report-card__title">Rep Leaderboard</h3>
          <RepLeaderboard start={start} end={end} compare={compare} />
        </div>

        <div className="glass report-card">
          <h3 className="report-card__title">Lead Sources</h3>
          <LeadSourcesPie start={start} end={end} compare={compare} onDrillDown={handleDrillDown} />
        </div>

        <div className="glass report-card">
          <h3 className="report-card__title">Stage Duration</h3>
          <StageDurationChart start={start} end={end} compare={compare} />
        </div>
      </div>
    </div>
  );
}
