// Are rep/source dropped too? READ-ONLY. Ground truth: 31 leads total,
// source split from the dashboard panel = canvassing 3, fema_nsi 6, storm_map 5, manual 17.
import fs from 'fs';
const token = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { Authorization: `Bearer ${token}` };
const BASE = 'http://localhost:3001';
const g = async (p) => { const r = await fetch(BASE + p, { headers: H }); return { s: r.status, b: await r.json().catch(() => null) }; };

const sum = (f) => (f || []).reduce((a, x) => a + (x.count || 0), 0);

console.log('=== /api/crm/pipeline/metrics : total lead count in funnel ===');
for (const qs of ['', '?source=canvassing', '?source=manual', '?source=nonexistent_source', '?rep=00000000-0000-0000-0000-000000000000', '?date_from=2030-01-01']) {
  const r = await g('/api/crm/pipeline/metrics' + qs);
  console.log((qs || '(none)').padEnd(48), r.s, 'funnel total count =', sum(r.b?.funnel));
}

console.log('\n=== /api/crm/dashboard/stats : Pipeline Value ===');
for (const qs of ['', '?source=canvassing', '?source=nonexistent_source', '?date_from=2030-01-01']) {
  const r = await g('/api/crm/dashboard/stats' + qs);
  const pv = r.b?.stats?.find((s) => s.label === 'Pipeline Value')?.value;
  console.log((qs || '(none)').padEnd(48), r.s, 'Pipeline Value =', pv);
}

console.log('\n=== control: /api/dashboard/* (the OTHER router, which DOES read filters) ===');
for (const qs of ['', '?date_from=2030-01-01', '?source=canvassing']) {
  const r = await g('/api/dashboard/stats' + qs);
  console.log(('/api/dashboard/stats' + qs).padEnd(48), r.s, JSON.stringify(r.b));
}
