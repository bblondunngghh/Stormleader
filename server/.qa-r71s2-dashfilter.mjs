// Does the dashboard period filter actually change anything? READ-ONLY (GETs).
import fs from 'fs';
const token = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { Authorization: `Bearer ${token}` };
const BASE = 'http://localhost:3001';

const g = async (p) => {
  const r = await fetch(BASE + p, { headers: H });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const windows = {
  'ALL TIME (no param)': '',
  '7d  (date_from=2026-07-31)': '?date_from=2026-07-31',
  '30d (date_from=2026-07-08)': '?date_from=2026-07-08',
  '90d (date_from=2026-05-09)': '?date_from=2026-05-09',
  'ABSURD (date_from=2030-01-01)': '?date_from=2030-01-01',
};

console.log('=== /api/crm/dashboard/stats ===');
for (const [label, qs] of Object.entries(windows)) {
  const r = await g('/api/crm/dashboard/stats' + qs);
  console.log(label.padEnd(30), r.status, JSON.stringify(r.body));
}

console.log('\n=== /api/crm/pipeline/metrics ===');
for (const [label, qs] of Object.entries(windows)) {
  const r = await g('/api/crm/pipeline/metrics' + qs);
  const b = r.body;
  console.log(label.padEnd(30), r.status, JSON.stringify(b).slice(0, 260));
}

console.log('\n=== /api/crm/dashboard/activity (count only) ===');
for (const [label, qs] of Object.entries(windows)) {
  const r = await g('/api/crm/dashboard/activity' + qs);
  const b = r.body;
  const arr = Array.isArray(b) ? b : b?.activity || b?.data || [];
  console.log(label.padEnd(30), r.status, 'rows=' + (Array.isArray(arr) ? arr.length : '?'));
}
