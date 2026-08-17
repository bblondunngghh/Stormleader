// Run 77 s1 — fill the ids the generic resolver missed.
// Every MISS in .qa-r77-ids.mjs was a container-shape mismatch (GeoJSON, {members}, {documents})
// or a genuinely empty table. Distinguish the two: an id we cannot resolve because the table is
// empty is a COVERAGE HOLE we must declare, not a bug.
import fs from 'fs';
import { req, summarize } from './.qa-r77-lib.mjs';

const ids = JSON.parse(fs.readFileSync('C:/tmp/qa-r77-ids.json', 'utf8'));
const notes = [];

// storms: GeoJSON FeatureCollection
const st = await req('GET', '/api/storms?limit=20');
const feats = st.body?.features;
if (Array.isArray(feats) && feats.length) {
  const p = feats[0].properties || {};
  ids.storm = p.id ?? p.event_id ?? feats[0].id ?? null;
  ids.stormEventId = p.event_id ?? p.eventId ?? p.id ?? null;
  notes.push(`storm: from GeoJSON feature props (${Object.keys(p).slice(0, 12)})`);
} else notes.push(`storm: features=${Array.isArray(feats) ? feats.length : typeof feats}`);

// team -> {members:[]}
const tm = await req('GET', '/api/crm/team');
const mem = tm.body?.members;
if (Array.isArray(mem) && mem.length) { ids.user = mem[0].id ?? mem[0].user_id; notes.push(`user: from members[${mem.length}]`); }
else notes.push(`user: members=${JSON.stringify(mem).slice(0, 80)}`);

// documents -> {documents:[]}
const dc = await req('GET', '/api/documents');
const docs = dc.body?.documents;
if (Array.isArray(docs) && docs.length) ids.document = docs[0].id;
else notes.push(`document: EMPTY TABLE (documents=${Array.isArray(docs) ? 0 : typeof docs}) -> coverage hole`);

// notifications -> {notifications:[]}
const nt = await req('GET', '/api/notifications');
const nots = nt.body?.notifications;
if (Array.isArray(nots) && nots.length) ids.notification = nots[0].id;
else notes.push(`notification: EMPTY (${Array.isArray(nots) ? 0 : typeof nots}) -> coverage hole`);

// properties: the list route needs bbox/params. Find the shape it wants.
for (const q of ['?limit=5', '?bbox=-90.6,41.4,-90.4,41.6', '?county=Scott&state=IA&limit=5',
  '?lat=41.5&lng=-90.5&radius=5000', '?minLat=41.4&maxLat=41.6&minLng=-90.6&maxLng=-90.4']) {
  const r = await req('GET', '/api/properties' + q);
  notes.push(`properties${q} -> ${r.status} ${summarize(r.body)}`);
  if (r.status === 200) {
    let rows = Array.isArray(r.body) ? r.body : (r.body?.properties || r.body?.data || r.body?.features);
    if (Array.isArray(rows) && rows.length) {
      ids.property = rows[0].id ?? rows[0].properties?.id;
      break;
    }
  }
}

// empty-table confirmations (these are coverage holes, not failures)
for (const [k, path] of [['drip', '/api/crm/drip-sequences'], ['finApplication', '/api/crm/financing/applications'],
  ['automation', '/api/crm/automations'], ['skipJob', '/api/skip-trace/jobs'], ['territory', '/api/crm/territories']]) {
  if (ids[k]) continue;
  const r = await req('GET', path);
  notes.push(`${k}: ${path} -> ${r.status} ${summarize(r.body)} (EMPTY TABLE -> coverage hole)`);
}

// contact under a lead — the detail route did not embed contacts; find the real shape
if (ids.lead && !ids.contact) {
  const l = await req('GET', `/api/crm/leads/${ids.lead}`);
  notes.push(`lead detail keys: ${Object.keys(l.body || {}).join(',')}`);
  const c = await req('GET', `/api/crm/leads/${ids.lead}/contacts`);
  notes.push(`lead contacts route -> ${c.status} ${summarize(c.body)}`);
  const arr = Array.isArray(c.body) ? c.body : c.body?.contacts;
  if (Array.isArray(arr) && arr.length) ids.contact = arr[0].id;
}

fs.writeFileSync('C:/tmp/qa-r77-ids.json', JSON.stringify(ids, null, 1));
console.log('=== IDS AFTER FILL ===');
for (const [k, v] of Object.entries(ids)) console.log(`${(v ? 'OK  ' : 'MISS')} ${k.padEnd(18)} ${v ?? ''}`);
console.log('\nresolved:', Object.values(ids).filter(Boolean).length, 'of', Object.keys(ids).length);
console.log('\n=== NOTES ===');
notes.forEach((n) => console.log(' -', n));
