// Run 78 s1 — supplementary id resolution for the 18 GET-sweep coverage holes.
import fs from 'fs';
import { req, summarize } from './.qa-r78-lib.mjs';

const ids = JSON.parse(fs.readFileSync('C:/tmp/qa-r78-ids.json', 'utf8'));
const notes = [];

// properties list REQUIRES a bbox (400 without) — that is why the plain list missed.
const BBOX = '?bbox=-91.0,41.0,-90.0,42.0';
for (const p of ['/api/properties' + BBOX, '/api/map/properties' + BBOX]) {
  const r = await req('GET', p);
  let rows = Array.isArray(r.body) ? r.body : (r.body?.properties || r.body?.features || r.body?.data);
  if (Array.isArray(rows) && rows.length) {
    const row = rows[0];
    ids.property = row.id ?? row.properties?.id ?? row.property_id;
    if (ids.property) { notes.push(`property from ${p} (${rows.length} rows)`); break; }
  }
  notes.push(`property: ${p} -> ${r.status} ${summarize(r.body)}`);
}

// storms is a GeoJSON FeatureCollection — dig into features[].properties
const s = await req('GET', '/api/storms?limit=20');
const feats = s.body?.features;
if (Array.isArray(feats) && feats.length) {
  const pr = feats[0].properties || {};
  ids.storm = pr.id ?? feats[0].id ?? pr.event_id;
  ids.stormEventId = pr.event_id ?? pr.storm_event_id ?? pr.id ?? feats[0].id;
  notes.push(`storm: ${feats.length} features, keys=${Object.keys(pr).slice(0,12)}`);
} else notes.push(`storm: ${s.status} ${summarize(s.body)}`);

// team is {members:[...]}
const t = await req('GET', '/api/crm/team');
const mem = t.body?.members;
if (Array.isArray(mem) && mem.length) { ids.user = mem[0].id ?? mem[0].user_id; notes.push(`user from members[${mem.length}]`); }
else notes.push(`user: ${t.status} ${summarize(t.body)}`);

// counties
const c = await req('GET', '/api/counties');
let crows = Array.isArray(c.body) ? c.body : (c.body?.counties || c.body?.data);
if (Array.isArray(crows) && crows.length) { ids.county = crows[0].id ?? crows[0].fips ?? crows[0].county_fips; notes.push(`county from ${crows.length} rows, keys=${Object.keys(crows[0]).slice(0,10)}`); }
else notes.push(`county: ${c.status} ${summarize(c.body)}`);

// lead contacts live on a sub-route, not embedded on the detail
if (ids.lead) {
  const k = await req('GET', `/api/crm/leads/${ids.lead}/contacts`);
  const arr = Array.isArray(k.body) ? k.body : k.body?.contacts;
  if (Array.isArray(arr) && arr.length) { ids.contact = arr[0].id; ids.leadWithContact = ids.lead; }
  else notes.push(`contact: /leads/:id/contacts -> ${k.status} ${summarize(k.body)}`);
}
// find ANY lead that has a contact (first lead may simply have none)
if (!ids.contact) {
  const l = await req('GET', '/api/crm/leads?limit=50');
  const leads = Array.isArray(l.body) ? l.body : (l.body?.leads || l.body?.data || []);
  for (const ld of leads.slice(0, 12)) {
    const k = await req('GET', `/api/crm/leads/${ld.id}/contacts`);
    const arr = Array.isArray(k.body) ? k.body : k.body?.contacts;
    if (Array.isArray(arr) && arr.length) { ids.contact = arr[0].id; ids.leadWithContact = ld.id; notes.push(`contact found on lead ${ld.id}`); break; }
  }
}

fs.writeFileSync('C:/tmp/qa-r78-ids.json', JSON.stringify(ids, null, 1));
console.log('=== SUPPLEMENTARY IDS ===');
for (const k of ['property','storm','stormEventId','user','county','contact','leadWithContact'])
  console.log(`${(ids[k] ? 'OK  ' : 'MISS')} ${k.padEnd(16)} ${ids[k] ?? ''}`);
console.log('\ntotal resolved:', Object.values(ids).filter(Boolean).length, 'of', Object.keys(ids).length);
console.log('\n=== NOTES ==='); notes.forEach(n => console.log(' -', n));
