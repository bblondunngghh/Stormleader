// Empty-body / junk-body sweep over every write route.
// A 400 means no row was written, so this is DB-cost-free by construction.
// Purpose: prove nothing 500s on missing or wrong-typed input.
import fs from 'fs';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const IDS = JSON.parse(fs.readFileSync('C:/tmp/qa-r85-ids.json','utf8'));
const INV = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json','utf8'));
const BASE = 'http://localhost:3001';
const DEAD = '00000000-0000-4000-8000-000000000000';
const R = k => IDS[k] || DEAD;
const P = JSON.parse(fs.readFileSync('C:/tmp/qa-r85-pmap.json','utf8'));

// Anything that spends money, emails a human, mutates in bulk, or deletes.
const SKIP = [
  /import/i, /skip-trace/i, /geocode/i, /\/export/i, /generate-leads/i, /roof-measurement/i,
  /fema-live/i, /\/send/i, /\/email/i, /\/sms/i, /stripe/i, /payment/i, /webhook/i,
  /\/sync/i, /trigger/i, /drift/i, /\/void/i, /calibrat/i,
];

const BODIES = [
  ['empty', {}],
  ['junk',  { name: 12345, title: true, amount: 'not-a-number', status: ['x'], notes: { deep: 1 } }],
];

const results = [];
for (const r of INV) {
  if (!['POST','PATCH','PUT'].includes(r.method)) continue;
  if (r.method === 'DELETE') continue;
  if (SKIP.some(rx => rx.test(r.path))) { results.push({ ...r, variant: '-', status: 'SKIP', note: 'charter-prohibited' }); continue; }
  const url = r.path.replace(/:([A-Za-z0-9_]+)\??/g, (m, name) => {
    if (name === 'id') {
      for (const [pre, key] of P.prefixes) if (r.path.startsWith(pre)) return key === 'tenantId' ? IDS.tenantId : R(key);
      return DEAD;
    }
    return P.named[name] ? (IDS[P.named[name]] || DEAD) : DEAD;
  });
  for (const [variant, body] of BODIES) {
    try {
      const res = await fetch(BASE + url, {
        method: r.method,
        headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const ct = res.headers.get('content-type') || '';
      const txt = ct.includes('json') ? JSON.stringify(await res.json().catch(()=>null)) : (await res.text().catch(()=>'')).slice(0,200);
      results.push({ ...r, variant, url, status: res.status, snip: txt.slice(0, 220) });
    } catch (e) { results.push({ ...r, variant, url, status: 'FETCH_ERR', snip: e.message }); }
  }
}
fs.writeFileSync('C:/tmp/qa-r85-write-results.json', JSON.stringify(results, null, 1));
const by = {};
for (const x of results) by[x.status] = (by[x.status]||0)+1;
console.log('write probes:', results.filter(r=>r.status!=='SKIP').length, '| status:', JSON.stringify(by));
console.log('\n=== 5xx (REAL BUGS) ===');
const bad = results.filter(r => typeof r.status === 'number' && r.status >= 500);
if (!bad.length) console.log('none');
for (const r of bad) console.log(`${r.status} ${r.method} ${r.path} [${r.variant}] ${r.snip}`);
console.log('\n=== 2xx ON EMPTY BODY (accepted a contentless write) ===');
for (const r of results.filter(r => typeof r.status==='number' && r.status<300 && r.variant==='empty'))
  console.log(`${r.status} ${r.method} ${r.path} :: ${r.snip.slice(0,120)}`);
