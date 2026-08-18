import fs from 'fs';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const BASE = 'http://localhost:3001';
const H = { Authorization: `Bearer ${TOKEN}` };

async function get(path) {
  try {
    const r = await fetch(BASE + path, { headers: H });
    const txt = await r.text();
    return { status: r.status, body: txt };
  } catch (e) { return { status: -1, body: String(e) }; }
}

// ---- FIX 0486204: repeated query params must not 500 ----
const REPEATED = [
  ['/api/properties?bbox=1,2,3,4&bbox=5,6,7,8', 'properties bbox'],
  ['/api/properties/fema-live?bbox=1,2,3,4&bbox=5,6,7,8', 'fema-live bbox'],
  ['/api/map/properties?bbox=1,2,3,4&bbox=5,6,7,8', 'map/properties bbox'],
  ['/api/map/swaths?bbox=1,2,3,4&bbox=5,6,7,8', 'map/swaths bbox'],
  ['/api/map/affected-properties?bbox=1,2,3,4&bbox=5,6,7,8', 'map/affected bbox'],
  ['/api/crm/canvass-pins?bbox=1,2,3,4&bbox=5,6,7,8', 'canvass-pins bbox'],
  ['/api/storm-history/heatmap?bbox=1,2,3,4&bbox=5,6,7,8', 'heatmap bbox'],
  ['/api/crm/leads?sort_dir=asc&sort_dir=desc', 'leads sort_dir'],
  ['/api/search?q=a&q=b', 'search q'],
  ['/api/materials/products?search=a&search=b', 'materials search'],
];
console.log('=== FIX 0486204: repeated query params ===');
let bad = 0;
for (const [p, name] of REPEATED) {
  const r = await get(p);
  const ok = r.status < 500;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${String(r.status).padEnd(4)} ${name}`);
}
// nested-object form too (?bbox[a]=1) -> object, also not a string
console.log('--- object-form params ---');
for (const [p, name] of [['/api/search?q[x]=1','search q obj'], ['/api/crm/leads?sort_dir[x]=1','leads sort_dir obj'], ['/api/map/properties?bbox[x]=1','map bbox obj']]) {
  const r = await get(p);
  const ok = r.status < 500; if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${String(r.status).padEnd(4)} ${name}`);
}
// good input still works
console.log('--- good input regression ---');
for (const [p,name] of [['/api/crm/leads?sort_dir=asc','leads sort_dir=asc'],['/api/search?q=roof','search q=roof'],['/api/materials/products?search=shingle','materials search']]) {
  const r = await get(p);
  console.log(`${r.status===200?'OK  ':'FAIL'} ${r.status} ${name} len=${r.body.length}`);
  if (r.status!==200) bad++;
}

// ---- FIX e9eaa38: storm_start present on leads list ----
console.log('\n=== FIX e9eaa38: storm_start key on leads list ===');
const lr = await get('/api/crm/leads?limit=100');
if (lr.status === 200) {
  const j = JSON.parse(lr.body);
  const rows = j.leads || j.data || j.items || [];
  const withKey = rows.filter(r => 'storm_start' in r).length;
  console.log(`rows=${rows.length} withStormStartKey=${withKey}`);
  const nonNull = rows.filter(r => r.storm_start).length;
  console.log(`non-null storm_start=${nonNull}`);
  if (rows.length && withKey !== rows.length) { console.log('FAIL: key missing on some rows'); bad++; }
  else console.log('OK: key present on all rows');
} else { console.log('FAIL status', lr.status); bad++; }

console.log('\nTOTAL FAILURES:', bad);
